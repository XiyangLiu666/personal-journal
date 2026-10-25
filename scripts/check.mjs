import { readFile, access } from 'node:fs/promises';
import { validateContent } from '../js/content.js';
const data = validateContent(JSON.parse(await readFile(new URL('../data/content.json', import.meta.url), 'utf8')));
const root = new URL('../', import.meta.url);
for (const path of [data.site.heroImage, ...data.photos.map(p=>p.src)]) {
  if (/^https:\/\//.test(path)) continue;
  if (!path.startsWith('assets/') || path.includes('..')) throw new Error(`本地图片应位于 assets 文件夹：${path}`);
  await access(new URL(path,root));
}
for (const path of ['index.html','editor.html','style.css','editor.css','js/app.js','js/editor.js','js/content.js','assets/favicon.svg']) await access(new URL(path, root));
console.log(`内容和资源检查通过：${data.posts.length} 篇日记，${data.photos.length} 张照片。`);
