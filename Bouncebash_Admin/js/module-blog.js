
'use strict';
(()=>{const main=document.querySelector('main[data-admin-page="blog"]');if(!main)return;const host=document.getElementById('admin-content'),panel=document.createElement('section');panel.className='mod-overview';main.insertBefore(panel,host);
 const E=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=String(text);return n;};
 let stamp=0;async function render(){const seq=++stamp;try{const responses=await Promise.all(['/api/operator/articles','/api/operator/reviews'].map(url=>fetch(url,{credentials:'same-origin'})));if(responses.some(r=>!r.ok))throw Error();const [{articles=[]},{reviews=[]}]=await Promise.all(responses.map(r=>r.json()));if(seq!==stamp)return;
 const tiles=[['Published posts',articles.filter(a=>a.state==='published').length,'Visible articles'],['Draft posts',articles.filter(a=>a.state==='draft').length,'Not yet published'],['Approved reviews',reviews.filter(r=>r.moderation_status==='approved').length,'Moderated feedback'],['Awaiting approval',reviews.filter(r=>r.moderation_status==='pending').length,'Pending reviews']];const grid=E('div','mod-summary-grid four');
 for(const [label,count,detail] of tiles){const card=E('div','mod-summary-card');card.append(E('h3','',label),E('div','mod-value',count),E('p','',detail));grid.append(card);}
 panel.replaceChildren(E('h2','mod-section-title','Publishing & feedback'),E('p','mod-sub','Real article and review states; no sample figures.'),grid);
 for(const table of host.querySelectorAll('table'))for(const body of table.tBodies)for(const tr of body.rows)for(const cell of tr.cells){const s=cell.textContent.trim().toLowerCase();if(['published','draft','archived','approved','pending','rejected'].includes(s)&&!cell.querySelector('.mod-status'))cell.replaceChildren(E('span','mod-status '+s,cell.textContent.trim()));}
 }catch{panel.replaceChildren(E('p','mod-sub','Publishing summary unavailable. Existing edit and moderation actions remain usable.'));}}
 const obs=new MutationObserver(()=>{obs.disconnect();render().finally(()=>obs.observe(host,{childList:true}));});obs.observe(host,{childList:true});if(host.children.length)render();
})();
