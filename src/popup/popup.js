import { createMemo, uploadResource, ApiError } from '../lib/api.js';
import { buildMarkdownLink } from '../lib/markdown.js';
import { getSettings } from '../lib/storage.js';

const $content = document.getElementById('content');
const $visibility = document.getElementById('visibility');
const $includePage = document.getElementById('includePage');
const $submit = document.getElementById('submit');
const $status = document.getElementById('status');
const $openOptions = document.getElementById('openOptions');
const $charCount = document.getElementById('charCount');
const $shortcutHint = document.getElementById('shortcutHint');
const $toolButtons = Array.from(document.querySelectorAll('[data-md-action]'));
const $pickFiles = document.getElementById('pickFiles');
const $fileInput = document.getElementById('fileInput');
const $attachmentRow = document.getElementById('attachmentRow');
const $attachmentList = document.getElementById('attachmentList');

let currentTab = null;
let attachments = [];

init();

async function init() {
  $shortcutHint.textContent = /mac/i.test(navigator.platform) ? 'Cmd+Enter' : 'Ctrl+Enter';

  const settings = await getSettings();
  $visibility.value = settings.defaultVisibility;
  $includePage.checked = settings.popupIncludePageInfo;

  if (!settings.backendUrl || !settings.accessToken) {
    setStatus('请先打开设置,配置后端 URL 和访问令牌。', 'error');
    $submit.disabled = true;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  const [{ result: selection } = {}] = await chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || '',
    })
    .catch(() => [{ result: '' }]);

  if (selection) {
    $content.value = `> ${selection.split('\n').join('\n> ')}\n\n`;
  }
  updateEditorState();
  $content.focus();
  $content.setSelectionRange($content.value.length, $content.value.length);

  $submit.addEventListener('click', submit);
  $content.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      submit();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      insertText('  ');
    }
  });
  $content.addEventListener('input', updateEditorState);
  $toolButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyMarkdownAction(button.dataset.mdAction);
    });
  });
  $openOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  $pickFiles.addEventListener('click', () => {
    $fileInput.click();
  });
  $fileInput.addEventListener('change', handleFileSelection);
  $attachmentList.addEventListener('click', handleAttachmentRemoval);
  window.addEventListener('beforeunload', cleanupAttachmentPreviews);

  renderAttachments();
}

async function submit() {
  const content = buildMemoContent({ trim: true });
  if (!content && attachments.length === 0) {
    setStatus('请先输入内容', 'error');
    return;
  }

  setBusyState(true);
  try {
    const resourceIdList = await uploadAttachments();
    setStatus('发送中…');
    await createMemo({ content, visibility: $visibility.value, resourceIdList });
    setStatus('已保存 ✓', 'ok');
    setTimeout(() => window.close(), 500);
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : String(err);
    setStatus(msg, 'error');
    setBusyState(false);
  }
}

function setStatus(msg, cls = '') {
  $status.textContent = msg;
  $status.className = `status ${cls}`.trim();
}

function updateCharCount() {
  const count = $content.value.trim().length;
  $charCount.textContent = `${count} 字`;
}

function updateEditorState() {
  updateCharCount();
}

function applyMarkdownAction(action) {
  switch (action) {
    case 'bold':
      wrapSelection('**', '**', '粗体');
      break;
    case 'italic':
      wrapSelection('*', '*', '斜体');
      break;
    case 'heading':
      prefixSelectedLines('## ');
      break;
    case 'quote':
      prefixSelectedLines('> ');
      break;
    case 'ul':
      prefixSelectedLines('- ');
      break;
    case 'ol':
      prefixSelectedLines('', true);
      break;
    case 'link':
      insertLink();
      break;
    case 'code':
      wrapSelection('`', '`', 'code');
      break;
    case 'codeblock':
      insertCodeBlock();
      break;
    default:
      break;
  }

  updateEditorState();
  $content.focus();
}

function wrapSelection(prefix, suffix, placeholder) {
  const { selectionStart, selectionEnd, value } = $content;
  const selected = value.slice(selectionStart, selectionEnd) || placeholder;
  const replacement = `${prefix}${selected}${suffix}`;
  const inserted = replaceRange(selectionStart, selectionEnd, replacement);

  if (selectionStart === selectionEnd) {
    const base = inserted.start + prefix.length;
    $content.setSelectionRange(base, base + selected.length);
  }
}

function prefixSelectedLines(prefix, ordered = false) {
  const { value, selectionStart, selectionEnd } = $content;
  const start = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
  let end = value.indexOf('\n', selectionEnd);
  end = end === -1 ? value.length : end;

  const block = value.slice(start, end) || '列表项';
  const lines = block.split('\n');
  const replacement = lines
    .map((line, index) => {
      const content = line.trim() || '列表项';
      return ordered ? `${index + 1}. ${content}` : `${prefix}${content}`;
    })
    .join('\n');

  replaceRange(start, end, replacement);
}

function insertLink() {
  const { selectionStart, selectionEnd, value } = $content;
  const selected = value.slice(selectionStart, selectionEnd) || '链接文本';
  const replacement = `[${selected}](https://)`;
  const inserted = replaceRange(selectionStart, selectionEnd, replacement);
  const urlStart = inserted.start + replacement.indexOf('https://');
  $content.setSelectionRange(urlStart, urlStart + 'https://'.length);
}

function insertCodeBlock() {
  const { selectionStart, selectionEnd, value } = $content;
  const selected = value.slice(selectionStart, selectionEnd) || '在这里输入代码';
  const prefix = value.slice(0, selectionStart).endsWith('\n') || selectionStart === 0 ? '' : '\n';
  const suffix = value.slice(selectionEnd).startsWith('\n') || selectionEnd === value.length ? '' : '\n';
  const replacement = `${prefix}\`\`\`\n${selected}\n\`\`\`${suffix}`;
  const inserted = replaceRange(selectionStart, selectionEnd, replacement);
  const codeStart = inserted.start + prefix.length + 4;
  $content.setSelectionRange(codeStart, codeStart + selected.length);
}

function insertText(text) {
  const { selectionStart, selectionEnd } = $content;
  const inserted = replaceRange(selectionStart, selectionEnd, text);
  const caret = inserted.start + text.length;
  $content.setSelectionRange(caret, caret);
  updateEditorState();
}

function replaceRange(start, end, replacement) {
  $content.setRangeText(replacement, start, end, 'end');
  return { start, end: start + replacement.length };
}

function buildMemoContent({ trim } = { trim: true }) {
  let content = trim ? $content.value.trim() : $content.value.replace(/\s+$/, '');

  if ($includePage.checked && currentTab?.url) {
    const link = buildMarkdownLink(currentTab.title || currentTab.url, currentTab.url);
    content = content.trim() ? `${content}\n\n---\n${link}` : link;
  }

  return trim ? content.trim() : content;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function handleFileSelection(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const existing = new Set(attachments.map(({ file }) => getFileKey(file)));
  for (const file of files) {
    const key = getFileKey(file);
    if (existing.has(key)) continue;
    existing.add(key);
    attachments.push({
      id: createLocalId(),
      file,
      previewUrl: isPreviewableImage(file) ? URL.createObjectURL(file) : '',
    });
  }

  $fileInput.value = '';
  renderAttachments();
}

function handleAttachmentRemoval(event) {
  const button = event.target.closest('[data-remove-attachment]');
  if (!button) return;

  const removedId = button.dataset.removeAttachment;
  const removed = attachments.find((item) => item.id === removedId);
  if (removed?.previewUrl) {
    URL.revokeObjectURL(removed.previewUrl);
  }

  attachments = attachments.filter((item) => item.id !== removedId);
  renderAttachments();
}

function renderAttachments() {
  if (!attachments.length) {
    $attachmentRow.hidden = true;
    $attachmentList.innerHTML = '';
    return;
  }

  $attachmentRow.hidden = false;
  $attachmentList.innerHTML = attachments
    .map(
      ({ id, file, previewUrl }) => `
        <span class="attachment-chip ${previewUrl ? 'attachment-chip-image' : ''}">
          ${
            previewUrl
              ? `<img class="attachment-preview" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(file.name)}" />`
              : ''
          }
          <span class="attachment-chip-copy">
            <span class="attachment-chip-name">${escapeHtml(file.name)}</span>
            <span class="attachment-chip-meta">${formatFileSize(file.size)}</span>
          </span>
          <button class="attachment-remove" type="button" data-remove-attachment="${id}" aria-label="移除附件">×</button>
        </span>
      `
    )
    .join('');
}

async function uploadAttachments() {
  if (!attachments.length) {
    return [];
  }

  const resourceIdList = [];

  for (const [index, attachment] of attachments.entries()) {
    setStatus(`上传附件 ${index + 1}/${attachments.length}…`);
    const resource = await uploadResource(attachment.file, attachment.file.name);
    if (resource?.id) {
      resourceIdList.push(resource.id);
    }
  }

  return resourceIdList;
}

function setBusyState(busy) {
  $submit.disabled = busy;
  $pickFiles.disabled = busy;
  $fileInput.disabled = busy;
}

function cleanupAttachmentPreviews() {
  attachments.forEach(({ previewUrl }) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  });
}

function getFileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function createLocalId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 1024 * 10 ? 0 : 1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 * 10 ? 0 : 1)} MB`;
}

function isPreviewableImage(file) {
  return typeof file.type === 'string' && file.type.startsWith('image/');
}
