import {loadContent, validateContent, DRAFT_KEY, safeUrl, escapeHTML as e} from './content.js';
let data;
const main = document.querySelector('#main');
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();main.focus();main.scrollIntoView();});
const titles = {life:['life','生活，一页一页。'],leaf:['leaf','把看见的光，留下来。'],about:['about','关于这个小小的我。'],timeline:['days','走过的日子，都算数。'],favorites:['collection','一些喜欢，一些惦记。'],letter:['to me','写给自己的信。']};
const date = value => e(value.replaceAll('-', ' . '));
const paragraphs = value => value.split(/\n\s*\n/).map(p => `<p>${e(p).replaceAll('\n','<br>')}</p>`).join('');
const sorted = list => [...list].sort((a,b) => b.date.localeCompare(a.date));
const empty = text => `<p class="empty">${text}</p>`;
function postMarkup(post, full = false) {
  return `<article class="journal-entry"><div class="entry-meta"><time datetime="${e(post.date)}">${date(post.date)}</time><span>${e(post.tag)}</span></div><div class="entry-copy"><h2><a href="#life/${encodeURIComponent(post.id)}">${e(post.title)}</a></h2>${paragraphs(full ? post.body : post.body.split(/\n\s*\n/).filter(p=>!p.startsWith('示例文字')).slice(0,2).join('\n\n'))}${!full ? `<a class="read-more" href="#life/${encodeURIComponent(post.id)}">read more <span>↗</span></a>` : ''}</div></article>`;
}
function render() {
  const [requested = 'home', id] = location.hash.slice(1).split('/');
  const page = requested === 'home' || titles[requested] ? requested : 'home';
  document.body.classList.toggle('is-home',page === 'home');
  document.querySelectorAll('[data-page]').forEach(a => {if(a.dataset.page === page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title = `${page === 'home' ? data.site.subtitle : titles[page][0]} · ${data.site.title}`;
  if (page === 'home') {
    main.innerHTML = `<section class="home-scene"><img class="hero-image" src="${e(safeUrl(data.site.heroImage,true))}" alt="${e(data.site.heroAlt)}" fetchpriority="high"><div class="hero-shade"></div><div class="home-caption"><span class="tiny-label">notes on being here</span><h1>${e(data.site.heroLine)}</h1><p>${e(data.site.heroNote)}</p><a href="#life">进入日常 <span>↗</span></a></div><span class="home-side-note">${e(data.site.owner)} &nbsp; / &nbsp; ${e(data.site.location)}</span></section>`;
  } else {
    let body = '';
    let sidebar = '';
    if(page === 'life') {
      const post = data.posts.find(p=>p.id === decodeURIComponentSafe(id));
      body = id ? (post ? `<a class="back-link" href="#life">← all notes</a>${postMarkup(post,true)}` : empty('这一页没有找到。<a href="#life">返回日记</a>')) : `<div class="archive-tools"><span>${String(data.posts.length).padStart(2,'0')} notes</span><label><span class="sr-only">搜索日记</span><input id="search" type="search" placeholder="寻找一段文字…"></label></div><div id="entries">${sorted(data.posts).map(p=>postMarkup(p)).join('') || empty('这一页，等你来写。')}</div>`;
      sidebar = '<span>the everyday</span><p>一些发生过的事，<br>和当时的心情。</p>';
    }
    if(page === 'leaf') {
      body = `<div class="photo-grid">${sorted(data.photos).map((p,i)=>`<figure><button class="photo-button" data-photo="${i}" aria-label="放大：${e(p.title)}"><img src="${e(safeUrl(p.src,true))}" alt="${e(p.alt)}" loading="lazy"><span>view photograph ↗</span></button><figcaption><div><h2>${e(p.title)}</h2><time>${date(p.date)}</time></div><p>${e(p.caption)}</p></figcaption></figure>`).join('') || empty('还没有照片，先留一点空白。')}</div>`;
      sidebar = '<span>the things I see</span><p>光，影子，<br>和一瞬间。</p>';
    }
    if(page === 'about') {
      body = `<div class="about-layout"><div class="about-photo"><img src="${e(safeUrl(data.site.heroImage,true))}" alt="${e(data.site.heroAlt)}"><span>somewhere, sometime.</span></div><article class="prose"><span class="tiny-label">hello, this is</span><h2>${e(data.site.owner)}</h2>${paragraphs(data.site.intro)}<div class="small-rule"></div>${paragraphs(data.site.about)}<p class="location">${e(data.site.location)}</p></article></div>`;
      sidebar = '<span>a little about me</span>';
    }
    if(page === 'timeline') {
      body = `<div class="timeline">${sorted(data.timeline).map(item=>`<article><time datetime="${e(item.date)}">${date(item.date)}</time><div><h2>${e(item.title)}</h2>${paragraphs(item.body)}</div></article>`).join('') || empty('新的故事，还在路上。')}</div>`;
      sidebar = '<span>along the way</span><p>不用赶路，<br>慢慢经过。</p>';
    }
    if(page === 'favorites') {
      body = `<div class="collections">${data.favorites.map((item,i)=>`<article><span class="collection-number">${String(i+1).padStart(2,'0')} / ${e(item.category)}</span><h2>${safeUrl(item.url) ? `<a href="${e(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${e(item.title)} ↗</a>` : e(item.title)}</h2>${paragraphs(item.note)}</article>`).join('') || empty('把喜欢的事物，慢慢收集起来。')}</div>`;
      sidebar = '<span>close to my heart</span><p>书，音乐，远方，<br>还有别的。</p>';
    }
    if(page === 'letter') {
      body = `<article class="letter prose">${paragraphs(data.site.letter)}<p class="signature">${e(data.site.owner)}</p>${data.site.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.site.email) ? `<a class="email-link" href="mailto:${e(data.site.email)}">${e(data.site.email)} ↗</a>` : ''}</article>`;
      sidebar = '<span>a letter, to myself</span>';
    }
    main.innerHTML = `<section class="paper-page"><div class="page-heading"><div><span class="tiny-label">a personal archive / ${e(titles[page][0])}</span><h1>${titles[page][0]}<span>.</span></h1></div><p>${titles[page][1]}</p></div><div class="page-layout"><aside>${sidebar}<span class="aside-mark">未<br>完</span></aside><div class="page-body">${body}</div></div><div class="page-end"><span>— ${e(data.site.title)} —</span><a href="#home">back home ↗</a></div></section>`;
    document.querySelector('#search')?.addEventListener('input', event=>{
      const q = event.target.value.trim().toLowerCase();
      const results = sorted(data.posts).filter(p=>`${p.title} ${p.body} ${p.tag}`.toLowerCase().includes(q));
      document.querySelector('#entries').innerHTML = results.map(p=>postMarkup(p)).join('') || empty('没有找到这段文字。');
    });
    document.querySelectorAll('[data-photo]').forEach(button=>button.addEventListener('click',()=>{
      const photo = sorted(data.photos)[Number(button.dataset.photo)];
      const dialog = document.querySelector('#photo-dialog');
      dialog.querySelector('img').src = safeUrl(photo.src,true);
      dialog.querySelector('img').alt = photo.alt;
      dialog.querySelector('p').textContent = `${photo.title} · ${photo.caption}`;
      dialog.showModal();
    }));
  }
  window.scrollTo(0,0);
}
function decodeURIComponentSafe(value) {try{return decodeURIComponent(value || '');}catch{return '';}}
document.querySelector('.photo-close').addEventListener('click',()=>document.querySelector('#photo-dialog').close());
document.querySelector('#photo-dialog').addEventListener('click',event=>{if(event.target.id === 'photo-dialog')event.target.close();});
try {
  data = await loadContent();
  if(new URLSearchParams(location.search).get('draft') === '1') {
    const draft = localStorage.getItem(DRAFT_KEY);
    if(draft) {data = validateContent(JSON.parse(draft));document.querySelector('#draft-banner').hidden = false;}
  }
  document.querySelector('#wordmark').textContent = data.site.title;
  document.querySelector('#since').textContent = `${data.site.subtitle} · since ${data.site.since}`;
  document.querySelector('#footer-year').textContent = data.site.since;
  render();
  window.addEventListener('hashchange',render);
} catch(error) {
  document.body.classList.remove('is-home');
  main.innerHTML = `<p class="load-error">暂时无法打开内容：${e(error.message)}<br>请通过本地预览服务器或 GitHub Pages 访问。<br><a href="index.html">重新加载网站</a></p>`;
}
