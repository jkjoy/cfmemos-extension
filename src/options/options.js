import { getSettings, setSettings, normalizeBackendUrl, normalizeToken } from '../lib/storage.js';
import { authStatus, ApiError } from '../lib/api.js';

const $ = (id) => document.getElementById(id);

const fields = {
  backendUrl: $('backendUrl'),
  accessToken: $('accessToken'),
  defaultVisibility: $('defaultVisibility'),
  includePageInfo: $('includePageInfo'),
};

const $status = $('status');

init();

async function init() {
  const settings = await getSettings();
  fields.backendUrl.value = settings.backendUrl;
  fields.accessToken.value = settings.accessToken;
  fields.defaultVisibility.value = settings.defaultVisibility;
  fields.includePageInfo.checked = settings.includePageInfo;

  $('save').addEventListener('click', save);
  $('test').addEventListener('click', test);
  $('signin').addEventListener('click', signIn);
}

async function save() {
  await setSettings({
    backendUrl: normalizeBackendUrl(fields.backendUrl.value),
    accessToken: normalizeToken(fields.accessToken.value),
    defaultVisibility: fields.defaultVisibility.value,
    includePageInfo: fields.includePageInfo.checked,
  });
  setStatus('已保存。', 'ok');
}

async function test() {
  await save();
  setStatus('测试中…');
  try {
    const result = await authStatus();
    if (result?.authenticated && result.user) {
      const name = result.user.nickname || result.user.username || '未知用户';
      setStatus(`认证成功,当前用户: ${name}`, 'ok');
    } else {
      setStatus('连接成功,但令牌无效或已过期。请重新生成或登录。', 'error');
    }
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : String(err);
    setStatus(`失败: ${msg}`, 'error');
  }
}

async function signIn() {
  const username = $('username').value.trim();
  const password = $('password').value;
  const backendUrl = normalizeBackendUrl(fields.backendUrl.value);
  if (!backendUrl || !username || !password) {
    setStatus('请填写后端 URL、用户名和密码。', 'error');
    return;
  }
  setStatus('登录中…');
  try {
    const res = await fetch(`${backendUrl}/api/v1/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) {
      throw new Error(data.message || data.error || `HTTP ${res.status}`);
    }
    fields.accessToken.value = data.token;
    await save();
    $('password').value = '';
    setStatus(`已登录为 ${data.user?.username || username}。`, 'ok');
  } catch (err) {
    setStatus(`登录失败: ${err.message}`, 'error');
  }
}

function setStatus(msg, cls = '') {
  $status.textContent = msg;
  $status.className = `status ${cls}`.trim();
}
