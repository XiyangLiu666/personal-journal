// 通过 GitHub API 直接修改仓库：发布 data/content.json、上传照片、查看部署进度。
// 密钥只保存在当前浏览器的 localStorage 中，不会写进仓库或网页。
export const repo = {owner: 'XiyangLiu666', name: 'personal-journal', branch: 'main'};
const TOKEN_KEY = 'meantime-journal-github-token-v1';
const CONTENT_PATH = 'data/content.json';

export function getToken() {
  try {return localStorage.getItem(TOKEN_KEY) || '';} catch {return '';}
}
export function setToken(token) {
  try {if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);} catch {}
}

function explain(status, message) {
  if (status === 401) return '密钥无效或已过期，请重新连接 GitHub';
  if (status === 403) return '密钥没有修改权限，请确认 Contents 权限为 Read and write';
  if (status === 404) return '找不到仓库，或密钥没有访问 personal-journal 的权限';
  if (status === 409) return '网站内容刚刚在别处被修改，请再点一次发布';
  if (status === 422) return `GitHub 拒绝了这次修改${message ? '：' + message : ''}`;
  return `GitHub 返回错误 ${status}${message ? '：' + message : ''}`;
}

async function api(path, {method = 'GET', body, token = getToken()} = {}) {
  let response;
  try {
    response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? {'Content-Type': 'application/json'} : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error('网络连接失败，请检查网络后重试');
  }
  if (!response.ok) {
    let message = '';
    try {message = (await response.json()).message || '';} catch {}
    const error = new Error(explain(response.status, message));
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

const toBase64 = bytes => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};
const fromBase64 = value => Uint8Array.from(atob(value.replace(/\s/g, '')), c => c.charCodeAt(0));

export async function verifyToken(token) {
  return api('', {token});
}

export async function readContent() {
  const file = await api(`/contents/${CONTENT_PATH}?ref=${repo.branch}`);
  let encoded = file.encoding === 'base64' ? file.content : '';
  if (!encoded) encoded = (await api(`/git/blobs/${file.sha}`)).content;
  return {text: new TextDecoder().decode(fromBase64(encoded)), sha: file.sha};
}

export async function remoteSha() {
  return (await api(`/contents/${CONTENT_PATH}?ref=${repo.branch}`)).sha;
}

export async function writeContent(text, sha, message) {
  const result = await api(`/contents/${CONTENT_PATH}`, {
    method: 'PUT',
    body: {message, content: toBase64(new TextEncoder().encode(text)), sha, branch: repo.branch}
  });
  return {sha: result.content.sha, commit: result.commit.sha};
}

export async function uploadFile(path, bytes, message) {
  await api(`/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    body: {message, content: toBase64(bytes), branch: repo.branch}
  });
  return path;
}

export async function deployRun(commitSha) {
  const result = await api(`/actions/runs?head_sha=${commitSha}&per_page=5`);
  return result.workflow_runs?.[0] || null;
}

// 压缩照片：长边不超过 2000 像素，转为 JPG，通常在 1 MB 以内。
export async function prepareImage(file) {
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) throw new Error('请选择图片文件');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'});
  } catch {
    throw new Error('浏览器无法读取这个图片格式（例如部分 HEIC 照片），请先转成 JPG 或 PNG');
  }
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('照片压缩失败，请换一张试试');
  return blob;
}

export function uploadPath() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `assets/uploads/${stamp}-${Math.random().toString(36).slice(2, 6)}.jpg`;
}

export const rawUrl = path => `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${repo.branch}/${path}`;
