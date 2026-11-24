
'use strict';
(()=>{const main=document.querySelector('main[data-admin-page="settings"]');if(!main)return;const host=document.getElementById('admin-content'),panel=document.createElement('section');panel.className='mod-overview';main.insertBefore(panel,host);
 const E=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=String(text);return n;};
 function decorate(){const cards=[...host.querySelectorAll(':scope > section.card')];for(const card of cards){const title=card.querySelector('h2')?.textContent||'';card.classList.toggle('mod-business-settings',title.startsWith('Business details'));card.classList.toggle('mod-notice-settings',title==='Notifications');}
 const form=host.querySelector('.mod-business-settings form.admin-form');if(!form)return;
 // These labels are visual only. All original inputs, handlers, and submit buttons stay in place.
 for(const [name,title] of [['gcashMode','Payment instructions'],['bankApproved','Bank transfer'],['cashApproved','Cash payments']]){
  const label=form.querySelector('[name="'+name+'"]')?.closest('label');if(label&&!label.previousElementSibling?.classList?.contains('mod-settings-group'))label.before(E('h3','mod-settings-group',title));
 }
 }
 function render(){decorate();panel.replaceChildren(E('h2','mod-section-title','Business settings'),E('p','mod-sub','Manage contact information, payment instructions, booking rules and staff notifications. Changes use the existing backend.'));}
 const obs=new MutationObserver(()=>{obs.disconnect();render();obs.observe(host,{childList:true});});obs.observe(host,{childList:true});if(host.children.length)render();
})();
