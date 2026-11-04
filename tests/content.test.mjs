import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateContent, safeUrl, escapeHTML} from '../js/content.js';
const example = JSON.parse(await readFile(new URL('../data/content.json',import.meta.url),'utf8'));
globalThis.location = {href:'https://example.github.io/journal/index.html',origin:'https://example.github.io'};
test('示例内容与空收藏均可导入',()=>{
  assert.equal(validateContent(structuredClone(example)).site.title,example.site.title);
  const empty=structuredClone(example);for(const key of ['posts','photos','timeline','favorites'])empty[key]=[];
  assert.doesNotThrow(()=>validateContent(empty));
});
test('旧内容不需要新增图片字段，新增图片路径需为文字',()=>{
  const legacy=structuredClone(example);
  for(const key of ['lifeBackground','leafBackground','bioBackground','eventBackground'])delete legacy.site[key];
  for(const key of ['posts','timeline','favorites'])for(const item of legacy[key])delete item.image;
  assert.doesNotThrow(()=>validateContent(legacy));
  legacy.posts[0].image={};assert.throws(()=>validateContent(legacy),/图片路径/);
});
test('拒绝不完整文件、重复 ID 与错误日期',()=>{
  assert.throws(()=>validateContent({}));
  const duplicate=structuredClone(example);duplicate.posts.push(duplicate.posts[0]);assert.throws(()=>validateContent(duplicate),/ID/);
  const badDate=structuredClone(example);badDate.posts[0].date='hello';assert.throws(()=>validateContent(badDate),/日期/);
  badDate.posts[0].date='2026-02-30';assert.throws(()=>validateContent(badDate),/日期/);
  const badField=structuredClone(example);badField.photos[0].src={};assert.throws(()=>validateContent(badField),/字段/);
});
test('图片路径支持仓库子目录，危险链接被拦截',()=>{
  assert.equal(safeUrl('assets/photo.jpg',true),'assets/photo.jpg');
  assert.equal(safeUrl('https://example.com/photo.jpg',true),'https://example.com/photo.jpg');
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('data:text/html,test'), '');
  assert.equal(safeUrl('mailto:test@example.com',true), '');
  assert.equal(safeUrl('mailto:test@example.com'), 'mailto:test@example.com');
});
test('导入的 HTML 只显示为文字',()=>{
  assert.equal(escapeHTML('<script>"x"</script>'),'&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});
import {validateAcademic, renderInline, renderHomepage, splitItems, displayItems} from '../js/academic.js';
import {fromCrossref, findDoi} from '../js/paper-lookup.js';
const academic = {profile:{name:'Xiyang Liu',nameZh:'刘喜洋',photo:'images/a.jpg',affiliation:'*Ph.D. Candidate*\n[Xidian](https://en.xidian.edu.cn/)\n\n*Visiting*',contact:'Email: [a@b.c](mailto:a@b.c)'},sections:[{id:'Publications',title:'Selected Publications',nav:'Publications',groups:[{heading:'Journal Papers',kind:'list',gap:18,items:['**[J-1]** **__X. Liu__**, “Title,” 2026. [[Paper](https://ieeexplore.ieee.org/document/1)]']}]}],footer:'© 2026'};
test('学术经历标记只生成安全的格式与链接',()=>{
  assert.equal(renderInline('**b** __u__ *i*'),'<b>b</b> <u>u</u> <i>i</i>');
  assert.match(renderInline('[x](https://a.b)'),/<a href="https:\/\/a.b"/);
  assert.doesNotMatch(renderInline('<script>x</script> [y](javascript:void)'),/<script|href="javascript/);
  assert.deepEqual(splitItems('a\nb\n\n\nc'),['a b','c']);
});
test('学术主页按原有 jemdoc 样式生成',()=>{
  const page=renderHomepage(validateAcademic(structuredClone(academic)));
  assert.match(page,/<a name="Publications"><h2 style="font-size: 25px;"><font color="#483D8B">Selected Publications<\/font><\/h2><\/a>/);
  assert.match(page,/<li style="margin-bottom: 18px;"><b>\[J-1\]<\/b> <b><u>X. Liu<\/u><\/b>/);
  assert.match(page,/Xidian<\/font><\/a><br \/><br \/>\n<i>Visiting<\/i>/);
  const dup=structuredClone(academic);dup.sections.push(dup.sections[0]);assert.throws(()=>validateAcademic(dup),/编号/);
});
test('论文按日期从新到旧编号，作者名自动加粗',()=>{
  const profile={name:'Xiyang Liu',nameZh:'刘喜洋'};
  const group={kind:'conference',items:[{id:'a',authors:['X. Liu','W. Bai','M. Sheng'],title:'Old',venue:'IEEE International Conference on Communications',abbr:'ICC',year:'2025',date:'2025-06-08',extra:'Montreal, Canada, Jun. 8–12, 2025',url:'https://x.y/1'},{id:'b',authors:['W. Bai','X. Liu'],title:'New',venue:'IEEE Global Communications Conference',abbr:'GLOBECOM',year:'2026',date:'2026-12',extra:'',url:''}]};
  const out=displayItems(group,profile);
  assert.equal(out[0],'**[C-2, GLOBECOM\'26]** W. Bai and **__X. Liu__**, “New,” **IEEE Global Communications Conference (GLOBECOM)**, 2026.');
  assert.equal(out[1],'**[C-1, ICC\'25]** **__X. Liu__**, W. Bai, and M. Sheng, “Old,” **IEEE International Conference on Communications (ICC)**, Montreal, Canada, Jun. 8–12, 2025. [[Paper](https://x.y/1)]');
  const patents=displayItems({kind:'patent',items:[{id:'p',title:'一种方法',inventors:['盛敏','刘喜洋'],numberLabel:'公开号',number:'CN1A'}]},profile);
  assert.equal(patents[0],'一种方法，发明人：盛敏，**__刘喜洋__**，公开号：CN1A。');
});
test('从 Crossref 数据识别期刊与会议论文',()=>{
  const journal=fromCrossref({type:'journal-article',DOI:'10.1109/TCOMM.2026.1234567',title:['Constellation-Level  Modeling'],'container-title':['IEEE Transactions on Communications'],author:[{given:'Xiyang',family:'Liu'},{given:'Wei-Gang',family:'Bai'}],'published-online':{'date-parts':[[2026,3,2]]},volume:'74',issue:'3',page:'100-115'},'https://ieeexplore.ieee.org/document/11673205');
  assert.equal(journal.kind,'journal');
  assert.deepEqual(journal.item.authors,['X. Liu','W.-G. Bai']);
  assert.equal(journal.item.abbr,'TCOM'); assert.equal(journal.item.date,'2026-03-02'); assert.equal(journal.item.extra,'vol. 74, no. 3, pp. 100–115, 2026');
  const conf=fromCrossref({type:'proceedings-article',DOI:'10.1109/ICC52391.2025.11161010',title:['Impact Analysis'],'container-title':['ICC 2025 - IEEE International Conference on Communications'],author:[{given:'Xiyang',family:'Liu'}],event:{name:'ICC 2025 - IEEE International Conference on Communications',location:'Montreal, QC, Canada',start:{'date-parts':[[2025,6,8]]},end:{'date-parts':[[2025,6,12]]}},issued:{'date-parts':[[2025,6,8]]}});
  assert.equal(conf.kind,'conference'); assert.equal(conf.item.abbr,'ICC'); assert.equal(conf.item.venue,'IEEE International Conference on Communications');
  assert.equal(conf.item.extra,'Montreal, Canada, Jun. 8–12, 2025'); assert.equal(conf.item.url,'https://doi.org/10.1109/ICC52391.2025.11161010');
  assert.equal(findDoi('https://doi.org/10.1109/TCOMM.2026.1234567'),'10.1109/TCOMM.2026.1234567');
});
