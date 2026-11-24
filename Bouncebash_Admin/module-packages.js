
'use strict';
(()=>{const main=document.querySelector('main[data-admin-page="packages"]');if(!main)return;const host=document.getElementById('admin-content'),panel=document.createElement('section');panel.className='mod-overview';main.insertBefore(panel,host);
 const E=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=String(text);return n;};
 let stamp=0;async function render(){const seq=++stamp;try{const res=await fetch('/api/operator/catalog',{credentials:'same-origin'});if(!res.ok)throw Error();const data=await res.json();if(seq!==stamp)return;const packages=data.packages||[],models=data.models||[],addons=data.addOns||data.add_ons||[];const g=E('div','mod-summary-grid four');
 const tiles=[['Packages',packages.length,'Configured booking offers'],['Active packages',packages.filter(p=>p.is_active).length,'Currently enabled'],['Rental models',models.length,'Available designs in catalog'],['Add-ons',addons.length,'Configured catalog add-ons']];
 for(const [title,value,desc] of tiles){const card=E('div','mod-summary-card');card.append(E('h3','',title),E('div','mod-value',value),E('p','',desc));g.append(card);}
 panel.replaceChildren(E('h2','mod-section-title','Rental catalog'),E('p','mod-sub','Live packages, models, variants, and pricing controls.'),g);
 for(const table of host.querySelectorAll('table'))for(const row of table.tBodies||[])for(const tr of row.rows){for(const cell of tr.cells){const val=cell.textContent.trim();if(['Yes','No'].includes(val)&&!cell.querySelector('.mod-status')){cell.replaceChildren(E('span','mod-status '+(val==='Yes'?'confirmed':'cancelled'),val));}}}
 }catch{panel.replaceChildren(E('p','mod-sub','Catalog summary unavailable. Existing catalog management remains usable.'));}}
 const obs=new MutationObserver(()=>{obs.disconnect();render().finally(()=>obs.observe(host,{childList:true}));});obs.observe(host,{childList:true});if(host.children.length)render();
})();
