// One verified raw response per PNG, shared across every re-render and card.
// Image URLs stay alive for this page lifetime; original art remains unchanged.
const records = new Map();
let active = 0;
const safe = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ensure = path => {
  if (!records.has(path)) records.set(path,{path,state:'waiting',url:null});
  return records.get(path);
};
export function artImage(path, className = '', alt = '') {
  if (!path) return '';
  const record = ensure(path);
  return `<img class="${safe(className)}" data-art-src="${safe(path)}" ${record.state === 'loaded' && record.url ? `src="${safe(record.url)}" data-art-state="loaded"` : 'data-art-state="pending"'} alt="${safe(alt)}" draggable="false">`;
}
export function artStats() {
  const list = [...records.values()];
  return {total:list.length,loaded:list.filter(r=>r.state==='loaded').length,failed:list.filter(r=>r.state==='error').length,pending:list.some(r=>r.state==='waiting'||r.state==='loading')};
}
function notify() { window.dispatchEvent(new CustomEvent('art-progress',{detail:artStats()})); }
function apply(record, root = document) {
  for (const image of root.querySelectorAll('img[data-art-src]')) {
    if (image.dataset.artSrc !== record.path) continue;
    image.onerror = () => {
      image.removeAttribute('src');
      image.dataset.artState = 'error';
      record.state = 'error';
      notify();
    };
    if (record.state === 'loaded' && record.url) {
      if (image.getAttribute('src') !== record.url) image.src = record.url;
      image.dataset.artState = 'loaded';
    } else image.dataset.artState = record.state === 'error' ? 'error' : 'pending';
  }
}
export function mountArt(root = document) {
  const paths = new Set([...root.querySelectorAll('img[data-art-src]')].map(image => image.dataset.artSrc));
  for (const path of paths) apply(ensure(path),root);
  drain();
}
function verify(url) {
  return new Promise((resolve,reject)=>{
    const image = new Image();
    const timeout = setTimeout(()=>{image.src='';reject(new Error('图片解码超时'));},20000);
    image.onload=()=>{clearTimeout(timeout);image.naturalWidth?resolve():reject(new Error('图片为空'));};
    image.onerror=()=>{clearTimeout(timeout);reject(new Error('图片不能解码'));};
    image.src=url;
  });
}
async function load(record) {
  record.state='loading';
  notify();
  for(let attempt=0;attempt<2;attempt++) {
    let url;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const path = new URL(record.path,location.href);
      path.searchParams.set('art','shanhai-v2');
      if(attempt)path.searchParams.set('retry',Date.now());
      const response=await fetch(path,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const blob=await response.blob();
      if(!blob.size)throw new Error('图片为空');
      url=URL.createObjectURL(blob);
      await verify(url);
      if(record.url)URL.revokeObjectURL(record.url);
      record.url=url;record.state='loaded';
      apply(record);notify();
      return;
    } catch(error) {
      if(url)URL.revokeObjectURL(url);
      if(attempt)console.warn(`美术加载失败：${record.path}`,error);
    } finally {clearTimeout(timeout);}
  }
  record.state='error';apply(record);notify();
}
function drain() {
  while(active<3) {
    const record=[...records.values()].find(r=>r.state==='waiting');
    if(!record)break;
    active++;
    load(record).finally(()=>{active--;drain();});
  }
}
export function preloadArt(paths) { paths.forEach(ensure);notify();drain(); }
export function retryArt() {
  for(const record of records.values())if(record.state==='error'){
    if(record.url)URL.revokeObjectURL(record.url);
    record.url=null;record.state='waiting';
  }
  notify();drain();
}
