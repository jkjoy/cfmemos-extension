import { createMemo, ApiError } from '../lib/api.js';
import { getSettings } from '../lib/storage.js';

const $content = document.getElementById('content');
const $visibility = document.getElementById('visibility');
const $includePage = document.getElementById('includePage');
const $submit = document.getElementById('submit');
const $status = document.getElementById('status');
const $openOptions = document.getElementById('openOptions');

let currentTab = null;

init();

async function init() {
  const settings = await getSettings();
  $visibility.value = settings.defaultVisibility;
  $includePage.checked = settings.includePageInfo;

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
  $content.focus();
  $content.setSelectionRange($content.value.length, $content.value.length);

  $submit.addEventListener('click', submit);
  $content.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
  });
  $openOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

async function submit() {
  const text = $content.value.trim();
  if (!text && !$includePage.checked) {
    setStatus('请先输入内容', 'error');
    return;
  }

  let content = text;
  if ($includePage.checked && currentTab?.url) {
    const link = `[${currentTab.title || currentTab.url}](${currentTab.url})`;
    content = content ? `${content}\n\n—— ${link}` : link;
  }

  $submit.disabled = true;
  setStatus('发送中…');
  try {
    await createMemo({ content, visibility: $visibility.value });
    setStatus('已保存 ✓', 'ok');
    setTimeout(() => window.close(), 500);
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : String(err);
    setStatus(msg, 'error');
    $submit.disabled = false;
  }
}

function setStatus(msg, cls = '') {
  $status.textContent = msg;
  $status.className = `status ${cls}`.trim();
}
