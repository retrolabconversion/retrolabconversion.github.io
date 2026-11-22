export const ROM_EXTENSION = /\.(?:zip|7z|bin|md|gen|sfc|smc|rom)$/i;
export function validRepository(config) {
  const g = config?.github;
  return Boolean(g && /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(g.owner) && /^[a-z\d._-]{1,100}$/i.test(g.repository) && !['.','..'].includes(g.repository));
}
export function safeDownloadUrl(url, owner, repository) {
  try { const u=new URL(url); return u.protocol==='https:' && u.hostname==='github.com' && u.port==='' && !u.username && !u.password && u.pathname.startsWith(`/${owner}/${repository}/releases/download/`); } catch { return false; }
}
export function releaseProjectId(release, projects) {
  const match = /<!--\s*rlc:\s*(\{[^\n]*\})\s*-->/.exec(release.body || '');
  if (match) { try { const id=JSON.parse(match[1]).project; return projects.some(p=>p.id===id) ? id : null; } catch { return null; } }
  return projects.find(p=>release.tag_name===p.id || release.tag_name?.startsWith(`${p.id}-v`))?.id || null;
}
export function mergeReleases(projects, releases, config) {
  if (!validRepository(config)) return projects.map(p=>({...p,release:null,assets:[],downloads:0}));
  const {owner,repository}=config.github;
  const found=new Map();
  for(const release of [...releases].filter(r=>!r.draft && !r.prerelease && r.published_at).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))) {
    const id=releaseProjectId(release,projects);
    if(!id || found.has(id)) continue;
    const assets=(release.assets||[]).filter(a=>a.state==='uploaded' && ROM_EXTENSION.test(a.name||'') && safeDownloadUrl(a.browser_download_url,owner,repository)).map(a=>({name:a.name,url:a.browser_download_url,size:Math.max(0,Number(a.size)||0),downloads:Number.isSafeInteger(a.download_count)&&a.download_count>=0?a.download_count:0}));
    if(assets.length) found.set(id,{release:{tag:release.tag_name,date:release.published_at},assets,downloads:assets.reduce((n,a)=>n+a.downloads,0)});
  }
  return projects.map(p=>({...p,...((p.downloadsEnabled!==false&&found.get(p.id))||{release:null,assets:[],downloads:0})}));
}
export function filterProjects(projects,{platform='all',query='',sort='featured'}={}) {
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const term=normalize(query.trim());
  const result=projects.filter(p=>(platform==='all'||p.platform===platform)&&normalize(`${p.name} ${p.subtitle} ${p.description} ${p.platform} ${p.kind}`).includes(term));
  if(sort==='name') result.sort((a,b)=>a.name.localeCompare(b.name,'en'));
  if(sort==='downloads') result.sort((a,b)=>b.downloads-a.downloads);
  return result;
}
export function formatSize(bytes) { return bytes>=1e9?`${(bytes/1e9).toFixed(1)} GB`:`${(bytes/1e6).toFixed(bytes>=1e7?0:1)} MB`; }
export function publicationBody(project,version,description) {
  return `${description.trim()}\n\nPlatform: ${project.platform}\nVersion: ${version.trim()}\n\n<!-- rlc:${JSON.stringify({project:project.id})} -->`;
}
