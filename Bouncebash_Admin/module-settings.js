 'use strict';
(() => {
  const main=document.querySelector('main[data-admin-page="settings"]');if(!main)return;
  const host=document.getElementById('admin-content'),panel=document.createElement('section');
  panel.className='mod-overview';main.insertBefore(panel,host);
  const E=(tag,cls,txt)=>{const n=document.createElement(tag);n.className=cls||'';if(txt!=null)n.textContent=String(txt);return n;};
  function decorate(){
    const cards=[...host.querySelectorAll(':scope > section.card')];
    for(const card of cards){
      const title=card.querySelector('h2')?.textContent||'';
      card.classList.toggle('mod-business-settings',title.startsWith('Business details'));
      card.classList.toggle('mod-notice-settings',title==='Notifications');
    }
    const form=host.querySelector('.mod-business-settings form.admin-form');if(!form)return;
    // Bank transfer is intentionally no longer configurable in this Admin UI.
    // The original form's field references still exist, so reset them as well:
    // saving will mark bank transfer unapproved and erase configured bank details.
    for(const name of ['bankApproved','bankName','bankAccountName','bankAccountNumber']){
      const field=form.querySelector('[name="'+name+'"]');if(!field)continue;
      if(field.type==='checkbox')field.checked=false;else field.value='';
      field.closest('label')?.remove();
    }
    for(const [name,title] of [['gcashMode','Payment instructions'],['cashApproved','Cash payments']]){
      const label=form.querySelector('[name="'+name+'"]')?.closest('label');
      if(label&&!label.previousElementSibling?.classList?.contains('mod-settings-group'))label.before(E('h3','mod-settings-group',title));
    }
    const save=form.querySelector('button[type="submit"]');
    if(save&&!form.querySelector('.bb-bank-removal-note'))save.before(E('p','bb-bank-removal-note','Bank transfer has been removed from this form. Saving settings will disable any previously configured bank-transfer instructions.'));
  }
  function render(){
    decorate();
    panel.replaceChildren(E('h2','mod-section-title','Business settings'),E('p','mod-sub','Update contact details, GCash and cash instructions, and staff notifications.'));
  }
  const obs=new MutationObserver(()=>{obs.disconnect();render();obs.observe(host,{childList:true});});
  obs.observe(host,{childList:true});if(host.children.length)render();
})();
