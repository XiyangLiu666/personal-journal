export const DRAFT_KEY = 'meantime-journal-draft-v1';
export const collections = ['posts', 'photos', 'timeline', 'favorites'];
export function validateContent(data) {
  if (!data || typeof data !== 'object' || !data.site || typeof data.site !== 'object' || Array.isArray(data.site)) throw new Error('内容需要包含 site 设置。');
  const siteFields = ['title','subtitle','owner','since','heroImage','heroAlt','heroLine','heroNote','intro','about','location','email','letter'];
  for (const key of siteFields) if (typeof data.site[key] !== 'string') throw new Error(`site.${key} 必须是文字。`);
  if (!data.site.title.trim()) throw new Error('请填写网站名称。');
  for (const key of ['lifeBackground','leafBackground','bioBackground','eventBackground']) if (key in data.site && typeof data.site[key] !== 'string') throw new Error(`${key} 必须是图片路径。`);
  const fields = {posts:['id','date','title','tag','body'],photos:['id','date','title','src','alt','caption'],timeline:['id','date','title','body'],favorites:['id','category','title','note','url']};
  for (const key of collections) {
    if (!Array.isArray(data[key])) throw new Error(`${key} 必须是列表。`);
    const ids = new Set();
    for (const item of data[key]) {
      if (!item || fields[key].some(field => typeof item[field] !== 'string')) throw new Error(`${key} 中的记录缺少文字字段。`);
      if (!item.id.trim() || ids.has(item.id)) throw new Error(`${key} 中的记录 ID 不能为空或重复。`);
      ids.add(item.id);
      if ('image' in item && typeof item.image !== 'string') throw new Error('图片路径必须是文字。');
      if (!item.title.trim()) throw new Error(`${key} 中有记录未填写标题。`);
      if ('date' in item) {
        const parsed = new Date(item.date + 'T12:00:00Z');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== item.date) throw new Error('请填写有效的 YYYY-MM-DD 日期。');
      }
    }
  }
  return data;
}
export async function loadContent() {
  const response = await fetch('data/content.json', {cache:'no-store'});
  if (!response.ok) throw new Error('无法读取 data/content.json');
  return validateContent(await response.json());
}
export function safeUrl(value, image = false) {
  if (!value || typeof value !== 'string') return '';
  try {
    const url = new URL(value, location.href);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === location.origin)) return value;
    if (!image && url.protocol === 'mailto:') return value;
  } catch {}
  return '';
}
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
