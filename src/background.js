import { createMemo, uploadResourceFromUrl, ApiError } from './lib/api.js';
import { getSettings } from './lib/storage.js';

const MENUS = {
  SELECTION: 'cfmemos-selection',
  PAGE: 'cfmemos-page',
  LINK: 'cfmemos-link',
  IMAGE: 'cfmemos-image',
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENUS.SELECTION,
    title: '保存选中文本到 Memos',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: MENUS.PAGE,
    title: '保存当前页面到 Memos',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: MENUS.LINK,
    title: '保存链接到 Memos',
    contexts: ['link'],
  });
  chrome.contextMenus.create({
    id: MENUS.IMAGE,
    title: '保存图片到 Memos',
    contexts: ['image'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const { defaultVisibility } = await getSettings();
    switch (info.menuItemId) {
      case MENUS.SELECTION:
        await sendSelection(info, tab, defaultVisibility);
        break;
      case MENUS.PAGE:
        await sendPage(tab, defaultVisibility);
        break;
      case MENUS.LINK:
        await sendLink(info, tab, defaultVisibility);
        break;
      case MENUS.IMAGE:
        await sendImage(info, tab, defaultVisibility);
        break;
    }
  } catch (err) {
    notifyError(err);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-selection') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const [{ result: selection } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || '',
    });
    if (!selection) {
      notify('未选中内容', '请先选中一些文本');
      return;
    }
    const { defaultVisibility } = await getSettings();
    await sendSelection({ selectionText: selection, pageUrl: tab.url }, tab, defaultVisibility);
  } catch (err) {
    notifyError(err);
  }
});

async function sendSelection(info, tab, visibility) {
  const quote = info.selectionText.trim();
  const title = tab?.title || '';
  const url = info.pageUrl || tab?.url || '';
  const content = [
    `> ${quote.split('\n').join('\n> ')}`,
    '',
    `—— [${title || url}](${url})`,
  ].join('\n');
  await createMemo({ content, visibility });
  notify('已保存', truncate(quote, 80));
}

async function sendPage(tab, visibility) {
  const title = tab?.title || tab?.url || '';
  const url = tab?.url || '';
  const content = `[${title}](${url})`;
  await createMemo({ content, visibility });
  notify('页面已保存', title);
}

async function sendLink(info, tab, visibility) {
  const linkUrl = info.linkUrl;
  const linkText = info.selectionText?.trim() || linkUrl;
  const content = `[${linkText}](${linkUrl})`;
  await createMemo({ content, visibility });
  notify('链接已保存', linkUrl);
}

async function sendImage(info, tab, visibility) {
  const srcUrl = info.srcUrl;
  if (!srcUrl) throw new Error('未找到图片地址');
  const resource = await uploadResourceFromUrl(srcUrl);
  const pageTitle = tab?.title || '';
  const pageUrl = tab?.url || '';
  const content = pageUrl ? `来自 [${pageTitle || pageUrl}](${pageUrl})` : '';
  await createMemo({
    content,
    visibility,
    resourceIdList: [resource.id],
  });
  notify('图片已保存', resource.filename || srcUrl);
}

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title,
    message: message || '',
  });
}

function notifyError(err) {
  console.error('cfmemos error:', err);
  const msg = err instanceof ApiError ? err.message : err.message || String(err);
  notify('Memos 出错', msg);
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
