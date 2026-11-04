import {loadContent, validateContent, DRAFT_KEY, PREVIEW_KEY, safeUrl, escapeHTML as e} from './content.js';
import {rawUrl} from './github.js';
import {ACADEMIC_ORIGIN, ACADEMIC_PATH, ACADEMIC_PREVIEW_KEY, validateAcademic, renderInline, photoUrl, displayItems} from './academic.js';
let data, academic = null, academicError = '', academicLoading = null;
const isDraft = new URLSearchParams(location.search).get('draft')==='1';
const main = document.querySelector('#main');
const titles = {life:'life',leaf:'leaf',about:'history',timeline:'event',favorites:'collection',letter:'to me',academic:'academic'};
const backgrounds = {life:['lifeBackground','assets/life-background.jpg'],leaf:['leafBackground','assets/leaf-background.jpg'],about:['bioBackground','assets/bio-background.jpg'],favorites:['bioBackground','assets/bio-background.jpg'],timeline:['eventBackground','assets/event-background.jpg'],letter:['leafBackground','assets/leaf-background.jpg'],academic:['bioBackground','assets/bio-background.jpg']};
const paragraphs = value => String(value || '').split(/\n\s*\n/).map(p=>`<p>${e(p).replaceAll('\n','<br>')}</p>`).join('');
const sorted = list => [...list].sort((a,b)=>b.date.localeCompare(a.date));
const decode = value => {try{return decodeURIComponent(value || '');}catch{return '';}};
const image = (src,alt,attributes='') => safeUrl(src,true) ? `<img src="${e(safeUrl(src,true))}" alt="${e(alt)}" ${attributes}>` : '';
const empty = text => `<p class="reference-empty">${text}</p>`;
const close = '<a class="panel-close" href="#home" aria-label="关闭面板，返回首页">×</a>';
function panel(title,body,kind='') {return `<section class="reference-panel ${kind}"><header class="panel-heading"><h1>${e(title)}</h1>${close}</header><div class="panel-content">${body}</div></section>`;}
function bioMenu(active) {return `<aside class="reference-panel reference-menu"><header class="panel-heading"><h2>bio</h2>${close}</header><nav aria-label="个人资料分类"><a href="#favorites" ${active==='favorites'?'aria-current="page"':''}>collection</a><a href="#about" ${active==='about'?'aria-current="page"':''}>history</a></nav></aside>`;}
function streamItem(item,type,index) {
  const isPost = type === 'life';
  const src = isPost ? item.image : item.src;
  const body = isPost ? item.body : item.caption;
  const title = e(item.title);
  return `<article class="stream-entry" id="entry-${e(item.id)}">${src ? `<button class="stream-photo" data-photo="${index}" data-kind="${type}" aria-label="放大：${title}">${image(src,item.alt || item.title,index===0?'fetchpriority="high"':'loading="lazy"')}</button>`:''}<div class="stream-caption"><h2><a href="#${type}/${encodeURIComponent(item.id)}">${title}</a></h2>${paragraphs(body)}<time datetime="${e(item.date)}">${e(item.date.replaceAll('-','.'))}</time></div></article>`;
}
function loadAcademic() {
  if(academicLoading) return academicLoading;
  academicLoading = (async()=>{
    try {
      const preview = isDraft && localStorage.getItem(ACADEMIC_PREVIEW_KEY);
      if(preview) {academic = validateAcademic(JSON.parse(preview)); return;}
      const response = await fetch(`${ACADEMIC_ORIGIN}${ACADEMIC_PATH}?t=${Date.now()}`, {cache:'no-store'});
      if(!response.ok) throw new Error('无法读取学术经历');
      academic = validateAcademic(await response.json());
    } catch(error) {academicError = error.message || '无法读取学术经历';}
  })();
  return academicLoading;
}
function academicHTML() {
  const outlineLinks = academic ? academic.sections.map((section,i)=>`<button type="button" data-jump="academic-${i}" data-outline="${i}">${e(section.nav || section.title)}</button>`).join('') : '';
  const outline = `<aside class="reference-panel reference-menu academic-outline"><header class="panel-heading"><h2>outline</h2></header><nav aria-label="学术经历大纲">${outlineLinks}<a class="academic-homepage-link" href="${ACADEMIC_ORIGIN}" target="_blank" rel="noopener noreferrer">homepage ↗</a></nav></aside>`;
  let body;
  if(!academic) body = academicError ? empty(`${e(academicError)}。<a href="${ACADEMIC_ORIGIN}" target="_blank" rel="noopener noreferrer">打开学术主页 ↗</a>`) : empty('正在打开学术经历……');
  else {
    const p = academic.profile;
    const lines = String(p.affiliation || '').split(/\n\s*\n/).map(block=>`<p>${block.split('\n').map(line=>renderInline(line)).join('<br>')}</p>`).join('');
    const photo = photoUrl(p.photo);
    const sections = academic.sections.map((section,i)=>`<section class="academic-section" id="academic-${i}"><h2>${e(section.title)}</h2>${section.groups.map(group=>`${group.heading?`<h3>${renderInline(group.heading)}</h3>`:''}${group.kind==='text'?displayItems(group,p).map(item=>`<p>${renderInline(item)}</p>`).join(''):`<ul>${displayItems(group,p).map(item=>`<li>${renderInline(item)}</li>`).join('')}</ul>`}`).join('')}</section>`).join('');
    body = `<article class="academic-profile">${photo?`<img src="${e(photo)}" alt="${e(p.name)}">`:''}<div><h2>${e(p.name)}${p.nameZh?` <span>${e(p.nameZh)}</span>`:''}</h2>${lines}<p class="academic-contact">${renderInline(p.contact)}</p></div></article>${sections}<p class="academic-edit"><a href="editor.html#academic">edit</a></p>`;
  }
  return `<div class="academic-columns">${outline}${panel('academic',body,'academic-panel')}</div>`;
}
let outlineObserver;
function watchOutline() {
  outlineObserver?.disconnect();
  const buttons=[...main.querySelectorAll('[data-outline]')];
  if(!buttons.length || !('IntersectionObserver' in window)) return;
  outlineObserver=new IntersectionObserver(entries=>{
    const visible=entries.filter(x=>x.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
    if(!visible) return;
    const index=visible.target.id.replace('academic-','');
    buttons.forEach(b=>{if(b.dataset.outline===index)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});
  },{rootMargin:'-80px 0px -65% 0px'});
  main.querySelectorAll('.academic-section').forEach(section=>outlineObserver.observe(section));
}
function openViewer(href, title) {
  let viewer = document.querySelector('#link-viewer');
  if(!viewer) {
    viewer = document.createElement('aside');
    viewer.id = 'link-viewer';
    viewer.className = 'reference-panel link-viewer';
    viewer.innerHTML = '<header class="panel-heading"><h2></h2><a class="viewer-open" target="_blank" rel="noopener noreferrer">新窗口打开 ↗</a><button type="button" class="panel-close viewer-close" aria-label="关闭">×</button></header><p class="viewer-note">如果下面一直是空白或显示拒绝连接，说明这个网站不允许嵌入，请点右上角在新窗口打开。</p><div class="viewer-frame"><span class="viewer-loading">正在打开……</span><iframe title="链接内容" referrerpolicy="no-referrer-when-downgrade"></iframe></div>';
    document.body.append(viewer);
    viewer.querySelector('.viewer-close').addEventListener('click', closeViewer);
    viewer.querySelector('iframe').addEventListener('load', () => viewer.classList.add('is-loaded'));
  }
  viewer.querySelector('h2').textContent = title;
  viewer.querySelector('.viewer-open').href = href;
  viewer.classList.remove('is-loaded');
  viewer.querySelector('iframe').src = href;
  viewer.hidden = false;
  document.body.classList.add('has-viewer');
}
function closeViewer() {
  const viewer = document.querySelector('#link-viewer');
  if(!viewer) return;
  viewer.hidden = true;
  viewer.querySelector('iframe').src = 'about:blank';
  document.body.classList.remove('has-viewer');
}
document.addEventListener('keydown', event => {if(event.key === 'Escape') closeViewer();});
function bindAcademic() {
  main.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.jump)?.scrollIntoView({behavior:'smooth',block:'start'})));
  watchOutline();
  main.querySelectorAll('.academic-section a[href^="http"]').forEach(link=>link.addEventListener('click',event=>{
    if(event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    const item = link.closest('li, p');
    const title = link.textContent.trim().toLowerCase() === 'paper' && item ? item.textContent.match(/“([^”]+)”/)?.[1] || link.textContent : link.textContent;
    openViewer(link.href, title.replace(/,$/, ''));
  }));
}
function render() {
  closeViewer();
  const [requested='home',routeId] = location.hash.slice(1).split('/');
  const page = requested === 'home' || titles[requested] ? requested : 'home';
  document.body.classList.toggle('is-home',page==='home');
  document.body.classList.toggle('is-reference',page!=='home');
  document.body.dataset.view=page;
  const backdrop = document.querySelector('#page-backdrop');
  if(page!=='home') {const [key,fallback]=backgrounds[page];backdrop.src=safeUrl(data.site[key] || fallback,true);backdrop.hidden=false;} else {backdrop.hidden=true;backdrop.removeAttribute('src');}
  document.querySelectorAll('[data-page]').forEach(link=>{if(link.dataset.page===page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  document.title=`${page==='home'?data.site.subtitle:titles[page]} · ${data.site.title}`;
  if(page==='home') {
    main.innerHTML=`<section class="home-scene"><img class="hero-image" src="${e(safeUrl(data.site.heroImage,true))}" alt="${e(data.site.heroAlt)}" fetchpriority="high"><div class="hero-shade"></div><div class="home-caption"><span class="tiny-label">notes on being here</span><h1>${e(data.site.heroLine)}</h1><p>${e(data.site.heroNote)}</p><a href="#life">进入日常 <span>↗</span></a><a class="academic-entry" href="#academic">学术经历 <span>↗</span></a></div><span class="home-side-note">${e(data.site.owner)} &nbsp; / &nbsp; ${e(data.site.location)}</span></section>`;
  } else if(page==='life' || page==='leaf') {
    const entries=sorted(page==='life'?data.posts:data.photos);
    const selected=routeId ? entries.filter(item=>item.id===decode(routeId)) : entries;
    main.innerHTML=`<section class="reference-stream"><header class="stream-heading"><h1>${page}</h1></header>${selected.map(item=>streamItem(item,page,entries.indexOf(item))).join('') || empty('这一页还没有记录。')}${routeId?`<a class="stream-return" href="#${page}">← all ${page}</a>`:'<div class="stream-end">· · ·</div>'}</section>`;
  } else if(page==='about') {
    main.innerHTML=`<div class="reference-columns">${panel('history',`${image(data.site.heroImage,data.site.heroAlt,'class="bio-banner"')}<article class="reference-biography"><h2>${e(data.site.owner)}</h2>${paragraphs(data.site.intro)}${paragraphs(data.site.about)}<p>${e(data.site.location)}</p></article><div class="history-records">${sorted(data.timeline).map(item=>`<article><time>${e(item.date)}</time><div><h3>${e(item.title)}</h3>${paragraphs(item.body)}</div></article>`).join('')}</div>`,'bio-panel')}${bioMenu('about')}</div>`;
  } else if(page==='favorites') {
    const categories=[...new Set(data.favorites.map(item=>item.category))];
    const body=`${image(data.site.heroImage,data.site.heroAlt,'class="bio-banner"')}<nav class="collection-tabs" aria-label="收藏分类">${categories.map((category,i)=>`<button type="button" data-jump="category-${i}">${e(category)}</button>`).join('<span>｜</span>')}</nav>${categories.map((category,i)=>`<section class="collection-category" id="category-${i}"><h2>${e(category)}</h2><div class="reference-catalog">${data.favorites.filter(item=>item.category===category).map(item=>`<article>${image(item.image || data.site.heroImage,item.title,'loading="lazy"')}<div><h3>${safeUrl(item.url)?`<a href="${e(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${e(item.title)}</a>`:e(item.title)}</h3>${paragraphs(item.note)}</div></article>`).join('')}</div><button class="catalog-top" data-top type="button">top</button></section>`).join('') || empty('还没有收藏。')}`;
    main.innerHTML=`<div class="reference-columns">${panel('collection',body,'bio-panel')}${bioMenu('favorites')}</div>`;
  } else if(page==='timeline') {
    const entries=sorted(data.timeline);
    const current=Math.max(0,Math.min(entries.length-1,Number.parseInt(routeId || '1',10)-1 || 0));
    const item=entries[current];
    main.innerHTML=panel('event',item?`<article class="reference-event"><h2>${e(item.title)}</h2><div class="event-copy">${paragraphs(item.body)}${image(item.image,item.title,'class="event-image"')}<time>${e(item.date)}</time></div></article><nav class="reference-pagination" aria-label="记录翻页">${current>0?`<a href="#timeline/${current}">← prev</a>`:'<span>← prev</span>'}<span>｜</span>${entries.map((_,i)=>`<a href="#timeline/${i+1}" ${i===current?'aria-current="page"':''}>${i+1}</a>`).join(' ')}<span>｜</span>${current<entries.length-1?`<a href="#timeline/${current+2}">next →</a>`:'<span>next →</span>'}</nav>`:empty('新的记录，还在路上。'),'event-panel');
  } else if(page==='academic') {
    main.innerHTML=academicHTML();
    if(!academic && !academicError) loadAcademic().then(()=>{if(document.body.dataset.view==='academic'){main.innerHTML=academicHTML();bindAcademic();}});
  } else if(page==='letter') {
    main.innerHTML=panel('to me',`<article class="reference-letter">${paragraphs(data.site.letter)}<p class="letter-signature">${e(data.site.owner)}</p>${data.site.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.site.email)?`<a href="mailto:${e(data.site.email)}">${e(data.site.email)}</a>`:''}</article>`,'letter-panel');
  }
  main.querySelectorAll('[data-photo]').forEach(button=>button.addEventListener('click',()=>{
    const isPost=button.dataset.kind==='life';
    const item=sorted(isPost?data.posts:data.photos)[Number(button.dataset.photo)];
    const dialog=document.querySelector('#photo-dialog');
    dialog.querySelector('img').src=safeUrl(isPost?item.image:item.src,true);
    dialog.querySelector('img').alt=item.alt || item.title;
    dialog.querySelector('p').textContent=item.title;
    dialog.showModal();
  }));
  bindAcademic();
  main.querySelectorAll('[data-top]').forEach(button=>button.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'})));
  window.scrollTo({top:0,left:0,behavior:'instant'});
}
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();main.focus();main.scrollIntoView();});
document.querySelector('.photo-close').addEventListener('click',()=>document.querySelector('#photo-dialog').close());
document.querySelector('#photo-dialog').addEventListener('click',event=>{if(event.target.id==='photo-dialog')event.target.close();});
try {
  data=await loadContent();
  if(isDraft) {
    const draft=localStorage.getItem(PREVIEW_KEY) || localStorage.getItem(DRAFT_KEY);
    // 预览时，刚上传、尚未部署的照片直接从仓库读取
    if(draft){data=validateContent(JSON.parse(draft.replaceAll('"assets/uploads/',`"${rawUrl('assets/uploads/')}`)));document.querySelector('#draft-banner').hidden=false;}
  }
  document.querySelector('#wordmark').textContent=data.site.title;
  document.querySelector('#since').textContent=`${data.site.subtitle} · since ${data.site.since}`;
  document.querySelector('#footer-year').textContent=data.site.since;
  render();
  window.addEventListener('hashchange',render);
} catch(error) {
  document.body.classList.remove('is-home','is-reference');
  main.innerHTML=`<p class="load-error">暂时无法打开内容：${e(error.message)}<br>请通过本地预览服务器或 GitHub Pages 访问。<br><a href="index.html">重新加载网站</a></p>`;
}
