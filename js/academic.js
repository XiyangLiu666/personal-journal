// 学术经历：数据校验、简易标记渲染，以及生成学术主页 index.html。
// 内容存放在学术主页仓库 XiyangLiu666.github.io 的 data/academic.json 中。
// 标记写法：**粗体**  __下划线__  *斜体*  [文字](链接)
export const ACADEMIC_ORIGIN = 'https://xiyangliu666.github.io/';
export const ACADEMIC_PATH = 'data/academic.json';
export const ACADEMIC_PREVIEW_KEY = 'meantime-journal-academic-preview-v1';

const esc = value => String(value ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

export const KINDS = ['text', 'list', 'journal', 'conference', 'patent'];
export const STRUCTURED = ['journal', 'conference', 'patent'];
export const KIND_LABELS = {list: '列表', text: '段落', journal: '期刊论文（自动编号）', conference: '会议论文（自动编号）', patent: '专利'};

export function validateAcademic(data) {
  if (!data || typeof data !== 'object' || !data.profile || typeof data.profile !== 'object') throw new Error('学术经历需要包含 profile。');
  for (const key of ['name', 'nameZh', 'photo', 'affiliation', 'contact']) if (typeof (data.profile[key] ?? '') !== 'string') throw new Error(`profile.${key} 必须是文字。`);
  if (!String(data.profile.name || '').trim()) throw new Error('请填写英文名字。');
  if (!Array.isArray(data.sections)) throw new Error('sections 必须是列表。');
  const ids = new Set();
  for (const section of data.sections) {
    if (!section || typeof section.title !== 'string' || !section.title.trim()) throw new Error('每个学术板块都需要标题。');
    if (typeof section.id !== 'string' || !section.id.trim() || ids.has(section.id)) throw new Error(`板块“${section.title}”的编号为空或重复。`);
    ids.add(section.id);
    if (!Array.isArray(section.groups)) throw new Error(`板块“${section.title}”缺少内容分组。`);
    for (const group of section.groups) {
      if (!group || !KINDS.includes(group.kind) || !Array.isArray(group.items)) throw new Error(`板块“${section.title}”中有格式不正确的分组。`);
      if (['text', 'list'].includes(group.kind) && group.items.some(item => typeof item !== 'string')) throw new Error(`板块“${section.title}”中有格式不正确的条目。`);
      if (STRUCTURED.includes(group.kind)) for (const item of group.items) {
        if (!item || typeof item !== 'object' || typeof item.title !== 'string' || !item.title.trim()) throw new Error(`板块“${section.title}”中有条目没有题目。`);
        if (typeof item.id !== 'string' || !item.id) throw new Error(`板块“${section.title}”中有条目缺少编号。`);
        for (const key of group.kind === 'patent' ? ['inventors'] : ['authors']) if (!Array.isArray(item[key] ?? [])) throw new Error(`“${item.title}”的${key === 'inventors' ? '发明人' : '作者'}格式不正确。`);
      }
    }
  }
  return data;
}

function safeHref(url) {
  const value = url.trim();
  if (/^(https?:|mailto:)/i.test(value) || value.startsWith('#')) return value;
  return '';
}
function formatText(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>');
}
// link(text, href) 决定链接的 HTML 形式，两个网站各用各的样式。
export function renderInline(source, link = (text, href) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`) {
  const links = [];
  const marked = String(source ?? '').replace(/\[([^\[\]]+)\]\(([^()\s]+)\)/g, (_, text, href) => {
    const safe = safeHref(href);
    links.push(safe ? link(formatText(text), safe) : formatText(text));
    return `\u0000${links.length - 1}\u0000`;
  });
  return formatText(marked).replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]);
}

export const splitItems = value => String(value ?? '').split(/\n\s*\n/).map(item => item.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
export const joinItems = items => items.join('\n\n');
export const photoUrl = photo => photo ? new URL(photo, ACADEMIC_ORIGIN).href : '';

// 作者名缩写：Xiyang Liu → X. Liu
export function shortName(given, family) {
  const initials = String(given || '').trim().split(/\s+/).filter(Boolean).map(part => part.split('-').map(p => p ? p[0].toUpperCase() + '.' : '').join('-')).join(' ');
  return [initials, String(family || '').trim()].filter(Boolean).join(' ');
}
function selfNames(profile) {
  const names = new Set((profile?.selfNames || []).map(x => x.trim()).filter(Boolean));
  const parts = String(profile?.name || '').trim().split(/\s+/);
  if (parts.length > 1) names.add(shortName(parts.slice(0, -1).join(' '), parts.at(-1)));
  if (profile?.nameZh) names.add(profile.nameZh.trim());
  return names;
}
const joinAuthors = list => list.length < 3 ? list.join(' and ') : `${list.slice(0, -1).join(', ')}, and ${list.at(-1)}`;
const sortKey = item => String(item.date || item.year || '');
export function sortedItems(group) {
  if (group.kind === 'journal' || group.kind === 'conference') return [...group.items].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  return group.items;
}
// 每个分组按显示顺序返回条目的标记文本（论文自动排序、编号）
export function displayItems(group, profile) {
  if (!STRUCTURED.includes(group.kind)) return group.items;
  const mine = selfNames(profile);
  const mark = name => mine.has(String(name).trim()) ? `**__${name}__**` : name;
  const items = sortedItems(group);
  if (group.kind === 'patent') return items.map(item => `${item.title}，发明人：${(item.inventors || []).map(mark).join('，')}${item.number ? `，${item.numberLabel || '公开号'}：${item.number}` : ''}。`);
  const prefix = group.kind === 'journal' ? 'J' : 'C';
  return items.map((item, i) => {
    const year = String(item.year || item.date || '').slice(0, 4);
    const tag = item.abbr ? `${item.abbr}'${year.slice(2)}` : year;
    const title = /[?!？！]$/.test(item.title.trim()) ? `“${item.title.trim()}”` : `“${item.title.trim()},”`;
    const venue = item.venue ? ` **${item.venue}${item.abbr ? ` (${item.abbr})` : ''}**,` : '';
    const tail = (item.extra || year || '').trim().replace(/\.$/, '');
    return `**[${prefix}-${items.length - i}${tag ? `, ${tag}` : ''}]** ${joinAuthors((item.authors || []).map(mark))}, ${title}${venue} ${tail}.${item.url ? ` [[Paper](${item.url})]` : ''}`.replace(/\s+/g, ' ');
  });
}

// 生成与原学术主页（jemdoc 风格）一致的 index.html
export function renderHomepage(data) {
  validateAcademic(data);
  const homeLink = (text, href) => `<a href="${esc(href)}"${/^(mailto:|#)/.test(href) ? '' : ' target="_blank"'}><font color="#8B008B">${text}</font></a>`;
  const inline = value => renderInline(value, homeLink);
  const p = data.profile;
  let affiliation = '';
  for (const line of String(p.affiliation || '').split('\n').map(x => x.trim())) affiliation += line ? `${affiliation ? '\n' : ''}${inline(line)}<br />` : '<br />';
  const nav = data.sections.map(s => `[<a href="#${esc(s.id)}"><font color="#8B008B">${esc(s.nav || s.title)}</font></a>]`).join(' |\n');
  const sections = data.sections.map(section => {
    const body = section.groups.map(group => {
      const heading = group.heading ? `<p style="font-size: 22px;"><b><font color="#483D8B">${inline(group.heading)}</font></b></p>\n` : '';
      const items = displayItems(group, p);
      if (group.kind === 'text') return heading + items.map(item => `<p style="font-size: 20px;">\n${inline(item)}\n</p>`).join('\n');
      const gap = Number.isFinite(group.gap) ? group.gap : 8;
      return `${heading}<ul style="font-size: 20px;">\n${items.map(item => `<li style="margin-bottom: ${gap}px;">${inline(item)}</li>`).join('\n')}\n</ul>`;
    }).join('\n\n');
    return `<a name="${esc(section.id)}"><h2 style="font-size: 25px;"><font color="#483D8B">${esc(section.title)}</font></h2></a>\n${body}`;
  }).join('\n\n');
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head>
<meta name="generator" content="jemdoc, see http://jemdoc.jaboc.net/" />
<meta http-equiv="Content-Type" content="text/html;charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="description" content="${esc(p.description || `Academic homepage of ${p.name}`)}" />
<link rel="stylesheet" href="Files/jemdoc.css" type="text/css" />
<title>${esc(p.name)}</title>
</head>
<!-- 本页由 personal-journal 编辑页根据 data/academic.json 生成。请在编辑页修改内容，直接改这个文件会在下次保存时被覆盖。 -->

<body>
<a id="home" class="anchor"></a>
<div id="container">
<div class="container">

<table class="imgtable"><tr><td>
${p.photo ? `<img src="./${esc(p.photo.replace(/^\.\//, ''))}" alt="${esc(p.name)}" height="300px" />` : ''}&nbsp;</td>
<td align="left">
<p><font size="6">${esc(p.name)}${p.nameZh ? ` (</font><font size="6" style="font-family:Microsoft YaHei">${esc(p.nameZh)}</font><font size="5">) ` : ''}</font></p>
<p style="font-size: 20px;">${affiliation}</p>
<p style="font-size: 20px;">${inline(p.contact)}
</p>

<p style="font-size: 14px;">
${nav}
</p>
</td></tr></table>

${sections}

<br />
<p style="text-align:center; color:#777;">${esc(data.footer || '')}</p>
</div>
</div>
</body>
</html>
`;
}
