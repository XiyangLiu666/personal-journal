import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateContent, safeUrl, escapeHTML} from '../js/content.js';
const example = JSON.parse(await readFile(new URL('../data/content.json',import.meta.url),'utf8'));
globalThis.location = {href:'https://example.github.io/journal/index.html',origin:'https://example.github.io'};
test('示例内容与空收藏均可导入',()=>{
  assert.equal(validateContent(structuredClone(example)).site.title,'未完');
  const empty=structuredClone(example);for(const key of ['posts','photos','timeline','favorites'])empty[key]=[];
  assert.doesNotThrow(()=>validateContent(empty));
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
