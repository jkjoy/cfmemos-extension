const DEFAULTS = {
  backendUrl: '',
  accessToken: '',
  defaultVisibility: 'PRIVATE',
  popupIncludePageInfo: true,
  quickSendIncludePageInfo: true,
};

export async function getSettings() {
  const stored = await chrome.storage.local.get({
    ...DEFAULTS,
    includePageInfo: undefined,
  });

  const legacyIncludePageInfo =
    typeof stored.includePageInfo === 'boolean' ? stored.includePageInfo : undefined;

  return {
    ...DEFAULTS,
    ...stored,
    popupIncludePageInfo:
      typeof stored.popupIncludePageInfo === 'boolean'
        ? stored.popupIncludePageInfo
        : legacyIncludePageInfo ?? DEFAULTS.popupIncludePageInfo,
    quickSendIncludePageInfo:
      typeof stored.quickSendIncludePageInfo === 'boolean'
        ? stored.quickSendIncludePageInfo
        : legacyIncludePageInfo ?? DEFAULTS.quickSendIncludePageInfo,
  };
}

export async function setSettings(partial) {
  await chrome.storage.local.set(partial);
}

export function normalizeBackendUrl(url) {
  if (!url) return '';
  return url.trim().replace(/\/+$/, '');
}

export function normalizeToken(token) {
  if (!token) return '';
  return token.trim().replace(/^Bearer\s+/i, '');
}
