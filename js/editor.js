import {loadContent, validateContent, DRAFT_KEY, PREVIEW_KEY, safeUrl, escapeHTML as e} from './content.js';
import {getToken, setToken, verifyToken, readContent, remoteSha, writeContent, uploadFile, deployRun, prepareImage, uploadPath, rawUrl, readHomeFile, homeFileSha, commitHomeFiles, uploadHomeFile} from './github.js';
import {ACADEMIC_ORIGIN, ACADEMIC_PATH, ACADEMIC_PREVIEW_KEY, validateAcademic, renderHomepage, renderInline, displayItems, sortedItems, STRUCTURED, KIND_LABELS, photoUrl} from './academic.js';
import {lookupPaper} from './paper-lookup.js';

const DRAFT_BASE_KEY = 'meantime-journal-draft-base-v1';
let data, published = null, baseSha = null, editBase = null, connected = false, busy = false, deployWatch = 0;
let section = 'site', currentId = null, newItem = null;
const previews = new Map();
const panel = document.querySelector('#editor-panel');
const status = document.querySelector('#save-status');
const publishButton = document.querySelector('#publish');
const canon = value => JSON.stringify(value);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const today = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;};
const hasUnpublished = () => published !== null && canon(data) !== published;

function setStatus(text, tone = '', link) {
  status.dataset.tone = tone;
  status.innerHTML = e(text) + (link ? ` <a href="${e(link.href)}" target="_blank" rel="noopener noreferrer">${e(link.text)}</a>` : '');
}
function ask(message, confirmText = '确认') {
  const dialog = document.querySelector('#confirm-dialog');
  document.querySelector('#confirm-message').textContent = message;
  dialog.querySelector('button[value="confirm"]').textContent = confirmText;
  dialog.returnValue = 'cancel';
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), {once: true}));
}
function setBusy(value) {
  busy = value;
  document.body.classList.toggle('is-busy', value);
  document.querySelectorAll('.editor-shell button, .editor-shell input, .editor-shell textarea').forEach(el => {el.disabled = value;});
}

const labels = {posts: '日记', photos: '照片', timeline: '时间线', favorites: '收藏'};
const IMG = 'image';
const fields = {
  site: [['title', '网站名称'], ['subtitle', '英文副标题'], ['owner', '你的名字'], ['since', '开始年份'], ['heroLine', '首页的一句话', 'wide'], ['heroNote', '首页英文小字', 'wide'], ['heroImage', '首页封面照片', IMG], ['heroAlt', '封面照片描述', 'wide'], ['location', '所在地 / 当前状态'], ['email', '邮箱（可留空）'], ['intro', '简短介绍', 'textarea'], ['about', '关于我', 'textarea'], ['letter', '写给自己的信', 'textarea'], ['lifeBackground', 'life 页面背景', IMG], ['leafBackground', 'leaf 页面背景', IMG], ['bioBackground', '介绍 / 收藏页面背景', IMG], ['eventBackground', '时间线页面背景', IMG]],
  posts: [['title', '标题', 'wide'], ['date', '日期', 'date'], ['tag', '分类'], ['image', '照片（可不放）', IMG], ['body', '正文', 'textarea']],
  photos: [['title', '照片标题', 'wide'], ['date', '日期', 'date'], ['src', '照片', IMG], ['caption', '照片说明', 'textarea'], ['alt', '照片描述（可留空，供读屏软件使用）', 'wide']],
  timeline: [['title', '标题', 'wide'], ['date', '日期', 'date'], ['image', '配图（可不放）', IMG], ['body', '记录', 'textarea']],
  favorites: [['title', '标题', 'wide'], ['category', '分类（如 阅读、音乐、地方）'], ['url', '链接（可留空）'], ['image', '封面图（可不放）', IMG], ['note', '收藏笔记', 'textarea']]
};

function thumbSource(value) {
  if (!value) return '';
  if (previews.has(value)) return previews.get(value);
  if (value.startsWith('assets/uploads/')) return rawUrl(value);
  return safeUrl(value, true);
}
function thumbHTML(value) {
  const src = thumbSource(value);
  return src ? `<img src="${e(src)}" alt="">` : '<em>暂无照片</em>';
}
function fieldHTML([key, label, type], item) {
  const required = ['title', 'date'].includes(key) || (section === 'photos' && key === 'src');
  const value = item[key] ?? '';
  if (type === 'textarea') return `<label class="wide">${label}<textarea name="${key}" rows="${['body', 'about', 'letter'].includes(key) ? 9 : 5}">${e(value)}</textarea></label>`;
  if (type === IMG) return `<div class="wide field image-field" data-field="${key}"><span>${label}</span><div class="image-row"><div class="image-thumb">${thumbHTML(value)}</div><div class="image-controls"><label class="upload-button"><span>${value ? '换一张照片' : '选择照片上传'}</span><input type="file" accept="image/*,.heic,.heif" data-upload="${key}"></label><button type="button" class="link-button" data-clear="${key}" ${value ? '' : 'hidden'}>移除照片</button><input name="${key}" type="text" value="${e(value)}" placeholder="会自动填写，也可填 https:// 图片链接" ${required ? 'required' : ''} aria-label="${label}的路径"></div></div></div>`;
  const list = ['category', 'tag'].includes(key) ? `list="options-${key}"` : '';
  return `<label class="${type === 'wide' ? 'wide' : ''}">${label}<input name="${key}" type="${type === 'date' ? 'date' : 'text'}" value="${e(value)}" ${required ? 'required' : ''} ${list}></label>`;
}
function optionsHTML() {
  return ['category', 'tag'].filter(key => fields[section].some(([k]) => k === key)).map(key => `<datalist id="options-${key}">${[...new Set(data[section].map(x => x[key]).filter(Boolean))].map(v => `<option value="${e(v)}">`).join('')}</datalist>`).join('');
}
function formHTML(item, isNew = false) {
  const action = connected ? '保存并发布' : '保存到这台设备';
  const heading = section === 'site' ? '' : `<h3 class="wide form-title">${isNew ? `新增${labels[section]}` : `编辑${labels[section]}`}</h3>`;
  return `<form class="editor-form">${heading}${fields[section].map(field => fieldHTML(field, item)).join('')}${optionsHTML()}<div class="wide form-actions"><button class="save-record" type="submit">${action}</button>${section !== 'site' ? '<button type="button" class="cancel-record">取消</button>' : ''}${section !== 'site' && !isNew ? '<button type="button" class="delete-record" data-delete-current>删除这条</button>' : ''}</div></form>`;
}
function currentItem() {
  if (section === 'site') return data.site;
  if (newItem && newItem.id === currentId) return newItem;
  return data[section].find(x => x.id === currentId) || null;
}
function blankItem() {
  const item = Object.fromEntries(fields[section].map(([key]) => [key, '']));
  item.id = `entry-${crypto.randomUUID()}`;
  if ('date' in item) item.date = today();
  return item;
}
function rowThumb(x) {
  const src = thumbSource(x.image || x.src || '');
  return src ? `<img src="${e(src)}" alt="" loading="lazy">` : '<span></span>';
}

function render() {
  document.querySelectorAll('[data-section]').forEach(button => {if (button.dataset.section === section) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');});
  if (section === 'academic') {renderAcademic(); return;}
  const item = currentItem();
  if (section === 'site') {
    panel.innerHTML = `<p class="editor-note">网站名称、首页文字、个人介绍和各页面的背景照片。</p>${formHTML(data.site)}`;
  } else if (item) {
    panel.innerHTML = `<button type="button" class="back-link">← 返回${labels[section]}列表</button>${formHTML(item, item === newItem)}`;
  } else {
    const list = data[section];
    panel.innerHTML = `<div class="editor-panel-heading"><h2>${labels[section]} <span class="tiny-label">/ ${list.length}</span></h2><button class="new-record" type="button">＋ 新增${labels[section]}</button></div><div class="record-list">${list.map(x => `<div class="record-row"><div class="row-thumb">${rowThumb(x)}</div><div class="row-text"><strong>${e(x.title)}</strong><small>${e(x.date || x.category)}</small></div><div class="row-actions"><button type="button" data-edit="${e(x.id)}">编辑</button><button type="button" data-delete="${e(x.id)}">删除</button></div></div>`).join('') || `<p class="editor-empty">还没有${labels[section]}。点右上角新增第一条吧。</p>`}</div>`;
  }
  bind();
}

function bind() {
  panel.querySelector('.new-record')?.addEventListener('click', async () => {
    if (!await canLeave()) return;
    newItem = blankItem(); currentId = newItem.id; render();
    panel.querySelector('[name="title"]')?.focus();
  });
  panel.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', async () => {if (await canLeave()) {newItem = null; currentId = button.dataset.edit; render(); window.scrollTo({top: panel.offsetTop - 20});}}));
  panel.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteRecord(button.dataset.delete)));
  panel.querySelector('[data-delete-current]')?.addEventListener('click', () => deleteRecord(currentId));
  panel.querySelectorAll('.back-link, .cancel-record').forEach(button => button.addEventListener('click', async () => {if (await canLeave()) {currentId = null; newItem = null; render();}}));
  const form = panel.querySelector('form');
  if (!form) return;
  form.addEventListener('submit', event => {event.preventDefault(); submitForm();});
  form.addEventListener('input', () => {if (!busy) setStatus('有尚未保存的修改', 'warn');});
  form.querySelectorAll('[data-upload]').forEach(input => input.addEventListener('change', () => handleUpload(input)));
  form.querySelectorAll('[data-clear]').forEach(button => button.addEventListener('click', () => {
    const field = button.closest('.image-field');
    field.querySelector('input[type="text"]').value = '';
    updateThumb(field);
    form.dispatchEvent(new Event('input'));
  }));
  form.querySelectorAll('.image-field input[type="text"]').forEach(input => input.addEventListener('change', () => updateThumb(input.closest('.image-field'))));
}
function updateThumb(field) {
  const value = field.querySelector('input[type="text"]').value.trim();
  field.querySelector('.image-thumb').innerHTML = thumbHTML(value);
  field.querySelector('.upload-button span').textContent = value ? '换一张照片' : '选择照片上传';
  field.querySelector('[data-clear]').hidden = !value;
}

function isDirty() {
  if (section === 'academic') return academicDirty();
  const form = panel.querySelector('form');
  if (!form) return false;
  const source = currentItem();
  if (!source) return false;
  return [...new FormData(form)].some(([key, value]) => (source[key] ?? '') !== value);
}
async function canLeave() {return !isDirty() || await ask('当前修改还没有保存，确定放弃吗？', '放弃修改');}

function storeDraft() {
  try {
    if (published !== null && canon(data) === published) {localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(DRAFT_BASE_KEY);}
    else {
      localStorage.setItem(DRAFT_KEY, canon(data));
      if (editBase) localStorage.setItem(DRAFT_BASE_KEY, editBase);
    }
  } catch {}
}
function updatePublishState() {
  const pending = hasUnpublished();
  publishButton.hidden = !pending;
  publishButton.textContent = connected ? '发布尚未发布的修改 ↑' : '连接 GitHub 后发布';
  document.querySelector('#unpublished-note').hidden = !pending;
}

async function save(next, message) {
  try {validateContent(next);} catch (error) {setStatus(`未保存：${error.message}`, 'error'); return false;}
  data = next;
  storeDraft();
  updatePublishState();
  if (connected) await publish(message);
  else setStatus('已保存到这台设备。连接 GitHub 后才能发布到网站。', 'warn');
  return true;
}

async function submitForm() {
  const form = panel.querySelector('form');
  if (!form || busy) return;
  const isNew = Boolean(newItem && currentId === newItem.id);
  if (!isNew && !isDirty()) {
    if (hasUnpublished() && connected) return publish('更新网站内容');
    setStatus('没有需要保存的修改');
    return;
  }
  if (!form.reportValidity()) return;
  const next = structuredClone(data);
  let target;
  if (section === 'site') target = next.site;
  else if (isNew) {target = structuredClone(newItem); next[section].unshift(target);}
  else target = next[section].find(x => x.id === currentId);
  for (const [key, value] of new FormData(form)) if (typeof value === 'string') target[key] = value.trim() === '' && key !== 'body' ? '' : value;
  const message = section === 'site' ? '修改网站设置' : `${isNew ? '新增' : '修改'}${labels[section]}：${target.title}`;
  if (await save(next, message)) {
    if (section !== 'site') {newItem = null; currentId = null;}
    render();
  }
}

async function deleteRecord(id) {
  if (busy) return;
  const item = data[section].find(x => x.id === id);
  if (!item) return;
  const text = connected ? `删除“${item.title}”？确认后会立即从网站上移除。` : `从这台设备的草稿中删除“${item.title}”？`;
  if (!await ask(text, '删除')) return;
  const next = structuredClone(data);
  next[section] = next[section].filter(x => x.id !== id);
  if (await save(next, `删除${labels[section]}：${item.title}`)) {
    if (currentId === id) {currentId = null; newItem = null;}
    render();
  }
}

async function publish(message = '更新网站内容') {
  if (!connected) {focusConnect(); return;}
  if (busy) return;
  setBusy(true);
  setStatus('正在发布…');
  try {
    const sha = await remoteSha();
    const expected = editBase || baseSha;
    if (expected && sha !== expected) {
      setBusy(false);
      const overwrite = await ask('网站内容在其他设备或 GitHub 上被修改过。继续发布会用这里的内容覆盖那些修改，确定吗？', '覆盖并发布');
      if (!overwrite) {setStatus('已取消发布，修改仍保存在这台设备上。可点“备份与恢复”中的重新读取获取最新内容。', 'warn'); return;}
      setBusy(true);
    }
    const result = await writeContent(JSON.stringify(data, null, 2) + '\n', sha, message);
    baseSha = result.sha; editBase = result.sha;
    published = canon(data);
    storeDraft();
    setStatus('已发布 ✓ 网站大约 1 分钟后更新', 'ok');
    watchDeploy(result.commit);
  } catch (error) {
    setStatus(`发布失败：${error.message}。修改已保存在这台设备上，可稍后点“发布”重试。`, 'error');
  } finally {
    setBusy(false);
    updatePublishState();
  }
}

async function watchDeploy(commit) {
  const id = ++deployWatch;
  for (let i = 0; i < 60; i++) {
    await sleep(i ? 5000 : 4000);
    if (id !== deployWatch) return;
    let run;
    try {run = await deployRun(commit);} catch {return;}
    if (!run) continue;
    if (run.status !== 'completed') {setStatus('已发布 ✓ 网站正在更新…', 'ok'); continue;}
    if (run.conclusion === 'success') setStatus('网站已更新 ✓', 'ok', {href: 'index.html', text: '查看网站 ↗'});
    else if (run.conclusion === 'cancelled') setStatus('已发布 ✓ 网站会随下一次更新一起生效', 'ok');
    else setStatus('内容已保存到 GitHub，但网站更新没有成功。', 'error', {href: run.html_url, text: '查看原因 ↗'});
    return;
  }
}

async function handleUpload(input) {
  const file = input.files[0];
  input.value = '';
  if (!file || busy) return;
  if (!connected) {setStatus('请先在上方连接 GitHub，才能上传照片。', 'warn'); focusConnect(); return;}
  const field = input.closest('.image-field');
  const text = field.querySelector('input[type="text"]');
  setBusy(true);
  setStatus('正在压缩并上传照片…');
  try {
    const blob = await prepareImage(file);
    const path = uploadPath();
    await uploadFile(path, new Uint8Array(await blob.arrayBuffer()), `上传照片 ${path}`);
    previews.set(path, URL.createObjectURL(blob));
    text.value = path;
    updateThumb(field);
    setBusy(false);
    setStatus(`照片已上传 ✓ 记得点“${connected ? '保存并发布' : '保存'}”`, 'ok');
  } catch (error) {
    setBusy(false);
    setStatus(`照片上传失败：${error.message}`, 'error');
  }
}

function focusConnect() {
  const setup = document.querySelector('.github-setup');
  setup.open = true;
  setup.scrollIntoView({behavior: 'smooth', block: 'center'});
  document.querySelector('#token').focus({preventScroll: true});
}
function updateGithubPanel() {
  document.querySelector('.github-connected').hidden = !connected;
  document.querySelector('.github-setup').hidden = connected;
}

async function init(message) {
  connected = false; baseSha = null; editBase = null;
  let loaded, note = '', tone = '';
  if (getToken()) {
    try {
      const remote = await readContent();
      loaded = validateContent(JSON.parse(remote.text));
      baseSha = remote.sha; connected = true;
    } catch (error) {note = `无法连接 GitHub：${error.message}`; tone = 'error';}
  }
  if (!loaded) loaded = await loadContent();
  published = canon(loaded); data = loaded; editBase = baseSha;
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (stored) {
      const draft = validateContent(JSON.parse(stored));
      if (canon(draft) !== published) {
        data = draft;
        editBase = localStorage.getItem(DRAFT_BASE_KEY) || baseSha;
        if (!note) {note = connected ? '这台设备上有尚未发布的修改，点“发布”即可上线。' : '这台设备上有尚未发布的修改。'; tone = 'warn';}
      } else {localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(DRAFT_BASE_KEY);}
    }
  } catch {}
  currentId = null; newItem = null; academicState = null; academicLoad = null;
  updateGithubPanel(); render(); updatePublishState();
  if (note) setStatus(note, tone);
  else if (message) setStatus(message, 'ok');
  else setStatus(connected ? '已连接 GitHub · 保存后会直接发布到网站' : '未连接 GitHub · 修改只会保存在这台设备', connected ? 'ok' : 'warn');
}

document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', async () => {if (data && !busy && await canLeave()) {section = button.dataset.section; currentId = null; newItem = null; render();}}));
publishButton.addEventListener('click', () => publish('更新网站内容'));
document.querySelector('#connect-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.querySelector('#token');
  const token = input.value.trim();
  if (!token) {input.focus(); return;}
  setBusy(true);
  setStatus('正在连接 GitHub…');
  try {
    await verifyToken(token);
    setToken(token);
    input.value = '';
    setBusy(false);
    await init('已连接 GitHub ✓ 之后保存就会直接发布到网站');
  } catch (error) {
    setBusy(false);
    setStatus(`连接失败：${error.message}`, 'error');
  }
});
document.querySelector('#disconnect').addEventListener('click', async () => {
  if (!await ask('断开后，这台设备需要重新粘贴密钥才能发布。确定断开吗？', '断开')) return;
  setToken('');
  await init('已断开 GitHub');
});
document.querySelector('#preview').addEventListener('click', () => {
  if (!data) return;
  const preview = structuredClone(data);
  const form = panel.querySelector('form');
  const item = section === 'site' ? preview.site : newItem && newItem.id === currentId ? (() => {const x = structuredClone(newItem); preview[section].unshift(x); return x;})() : preview[section]?.find(x => x.id === currentId);
  if (form && item) for (const [key, value] of new FormData(form)) if (typeof value === 'string') item[key] = value;
  try {
    validateContent(preview);
    localStorage.setItem(PREVIEW_KEY, canon(preview));
    const page = {site: 'home', posts: 'life', photos: 'leaf'}[section] || section;
    window.open(`index.html?draft=1#${page}`, '_blank', 'noopener');
  } catch (error) {setStatus(`无法预览：${error.message}`, 'error');}
});
document.querySelector('#export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'content.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus('已下载备份 content.json', 'ok');
});
document.querySelector('#import').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    const imported = validateContent(JSON.parse(await file.text()));
    if (!await ask('用这个备份文件替换当前内容？替换后需要点“发布”才会上线。', '替换')) return;
    data = imported; currentId = null; newItem = null;
    storeDraft(); render(); updatePublishState();
    setStatus('备份已导入，点“发布”即可上线', 'warn');
  } catch (error) {setStatus(`导入失败：${error.message}`, 'error');} finally {event.target.value = '';}
});
document.querySelector('#reset').addEventListener('click', async () => {
  if (!await ask('丢弃这台设备上尚未发布的修改，重新读取网站上的最新内容？', '重新读取')) return;
  try {localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(DRAFT_BASE_KEY);} catch {}
  await init('已读取最新内容');
});
window.addEventListener('beforeunload', event => {if (data && (isDirty() || busy)) {event.preventDefault(); event.returnValue = '';}});

/* ---------- 学术经历：编辑后同步到 XiyangLiu666.github.io ---------- */
const ACADEMIC_DRAFT_KEY = 'meantime-journal-academic-draft-v1';
let academicState = null, academicPublished = null, academicSha = null, indexSha = null, academicLoad = null, academicNote = '';
const academicPreviews = new Map();

function academicThumb(value) {
  const src = academicPreviews.get(value) || photoUrl(value);
  return src ? `<img src="${e(src)}" alt="">` : '<em>暂无照片</em>';
}
async function loadAcademicEditor() {
  academicNote = ''; academicSha = null; indexSha = null;
  let loaded = null;
  if (connected) {
    try {
      const file = await readHomeFile(ACADEMIC_PATH);
      if (file) {loaded = validateAcademic(JSON.parse(file.text)); academicSha = file.sha;}
      indexSha = await homeFileSha('index.html');
    } catch (error) {academicNote = error.message;}
  }
  if (!loaded) {
    const response = await fetch(`${ACADEMIC_ORIGIN}${ACADEMIC_PATH}?t=${Date.now()}`, {cache: 'no-store'});
    if (!response.ok) throw new Error('无法读取学术主页上的 data/academic.json');
    loaded = validateAcademic(await response.json());
  }
  academicPublished = canon(loaded);
  academicState = loaded;
  try {
    const stored = localStorage.getItem(ACADEMIC_DRAFT_KEY);
    if (stored) {
      const draft = validateAcademic(JSON.parse(stored));
      if (canon(draft) !== academicPublished) {academicState = draft; academicNote = academicNote || '这台设备上有尚未发布的学术经历修改，点“保存并发布”即可上线。';}
      else localStorage.removeItem(ACADEMIC_DRAFT_KEY);
    }
  } catch {}
}

let openItems = new Set(), academicLookupBusy = false;
const field = (path, label, value, opts = {}) => `<label class="${opts.wide ? 'wide' : ''}">${label}${opts.textarea ? `<textarea data-path="${path}" rows="${opts.rows || 2}" placeholder="${e(opts.placeholder || '')}">${e(value ?? '')}</textarea>` : opts.select ? `<select data-path="${path}">${opts.select.map(v => `<option ${v === value ? 'selected' : ''}>${v}</option>`).join('')}</select>` : `<input data-path="${path}" value="${e(value ?? '')}" placeholder="${e(opts.placeholder || '')}">`}</label>`;
function importBoxHTML(i) {
  return `<div class="import-box"><span>添加论文：粘贴链接自动识别（支持 IEEE Xplore、DOI、arXiv），也可以手动添加。论文按日期从新到旧自动排序和编号。</span><div class="import-row"><input data-import-input="${i}" placeholder="例如 https://ieeexplore.ieee.org/document/11161010"><button type="button" class="import-button" data-import="${i}">自动识别</button></div><div class="import-row"><button type="button" class="link-button" data-manual="${i},journal">＋ 手动添加期刊论文</button><button type="button" class="link-button" data-manual="${i},conference">＋ 手动添加会议论文</button></div></div>`;
}
function itemTools(i, j, k, n, movable) {
  return `<div class="row-tools">${movable ? `<button type="button" class="link-button" data-item-move="${i},${j},${k},-1" ${k === 0 ? 'disabled' : ''}>上移</button><button type="button" class="link-button" data-item-move="${i},${j},${k},1" ${k === n - 1 ? 'disabled' : ''}>下移</button>` : ''}<button type="button" class="link-button danger" data-item-remove="${i},${j},${k}">删除</button></div>`;
}
function structuredFields(kind, base, item) {
  if (kind === 'patent') return `<div class="item-fields">${field(`${base}.title`, '专利名称', item.title, {wide: true})}${field(`${base}.inventors`, '发明人（用逗号分隔，按顺序）', (item.inventors || []).join('，'), {wide: true})}${field(`${base}.numberLabel`, '号码类型', item.numberLabel || '公开号', {select: ['公开号', '申请号', '授权号', '专利号']})}${field(`${base}.number`, '号码', item.number)}</div>`;
  return `<div class="item-fields">${field(`${base}.authors`, '作者（用英文逗号分隔，按顺序；你的名字会自动加粗加下划线）', (item.authors || []).join(', '), {wide: true, textarea: true})}${field(`${base}.title`, '题目', item.title, {wide: true, textarea: true})}${field(`${base}.venue`, kind === 'journal' ? '期刊全称' : '会议全称', item.venue, {wide: true})}${field(`${base}.abbr`, '简称（用于编号，例如 TCOM、ICC）', item.abbr)}${field(`${base}.date`, '日期（用于排序，可只填年份或年月，如 2026-06）', item.date)}${field(`${base}.extra`, '出版信息（可留空，默认显示年份）', item.extra, {wide: true, placeholder: kind === 'journal' ? '例如 vol. 74, no. 3, pp. 1–15, 2026' : '例如 Montreal, Canada, Jun. 8–12, 2025'})}${field(`${base}.url`, '论文链接（可留空）', item.url, {wide: true})}${field(`${base}.doi`, 'DOI（可留空）', item.doi)}</div>`;
}
function groupHTML(group, i, j, profile) {
  const structured = STRUCTURED.includes(group.kind);
  const kindControl = structured || group.items.length === 0 && false ? `<label>形式<span class="kind-label">${KIND_LABELS[group.kind]}</span></label>` : `<label>形式<select data-path="sections.${i}.groups.${j}.kind">${(group.items.length ? ['list', 'text'] : ['list', 'text', 'journal', 'conference', 'patent']).map(k => `<option value="${k}" ${group.kind === k ? 'selected' : ''}>${KIND_LABELS[k]}</option>`).join('')}</select></label>`;
  const previews = displayItems(group, profile);
  const n = group.items.length;
  const rows = group.items.map((item, k) => {
    const base = `sections.${i}.groups.${j}.items.${k}`;
    if (!structured) return `<li class="item-row">${field(base, '', item, {textarea: true, rows: group.kind === 'text' ? 5 : 2, wide: true})}${itemTools(i, j, k, n, true)}</li>`;
    return `<li class="item-row structured"><details data-item-id="${e(item.id)}" ${openItems.has(item.id) ? 'open' : ''}><summary><span class="item-preview">${renderInline(previews[k])}</span><span class="edit-hint">编辑</span></summary>${structuredFields(group.kind, base, item)}</details>${itemTools(i, j, k, n, group.kind === 'patent')}</li>`;
  }).join('');
  const addLabel = group.kind === 'patent' ? '＋ 添加专利' : group.kind === 'text' ? '＋ 添加一段' : group.kind === 'list' ? '＋ 添加一条' : '';
  return `<div class="academic-group"><div class="group-head"><label>小标题（可留空）<input data-path="sections.${i}.groups.${j}.heading" value="${e(group.heading || '')}"></label>${kindControl}<button type="button" class="link-button" data-remove-group="${i},${j}">删除分组</button></div><ol class="item-rows">${rows || '<li class="item-empty">还没有内容</li>'}</ol>${addLabel ? `<button type="button" class="add-button" data-add-item="${i},${j}">${addLabel}</button>` : ''}</div>`;
}
const today4 = () => String(new Date().getFullYear());
const blankPaper = () => ({id: `item-${crypto.randomUUID().slice(0, 10)}`, authors: [], title: '', venue: '', abbr: '', year: today4(), date: today4(), extra: '', url: '', doi: ''});
const blankPatent = () => ({id: `item-${crypto.randomUUID().slice(0, 10)}`, title: '', inventors: [], numberLabel: '公开号', number: '', date: ''});
function paperGroup(section, kind) {
  let group = section.groups.find(g => g.kind === kind);
  if (!group) {
    group = {heading: kind === 'journal' ? 'Journal Papers' : 'Conference Papers', kind, items: [], gap: 18};
    if (kind === 'journal') section.groups.unshift(group); else section.groups.push(group);
  }
  return group;
}
function rememberOpen() {panel.querySelectorAll('details[data-item-id]').forEach(d => {if (d.open) openItems.add(d.dataset.itemId); else openItems.delete(d.dataset.itemId);});}
function focusItem(id) {
  const details = panel.querySelector(`details[data-item-id="${CSS.escape(id)}"]`);
  if (!details) return;
  details.open = true;
  details.scrollIntoView({behavior: 'smooth', block: 'center'});
  details.querySelector('input, textarea')?.focus({preventScroll: true});
}
function renderAcademic() {
  if (!academicState) {
    panel.innerHTML = '<p class="editor-note">正在读取学术经历……</p>';
    academicLoad ||= loadAcademicEditor().catch(error => {academicNote = `读取失败：${error.message}`;});
    academicLoad.then(() => {if (section === 'academic') {if (academicState) renderAcademic(); else panel.innerHTML = `<p class="inline-message">${e(academicNote)}</p>`;}});
    return;
  }
  const a = academicState, p = a.profile;
  for (const section of a.sections) for (const group of section.groups) if (group.kind === 'journal' || group.kind === 'conference') group.items = sortedItems(group);
  const outline = [`<button type="button" data-ajump="ae-profile">基本信息</button>`, ...a.sections.map((section, i) => `<button type="button" data-ajump="ae-s-${i}">${e(section.nav || section.title)}</button>`)].join('<span>｜</span>');
  const sectionHTML = (section, i) => `<fieldset class="wide academic-card" id="ae-s-${i}"><legend>${e(section.title)}</legend><div class="card-tools"><button type="button" class="link-button" data-move="${i},-1" ${i === 0 ? 'disabled' : ''}>上移</button><button type="button" class="link-button" data-move="${i},1" ${i === a.sections.length - 1 ? 'disabled' : ''}>下移</button><button type="button" class="link-button danger" data-remove-section="${i}">删除板块</button></div><div class="card-grid"><label>板块标题<input data-path="sections.${i}.title" value="${e(section.title)}" required></label><label>大纲中的名称<input data-path="sections.${i}.nav" value="${e(section.nav || '')}" placeholder="留空则与标题相同"></label></div>${section.groups.some(g => g.kind === 'journal' || g.kind === 'conference') ? importBoxHTML(i) : ''}${section.groups.map((group, j) => groupHTML(group, i, j, p)).join('')}<button type="button" class="add-button" data-add-group="${i}">＋ 添加分组</button></fieldset>`;
  panel.innerHTML = `<p class="editor-note">保存后同步更新学术主页 <a href="${ACADEMIC_ORIGIN}" target="_blank" rel="noopener noreferrer">xiyangliu666.github.io ↗</a> 和这里的 academic 页面。写法：**粗体**　__下划线__　*斜体*　[文字](链接)。</p>
<nav class="academic-jump" aria-label="学术经历大纲">${outline}</nav>
<form class="editor-form academic-form" novalidate>
<fieldset class="wide academic-card" id="ae-profile"><legend>基本信息</legend><div class="card-grid"><label>英文名字<input data-path="profile.name" value="${e(p.name)}" required></label><label>中文名字<input data-path="profile.nameZh" value="${e(p.nameZh || '')}"></label></div>
<div class="field image-field" data-field="photo"><span>照片</span><div class="image-row"><div class="image-thumb">${academicThumb(p.photo)}</div><div class="image-controls"><label class="upload-button"><span>换一张照片</span><input type="file" accept="image/*,.heic,.heif" data-academic-upload></label><input type="text" data-path="profile.photo" value="${e(p.photo || '')}" aria-label="照片路径"></div></div></div>
<label class="wide">身份与单位（每行一项，空一行分组）<textarea data-path="profile.affiliation" rows="8">${e(p.affiliation || '')}</textarea></label>
<label class="wide">联系方式<textarea data-path="profile.contact" rows="3">${e(p.contact || '')}</textarea></label>
<label class="wide">页面底部文字<input data-path="footer" value="${e(a.footer || '')}"></label></fieldset>
${a.sections.map(sectionHTML).join('')}
<div class="wide"><button type="button" class="add-button" data-add-section>＋ 新增板块</button></div>
<div class="wide form-actions academic-actions"><button class="save-record" type="submit">${connected ? '保存并发布' : '保存到这台设备'}</button><button type="button" class="cancel-record" data-academic-preview>预览 ↗</button><button type="button" class="link-button" data-academic-reset>放弃修改，重新读取</button></div>
</form>`;
  bindAcademicEditor();
  if (academicNote) {setStatus(academicNote, academicNote.includes('权限') || academicNote.includes('失败') ? 'error' : 'warn'); academicNote = '';}
}
function setPath(target, path, value) {
  const keys = path.split('.');
  let node = target;
  for (const key of keys.slice(0, -1)) node = node[key];
  const last = keys.at(-1);
  if (last === 'authors') node[last] = value.split(/\s*,\s*(?:and\s+)?|\s+and\s+|\n+/).map(x => x.trim()).filter(Boolean);
  else if (last === 'inventors') node[last] = value.split(/\s*[，,、]\s*|\n+/).map(x => x.trim()).filter(Boolean);
  else if (last === 'kind' && node.kind !== value && STRUCTURED.includes(value)) {node.kind = value; node.items = []; node.gap = 18;}
  else node[last] = value;
}
function collectAcademic() {
  const next = structuredClone(academicState);
  panel.querySelectorAll('[data-path]').forEach(el => setPath(next, el.dataset.path, el.value));
  return next;
}
function academicDirty() {
  if (!academicState || !panel.querySelector('.academic-form')) return false;
  return canon(collectAcademic()) !== canon(academicState);
}
function restructure(change) {
  rememberOpen();
  academicState = collectAcademic();
  change(academicState);
  try {localStorage.setItem(ACADEMIC_DRAFT_KEY, canon(academicState));} catch {}
  renderAcademic();
  setStatus('有尚未保存的修改', 'warn');
}
function uniqueId(title, sections) {
  const base = title.trim() || 'Section';
  let id = base, n = 2;
  while (sections.some(s => s.id === id)) id = `${base} ${n++}`;
  return id;
}
function bindAcademicEditor() {
  const form = panel.querySelector('.academic-form');
  panel.querySelectorAll('[data-ajump]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.ajump)?.scrollIntoView({behavior: 'smooth', block: 'start'})));
  form.addEventListener('input', () => {if (!busy) setStatus('有尚未保存的修改', 'warn');});
  form.addEventListener('submit', event => {event.preventDefault(); saveAcademic();});
  form.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => {
    const [i, d] = button.dataset.move.split(',').map(Number);
    restructure(a => {const [item] = a.sections.splice(i, 1); a.sections.splice(i + d, 0, item);});
  }));
  form.querySelectorAll('[data-remove-section]').forEach(button => button.addEventListener('click', async () => {
    const i = Number(button.dataset.removeSection);
    if (await ask(`删除板块“${academicState.sections[i].title}”？保存后才会生效。`, '删除')) restructure(a => a.sections.splice(i, 1));
  }));
  form.querySelectorAll('[data-add-group]').forEach(button => button.addEventListener('click', () => restructure(a => a.sections[Number(button.dataset.addGroup)].groups.push({heading: '', kind: 'list', items: [], gap: 8}))));
  form.querySelectorAll('[data-remove-group]').forEach(button => button.addEventListener('click', async () => {
    const [i, j] = button.dataset.removeGroup.split(',').map(Number);
    if (await ask('删除这个分组和其中的内容？保存后才会生效。', '删除')) restructure(a => a.sections[i].groups.splice(j, 1));
  }));
  form.querySelectorAll('select[data-path$=".kind"]').forEach(select => select.addEventListener('change', () => restructure(() => {})));
  form.querySelectorAll('[data-item-move]').forEach(button => button.addEventListener('click', () => {
    const [i, j, k, d] = button.dataset.itemMove.split(',').map(Number);
    restructure(a => {const items = a.sections[i].groups[j].items; const [x] = items.splice(k, 1); items.splice(k + d, 0, x);});
  }));
  form.querySelectorAll('[data-item-remove]').forEach(button => button.addEventListener('click', async () => {
    const [i, j, k] = button.dataset.itemRemove.split(',').map(Number);
    const item = academicState.sections[i].groups[j].items[k];
    const name = typeof item === 'string' ? item.replace(/[*_\[\]]|\(http[^)]*\)/g, '').slice(0, 40) : item.title;
    if (await ask(`删除“${name || '这一条'}”？保存后才会生效。`, '删除')) restructure(a => a.sections[i].groups[j].items.splice(k, 1));
  }));
  form.querySelectorAll('[data-add-item]').forEach(button => button.addEventListener('click', () => {
    const [i, j] = button.dataset.addItem.split(',').map(Number);
    let added = null;
    restructure(a => {
      const group = a.sections[i].groups[j];
      if (group.kind === 'patent') {added = blankPatent(); group.items.unshift(added);}
      else group.items.push('');
    });
    if (added) focusItem(added.id);
    else panel.querySelectorAll(`#ae-s-${i} .academic-group`)[j]?.querySelector('.item-row:last-child textarea')?.focus();
  }));
  form.querySelectorAll('[data-manual]').forEach(button => button.addEventListener('click', () => {
    const [i, kind] = button.dataset.manual.split(',');
    const item = blankPaper();
    restructure(a => paperGroup(a.sections[Number(i)], kind).items.push(item));
    focusItem(item.id);
    setStatus('已添加一篇空白论文，请填写后点保存并发布', 'warn');
  }));
  form.querySelectorAll('[data-import]').forEach(button => button.addEventListener('click', () => importPaper(Number(button.dataset.import))));
  form.querySelectorAll('[data-import-input]').forEach(input => input.addEventListener('keydown', event => {if (event.key === 'Enter') {event.preventDefault(); importPaper(Number(input.dataset.importInput));}}));
  form.querySelectorAll('details[data-item-id] .item-fields').forEach(fields => fields.addEventListener('change', () => {
    const details = fields.closest('details');
    const next = collectAcademic();
    const [, i, , j, , k] = fields.querySelector('[data-path]').dataset.path.split('.');
    const group = next.sections[i].groups[j];
    const markup = displayItems({...group, items: group.kind === 'patent' ? group.items : sortedItems(group)}, next.profile)[group.kind === 'patent' ? Number(k) : sortedItems(group).indexOf(group.items[k])];
    details.querySelector('.item-preview').innerHTML = renderInline(markup);
  }));
  form.querySelector('[data-add-section]').addEventListener('click', () => {
    restructure(a => a.sections.push({id: `new-${crypto.randomUUID()}`, title: '新的板块', nav: '', groups: [{heading: '', kind: 'list', items: [], gap: 8}]}));
    const cards = panel.querySelectorAll('.academic-card');
    cards[cards.length - 1].scrollIntoView({behavior: 'smooth', block: 'center'});
    cards[cards.length - 1].querySelector('input').select();
  });
  form.querySelector('[data-academic-preview]').addEventListener('click', () => {
    try {
      const preview = finalizeAcademic(collectAcademic());
      localStorage.setItem(ACADEMIC_PREVIEW_KEY, canon(preview));
      window.open('index.html?draft=1#academic', '_blank', 'noopener');
    } catch (error) {setStatus(`无法预览：${error.message}`, 'error');}
  });
  form.querySelector('[data-academic-reset]').addEventListener('click', async () => {
    if (!await ask('放弃学术经历中尚未发布的修改，重新读取已发布的内容？', '重新读取')) return;
    try {localStorage.removeItem(ACADEMIC_DRAFT_KEY);} catch {}
    academicState = null; academicLoad = null; renderAcademic();
  });
  const upload = form.querySelector('[data-academic-upload]');
  upload.addEventListener('change', async () => {
    const file = upload.files[0]; upload.value = '';
    if (!file || busy) return;
    if (!connected) {setStatus('请先在上方连接 GitHub，才能上传照片。', 'warn'); focusConnect(); return;}
    const field = upload.closest('.image-field'), text = field.querySelector('input[type="text"]');
    setBusy(true); setStatus('正在压缩并上传照片…');
    try {
      const blob = await prepareImage(file);
      const path = uploadPath().replace('assets/uploads/', 'images/uploads/');
      await uploadHomeFile(path, new Uint8Array(await blob.arrayBuffer()), `上传照片 ${path}`);
      academicPreviews.set(path, URL.createObjectURL(blob));
      text.value = path;
      field.querySelector('.image-thumb').innerHTML = academicThumb(path);
      setBusy(false); setStatus('照片已上传 ✓ 记得点“保存并发布”', 'ok');
    } catch (error) {setBusy(false); setStatus(`照片上传失败：${error.message}`, 'error');}
  });
  form.querySelector('[data-path="profile.photo"]').addEventListener('change', event => {event.target.closest('.image-field').querySelector('.image-thumb').innerHTML = academicThumb(event.target.value.trim());});
}
async function importPaper(i) {
  const input = panel.querySelector(`[data-import-input="${i}"]`);
  if (!input || academicLookupBusy) return;
  const value = input.value.trim();
  if (!value) {input.focus(); setStatus('请先粘贴论文链接', 'warn'); return;}
  academicLookupBusy = true;
  const button = panel.querySelector(`[data-import="${i}"]`);
  button.disabled = true; button.textContent = '正在识别…';
  setStatus('正在识别论文信息…');
  try {
    const {kind, item} = await lookupPaper(value);
    const current = collectAcademic();
    const all = current.sections.flatMap(s => s.groups).filter(g => g.kind === 'journal' || g.kind === 'conference').flatMap(g => g.items);
    const norm = t => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const dup = all.find(x => (item.doi && x.doi && x.doi.toLowerCase() === item.doi.toLowerCase()) || (item.url && x.url === item.url) || norm(x.title) === norm(item.title));
    if (dup && !await ask(`这篇论文好像已经有了：“${dup.title}”。还要再添加一次吗？`, '仍然添加')) {setStatus('已取消添加'); return;}
    const entry = {id: `item-${crypto.randomUUID().slice(0, 10)}`, ...item};
    restructure(a => paperGroup(a.sections[i], kind).items.push(entry));
    focusItem(entry.id);
    setStatus(`已识别为${kind === 'journal' ? '期刊' : '会议'}论文，请核对内容（尤其是简称和出版信息），然后点保存并发布`, 'ok');
  } catch (error) {
    setStatus(`${error.message}`, 'error');
  } finally {
    academicLookupBusy = false;
    const again = panel.querySelector(`[data-import="${i}"]`);
    if (again) {again.disabled = false; again.textContent = '自动识别';}
  }
}
function finalizeAcademic(next) {
  for (const section of next.sections) {
    section.title = section.title.trim();
    if (!section.title) throw new Error('有板块没有填写标题');
    if (section.id.startsWith('new-')) section.id = uniqueId(section.title, next.sections);
    if (!section.nav || section.nav.trim() === section.title) section.nav = section.title;
    for (const group of section.groups) {
      if (!STRUCTURED.includes(group.kind)) {group.items = group.items.map(x => String(x).replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean); continue;}
      for (const item of group.items) {
        for (const key of Object.keys(item)) if (typeof item[key] === 'string') item[key] = item[key].trim();
        if (!item.title) throw new Error(`“${section.title}”中有条目没有填写题目`);
        if (group.kind !== 'patent') {item.year = String(item.date || item.year || '').slice(0, 4) || item.year; item.date ||= item.year;}
      }
      if (group.kind !== 'patent') group.items = sortedItems(group);
    }
    section.groups = section.groups.filter(group => group.items.length || group.heading.trim());
  }
  return validateAcademic(next);
}
async function saveAcademic() {
  if (busy) return;
  let next;
  try {next = finalizeAcademic(collectAcademic());} catch (error) {setStatus(`未保存：${error.message}`, 'error'); return;}
  academicState = next;
  try {localStorage.setItem(ACADEMIC_DRAFT_KEY, canon(next));} catch {}
  if (!connected) {renderAcademic(); setStatus('已保存到这台设备。连接 GitHub 后才能同步到学术主页。', 'warn'); return;}
  setBusy(true); setStatus('正在更新学术主页…');
  try {
    const [jsonNow, indexNow] = await Promise.all([homeFileSha(ACADEMIC_PATH), homeFileSha('index.html')]);
    if ((academicSha && jsonNow !== academicSha) || (indexSha && indexNow !== indexSha)) {
      setBusy(false);
      if (!await ask('学术主页在别处被修改过（例如直接在 GitHub 上改了 index.html）。继续会用这里的内容覆盖那些修改，确定吗？', '覆盖并发布')) {setStatus('已取消，修改仍保存在这台设备上。', 'warn'); renderAcademic(); return;}
      setBusy(true);
    }
    await commitHomeFiles([{path: ACADEMIC_PATH, text: JSON.stringify(next, null, 2) + '\n'}, {path: 'index.html', text: renderHomepage(next)}], '更新学术经历');
    [academicSha, indexSha] = await Promise.all([homeFileSha(ACADEMIC_PATH), homeFileSha('index.html')]);
    academicPublished = canon(next);
    try {localStorage.removeItem(ACADEMIC_DRAFT_KEY);} catch {}
    setBusy(false); renderAcademic();
    setStatus('已发布 ✓ 学术主页和 academic 页面大约 1 分钟后更新', 'ok', {href: ACADEMIC_ORIGIN, text: '打开学术主页 ↗'});
  } catch (error) {
    setBusy(false); renderAcademic();
    setStatus(`发布失败：${error.message}。修改已保存在这台设备上。`, 'error');
  }
}

if (location.hash === '#academic') section = 'academic';
try {await init();}
catch (error) {panel.innerHTML = `<p class="inline-message">无法读取内容：${e(error.message)}。请通过网站地址或本地预览打开本页面。</p>`; setStatus('读取失败', 'error');}
