'use strict';
(()=>{
 const mounted=new WeakMap();
 window.BBHoldCountdown=(container,booking,onExpire)=>{
  mounted.get(container)?.();container.replaceChildren();
  if(booking.status!=='pending'||!booking.expires_at)return;
  const end=Date.parse(booking.expires_at),server=Date.parse(booking.server_time||'');
  if(!Number.isFinite(end)||!Number.isFinite(server)){container.textContent='Refresh to check the reservation hold.';return;}
  const started=performance.now();const line=document.createElement('p');line.className='hold-countdown';const label=document.createElement('strong');label.textContent='Date hold remaining: ';const time=document.createElement('span');time.setAttribute('role','timer');time.setAttribute('aria-live','off');line.append(label,time);container.append(line);
  let clock,finished=false;
  const stop=()=>{if(clock)clearInterval(clock);window.removeEventListener('pagehide',stop);};
  function tick(){
   if(!container.isConnected && performance.now()-started>2000){stop();return;}
   const seconds=Math.max(0,Math.ceil((end-(server+performance.now()-started))/1000));
   time.textContent=[Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(v=>String(v).padStart(2,'0')).join(':');
   if(seconds===0&&!finished){finished=true;stop();time.textContent='Expired — checking status';Promise.resolve(onExpire?.()).catch(()=>{time.textContent='Hold elapsed. Refresh to check status.';});}
  }
  mounted.set(container,stop);tick();if(!finished)clock=setInterval(tick,1000);window.addEventListener('pagehide',stop,{once:true});
 };
})();
