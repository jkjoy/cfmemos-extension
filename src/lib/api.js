import { getSettings, normalizeBackendUrl, normalizeToken } from './storage.js';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, headers = {}, isForm = false } = {}) {
  const { backendUrl, accessToken } = await getSettings();
  const base = normalizeBackendUrl(backendUrl);
  const token = normalizeToken(accessToken);
  if (!base) throw new ApiError('尚未配置后端 URL', 0);
  if (!token) throw new ApiError('尚未配置访问令牌', 0);

  const url = `${base}${path}`;
  const finalHeaders = {
    Authorization: `Bearer ${token}`,
    ...headers,
  };
  if (!isForm && body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    let msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    if (res.status === 401) {
      msg += ' (令牌无效或已过期,请在设置页重新登录或粘贴新令牌)';
    }
    throw new ApiError(msg, res.status);
  }
  return data;
}

export async function ping() {
  return request('/api/v1/ping');
}

export async function authStatus() {
  return request('/api/v1/auth/status');
}

export async function createMemo({ content, visibility = 'PRIVATE', resourceIdList = [] }) {
  return request('/api/v1/memo', {
    method: 'POST',
    body: { content, visibility, resourceIdList },
  });
}

export async function uploadResource(blob, filename) {
  const form = new FormData();
  const file = blob instanceof File ? blob : new File([blob], filename, { type: blob.type });
  form.append('file', file, filename);
  return request('/api/v1/resource', {
    method: 'POST',
    body: form,
    isForm: true,
  });
}

export async function uploadResourceFromUrl(srcUrl) {
  const res = await fetch(srcUrl);
  if (!res.ok) throw new ApiError(`拉取图片失败: HTTP ${res.status}`, res.status);
  const blob = await res.blob();
  const ext = (blob.type.split('/')[1] || 'bin').split(';')[0];
  const filename = `clip_${Date.now()}.${ext}`;
  return uploadResource(blob, filename);
}

export { ApiError };
