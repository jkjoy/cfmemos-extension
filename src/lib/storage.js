const DEFAULTS = {
  backendUrl: '',
  accessToken: '',
  defaultVisibility: 'PRIVATE',
  includePageInfo: true,
};

export async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
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
