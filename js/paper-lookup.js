// 根据论文链接自动识别论文信息。支持 IEEE Xplore 链接、DOI（或 doi.org 链接）和 arXiv 链接。
// 数据来源：Crossref、OpenAlex、DataCite 的公开接口（都允许网页直接读取）。
import {shortName} from './academic.js';

const JOURNAL_ABBR = {TCOMM: 'TCOM', TWC: 'TWC', JSAC: 'JSAC', TVT: 'TVT', JIOT: 'IoT-J', TMC: 'TMC', TAES: 'TAES', TNSE: 'TNSE', LCOMM: 'COMML', LWC: 'WCL', TNET: 'ToN', TSP: 'TSP', TIT: 'TIT', TNS: 'TNS', COMST: 'COMST', MCOM: 'ComMag', MWC: 'WCM', MNET: 'NetMag', OJCOMS: 'OJ-COMS', TCCN: 'TCCN', TGCN: 'TGCN', TII: 'TII', TPDS: 'TPDS', TDSC: 'TDSC', TIFS: 'TIFS', TSC: 'TSC', TCC: 'TCC', TETC: 'TETC', JSTSP: 'JSTSP'};
const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];

async function getJSON(url) {
  let response;
  try {response = await fetch(url, {headers: {Accept: 'application/json'}});}
  catch {throw new Error('网络连接失败，请稍后重试');}
  if (!response.ok) {const error = new Error(`查询失败（${response.status}）`); error.status = response.status; throw error;}
  return response.json();
}
const dateFrom = parts => {
  const [y, m, d] = parts || [];
  return [y, m && String(m).padStart(2, '0'), d && String(d).padStart(2, '0')].filter(Boolean).join('-');
};
export const findDoi = text => {
  const match = String(text).match(/10\.\d{4,9}\/[^\s"<>?#]+/i);
  return match ? match[0].replace(/[).,;]+$/, '') : '';
};

export function fromCrossref(work, url = '') {
  const kind = work.type === 'proceedings-article' ? 'conference' : 'journal';
  const authors = (work.author || []).filter(a => a.family || a.name).map(a => a.family ? shortName(a.given, a.family) : a.name);
  const issued = work['published-print']?.['date-parts']?.[0] || work['published-online']?.['date-parts']?.[0] || work.issued?.['date-parts']?.[0] || [];
  const code = String(work.DOI || '').split('/')[1]?.split('.')[0]?.replace(/\d+$/, '').toUpperCase() || '';
  let venue = (work['container-title'] || [])[0] || '', abbr = '', extra = '', date = dateFrom(issued);
  if (kind === 'conference') {
    const event = work.event || {};
    let name = (event.name || venue).replace(/\s+/g, ' ').trim();
    const lead = name.match(/^([A-Za-z][A-Za-z-]*)\s+\d{4}\s*[-–:]\s*(.+)$/);
    if (lead) {abbr = lead[1]; name = lead[2];}
    name = name.replace(/^\d{4}\s+/, '').replace(/\s+\d{4}$/, '');
    const tail = name.match(/^(.*?)\s*\(([A-Za-z][A-Za-z-]*)\)$/);
    if (tail) {name = tail[1]; abbr ||= tail[2];}
    venue = name;
    abbr ||= code;
    const start = event.start?.['date-parts']?.[0], end = event.end?.['date-parts']?.[0];
    if (start?.length >= 3) {
      date = dateFrom(start);
      const sameMonth = end && end[0] === start[0] && end[1] === start[1];
      const range = end?.length >= 3 ? (sameMonth ? `${MONTHS[start[1] - 1]} ${start[2]}–${end[2]}` : `${MONTHS[start[1] - 1]} ${start[2]}–${MONTHS[end[1] - 1]} ${end[2]}`) : `${MONTHS[start[1] - 1]} ${start[2]}`;
      const place = String(event.location || '').replace(/,\s*[A-Z]{2}(?=,)/, '').trim();
      extra = [place, `${range}, ${start[0]}`].filter(Boolean).join(', ');
    }
  } else {
    abbr = JOURNAL_ABBR[code] || (work['short-container-title'] || [])[0] || code;
    if (work.volume) extra = [`vol. ${work.volume}`, work.issue && `no. ${work.issue}`, work.page && `pp. ${work.page.replace('-', '–')}`, issued[0]].filter(Boolean).join(', ');
  }
  const year = String(issued[0] || date.slice(0, 4) || '');
  return {kind, item: {authors, title: String((work.title || [''])[0]).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), venue: venue.trim(), abbr, year, date: date || year, extra, url: url || (work.DOI ? `https://doi.org/${work.DOI}` : ''), doi: work.DOI || ''}};
}

async function byDoi(doi, url) {
  const result = await getJSON(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  return fromCrossref(result.message, url);
}
async function byIeeeNumber(number, url) {
  // IEEE 在 Crossref 中登记的 alternative-id 就是 Xplore 的文章编号
  try {
    const result = await getJSON(`https://api.crossref.org/works?filter=prefix:10.1109,alternative-id:${number}&rows=1`);
    const work = result.message?.items?.[0];
    if (work) return fromCrossref(work, url);
  } catch {}
  for (const landing of [`https://ieeexplore.ieee.org/document/${number}/`, `https://ieeexplore.ieee.org/document/${number}`]) {
    try {
      const result = await getJSON(`https://api.openalex.org/works?filter=locations.landing_page_url:${encodeURIComponent(landing)}&select=doi`);
      const doi = result.results?.[0]?.doi;
      if (doi) return byDoi(doi.replace(/^https?:\/\/doi\.org\//, ''), url);
    } catch {}
  }
  return null;
}
async function byArxiv(id) {
  const result = await getJSON(`https://api.datacite.org/dois/${encodeURIComponent(`10.48550/arxiv.${id}`)}`);
  const a = result.data.attributes;
  const year = String(a.publicationYear || '');
  const submitted = (a.dates || []).find(x => x.dateType === 'Submitted' || x.dateType === 'Issued')?.date?.slice(0, 10) || year;
  return {kind: 'journal', item: {authors: (a.creators || []).map(c => c.familyName ? shortName(c.givenName, c.familyName) : c.name), title: String(a.titles?.[0]?.title || '').replace(/\s+/g, ' ').trim(), venue: 'arXiv preprint', abbr: '', year, date: submitted, extra: `arXiv:${id}, ${year}`, url: `https://arxiv.org/abs/${id}`, doi: `10.48550/arXiv.${id}`}};
}

export async function lookupPaper(input) {
  const text = String(input || '').trim();
  if (!text) throw new Error('请先粘贴论文链接');
  const ieee = text.match(/ieeexplore\.ieee\.org\/(?:abstract\/)?document\/(\d+)/i);
  if (ieee) {
    const url = `https://ieeexplore.ieee.org/document/${ieee[1]}`;
    const found = await byIeeeNumber(ieee[1], url);
    if (found) return found;
    throw new Error('没能从这个 IEEE 链接查到论文信息，可能还没被收录。可以改为粘贴论文页面上的 DOI，或者手动填写');
  }
  const arxiv = text.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/i) || text.match(/^(?:arxiv:)?(\d{4}\.\d{4,5})(?:v\d+)?$/i);
  if (arxiv) return byArxiv(arxiv[1]);
  let decoded = text;
  try {decoded = decodeURIComponent(text);} catch {}
  const doi = findDoi(decoded);
  if (doi) {
    try {return await byDoi(doi, /^https?:/i.test(text) && !/doi\.org/i.test(text) ? text : '');}
    catch (error) {throw new Error(error.status === 404 ? '没有查到这个 DOI，请检查后重试，或者手动填写' : error.message);}
  }
  throw new Error('无法识别这个链接。支持 IEEE Xplore 链接、DOI 和 arXiv 链接，也可以手动填写');
}
