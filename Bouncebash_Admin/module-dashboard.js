'use strict';
/* v5: Header New booking restored; other presentation-only fixes. Existing live graph point values, Admin APIs,
   booking actions and payment data remain owned by admin-operational.js. */
(()=>{
  const main=document.querySelector('main[data-admin-page="index"]');
  const host=document.getElementById('admin-content');
  if(!main||!host)return;
  document.body.dataset.bbDashboardFix='v5';

  // The existing SVG plots cents correctly but prints cents as thousands of
  // pesos (example: 2000k at ₱19,900). Convert only axis labels to PHP.
  const axisLabel=(raw)=>{
    const match=String(raw||'').trim().match(/^([\d,.]+)k$/i);
    if(!match)return null;
    const centsAsK=Number(match[1].replace(/,/g,''));
    if(!Number.isFinite(centsAsK))return null;
    const amount=Math.round(centsAsK*10); // 2000k cents -> ₱20,000.
    if(amount===0)return '₱0';
    return amount%1000===0 ? '₱'+(amount/1000).toLocaleString('en-PH')+'k'
      : '₱'+amount.toLocaleString('en-PH');
  };

  function correctChart(){
    const svgs=host.querySelectorAll('svg.dashboard-line-chart');
    for(const svg of svgs){
      if(svg.dataset.bbAxisCorrected==='v5')continue;
      let changed=0;
      for(const label of svg.querySelectorAll('text[x="44"]')){
        const converted=axisLabel(label.textContent);
        if(converted===null)continue;
        label.textContent=converted;
        changed++;
      }
      if(changed){
        svg.dataset.bbAxisCorrected='v5';
        svg.setAttribute('aria-label','Verified monthly collections in Philippine pesos, last six months');
      }
    }
  }
  // The Admin asynchronously replaces #admin-content after loading data.
  const observer=new MutationObserver(correctChart);
  observer.observe(host,{childList:true});
  correctChart();
})();
