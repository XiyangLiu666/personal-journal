import {loadContent, validateContent, DRAFT_KEY, collections, escapeHTML as e} from './content.js';
let data, section = 'site', currentId = null;
const panel = document.querySelector('#editor-panel');
const status = document.querySelector('#save-status');
function ask(message) {
  const dialog = document.querySelector('#confirm-dialog');
  document.querySelector('#confirm-message').textContent = message;
  dialog.returnValue = 'cancel';
  dialog.showModal();
  return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue === 'confirm'),{once:true}));
}
const labels = {posts:'日记',photos:'照片',timeline:'时间线',favorites:'收藏'};
const fields = {
  site:[['title','网站名称'],['subtitle','英文副标题'],['owner','你的名字'],['since','开始年份'],['heroImage','封面照片路径','wide'],['heroAlt','封面照片描述','wide'],['heroLine','首页的一句话','wide'],['heroNote','首页英文小字','wide'],['location','所在地 / 当前状态'],['email','邮箱（可留空）'],['intro','简短介绍','textarea'],['about','关于我','textarea'],['letter','写给自己的信','textarea']],
  posts:[['title','标题','wide'],['date','日期','date'],['tag','分类'],['image','照片路径（可留空）','wide'],['body','正文','textarea']],
  photos:[['title','照片标题','wide'],['date','日期','date'],['src','照片路径'],['alt','照片描述（供屏幕阅读器使用）','wide'],['caption','照片说明','textarea']],
  timeline:[['title','标题','wide'],['date','日期','date'],['image','配图路径（可留空）','wide'],['body','记录','textarea']],
  favorites:[['title','标题','wide'],['category','分类'],['url','链接（可留空）'],['image','封面路径（可留空）','wide'],['note','收藏笔记','textarea']]
};
fields.site.push(['lifeBackground','life 背景照片路径','wide'],['leafBackground','leaf 背景照片路径','wide'],['bioBackground','个人介绍 / 收藏背景路径','wide'],['eventBackground','时间线背景照片路径','wide']);
function persist(message = '草稿已保存到当前浏览器') {
  validateContent(data);
  localStorage.setItem(DRAFT_KEY,JSON.stringify(data));
  status.textContent = message;
}
function saveError(error) {status.textContent = `未保存：${error.message}`;}
function formHTML(item) {
  return `<form class="editor-form">${fields[section].map(([key,label,type])=>`<label class="${type === 'wide' || type === 'textarea' ? 'wide' : ''}">${label}${type === 'textarea' ? `<textarea name="${key}" rows="${key === 'body' || key === 'about' ? 8 : 5}">${e(item[key])}</textarea>` : `<input name="${key}" type="${type === 'date' ? 'date' : 'text'}" value="${e(item[key])}" ${['title','date'].includes(key) ? 'required' : ''}>`}${['heroImage','src'].includes(key) ? '<small>上传图片到 assets 后填写 assets/文件名.jpg；也可使用 HTTPS 图片链接。</small>' : ''}</label>`).join('')}<div class="wide form-actions"><button class="save-record" type="submit">${section === 'site' ? '保存网站设置' : '保存这条记录'}</button>${section !== 'site' ? '<button type="button" class="cancel-record delete-record">取消编辑</button>' : ''}</div></form>`;
}
function render() {
  document.querySelectorAll('[data-section]').forEach(button=>{if(button.dataset.section === section)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  if(section === 'site') {
    panel.innerHTML = `<p class="editor-note">先写下你的名字，再慢慢填满这里。正文支持换行与空行分段。</p>${formHTML(data.site)}`;
  } else {
    const list = data[section];
    const item = list.find(x=>x.id===currentId);
    panel.innerHTML = `<div class="editor-panel-heading"><h2>${labels[section]} <span class="tiny-label">/ ${list.length}</span></h2><button class="new-record" type="button">＋ 新增${labels[section]}</button></div><div class="record-list">${list.map(x=>`<div class="record-row"><div><strong>${e(x.title)}</strong><small>${e(x.date || x.category)}</small></div><div><button data-edit="${e(x.id)}">编辑</button><button data-delete="${e(x.id)}">删除</button></div></div>`).join('') || '<p class="editor-empty">还没有记录。写下第一条吧。</p>'}</div>${item ? formHTML(item) : ''}`;
    panel.querySelector('.new-record').addEventListener('click',async()=>{
      if(!await canLeave())return;
      currentId = `entry-${crypto.randomUUID()}`;
      const item = Object.fromEntries(fields[section].map(([key])=>[key,'']));
      item.id = currentId;
      item.title = `未命名${labels[section]}`;
      if('date' in item) {const now = new Date();item.date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
      if(section === 'photos') item.src = 'assets/hero.jpg';
      const next = structuredClone(data);next[section].unshift(item);
      try {validateContent(next);localStorage.setItem(DRAFT_KEY,JSON.stringify(next));data = next;render();status.textContent='新记录已加入草稿，请修改并保存';panel.querySelector('[name="title"]').focus();}catch(error){saveError(error);}
    });
    panel.querySelectorAll('[data-edit]').forEach(button=>button.addEventListener('click',async()=>{if(await canLeave()){currentId=button.dataset.edit;render();}}));
    panel.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',async()=>{
      const item = data[section].find(x=>x.id===button.dataset.delete);
      if(await ask(`从草稿中删除“${item.title}”？已发布内容会在你导出并提交 GitHub 后才改变。`)) {
        const before = data[section]; data[section] = before.filter(x=>x.id!==item.id);
        try{persist('记录已从草稿删除');if(currentId===item.id)currentId=null;render();}catch(error){data[section]=before;saveError(error);}
      }
    }));
    panel.querySelector('.cancel-record')?.addEventListener('click',async()=>{if(await canLeave()){currentId=null;render();}});
  }
  panel.querySelector('form')?.addEventListener('submit', event=>{event.preventDefault();commitForm();});
  panel.querySelector('form')?.addEventListener('input',()=>{status.textContent='有未保存的编辑 · 请点击保存';});
}
function isDirty() {
  const form = panel.querySelector('form');
  if(!form)return false;
  const source = section === 'site' ? data.site : data[section].find(x=>x.id===currentId);
  return [...new FormData(form)].some(([key,value])=>(source[key] ?? '')!==value);
}
async function canLeave(){return !isDirty() || await ask('当前表单尚未保存，放弃这部分编辑？');}
function commitForm() {
  const form = panel.querySelector('form');
  if(!form || !isDirty())return true;
  if(!form.reportValidity())return false;
  const next = structuredClone(data);
  const target = section === 'site' ? next.site : next[section].find(x=>x.id===currentId);
  for(const [key,value] of new FormData(form)) target[key]=value;
  try {validateContent(next);localStorage.setItem(DRAFT_KEY,JSON.stringify(next));data=next;status.textContent='草稿已保存到当前浏览器';render();return true;}catch(error){saveError(error);return false;}
}
document.querySelectorAll('[data-section]').forEach(button=>button.addEventListener('click',async()=>{if(data && await canLeave()){section=button.dataset.section;currentId=null;render();}}));
document.querySelector('#preview').addEventListener('click',()=>{
  if(!data || !commitForm())return;
  try{persist();window.open(`index.html?draft=1#${section === 'site' ? 'home' : section === 'posts' ? 'life' : section === 'photos' ? 'leaf' : section}`, '_blank', 'noopener');}catch(error){saveError(error);}
});
document.querySelector('#export').addEventListener('click',()=>{
  if(!data || !commitForm())return;
  try {
    validateContent(data);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='content.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent='已导出 · 上传替换 GitHub 中的 data/content.json 后发布';
  }catch(error){saveError(error);}
});
document.querySelector('#import').addEventListener('change',async event=>{
  const file = event.target.files[0];if(!file)return;
  try {
    const imported=validateContent(JSON.parse(await file.text()));
    if(!await ask('用导入文件替换当前浏览器草稿？建议先导出现有内容备份。'))return;
    localStorage.setItem(DRAFT_KEY,JSON.stringify(imported));data=imported;currentId=null;render();status.textContent='内容已导入并保存为本地草稿';
  }catch(error){status.textContent=`导入失败：${error.message}`;}finally{event.target.value='';}
});
document.querySelector('#reset').addEventListener('click',async()=>{
  if(!await ask('丢弃所有本地草稿并重新读取网站文件？请先导出需要保留的内容。'))return;
  try{const published=await loadContent();localStorage.removeItem(DRAFT_KEY);data=published;currentId=null;render();status.textContent='已重新读取网站文件';}catch(error){saveError(error);}
});
window.addEventListener('beforeunload',event=>{if(data && isDirty()){event.preventDefault();event.returnValue='';}});
try {
  data = await loadContent();
  try{const stored=localStorage.getItem(DRAFT_KEY);if(stored)data=validateContent(JSON.parse(stored));}catch(error){status.textContent=`浏览器草稿不可用，已载入网站文件：${error.message}`;}
  render();if(!status.textContent.includes('不可用'))status.textContent='内容已载入 · 可开始编辑';
}catch(error){panel.innerHTML=`<p class="inline-message">无法读取内容：${e(error.message)}。请通过 HTTP 预览访问本页面。</p>`;status.textContent='读取失败';}
