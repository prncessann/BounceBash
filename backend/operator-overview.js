'use strict';

function registerOverview({app,db,asyncRoute,date,today,fail}) {
  app.get(['/api/operator/overview','/api/operator/reports'],asyncRoute(async (req,res) => {
    const from=date(req.query.from || '2000-01-01');
    const to=date(req.query.to || '2100-12-31');
    const status=req.query.status||'';
    if(from>to || status && !['pending','confirmed','completed','cancelled','expired'].includes(status)) fail(400,'Invalid report filters.');
    const nextDay = new Date(Date.parse(to+'T00:00:00+08:00')+86400000).toISOString();
    const start = new Date(from+'T00:00:00+08:00').toISOString();
    const sqlTimestamp = value => value.slice(0,19).replace('T',' ');
    const result=await db.transaction(async()=>{
      const bookings=await db.prepare('SELECT id,name,reference_code,event_date,event_time,status,package_name,total_cents,selection_json,add_ons FROM bookings WHERE event_date>=? AND event_date<=?'+(status?' AND status=?':'')+' ORDER BY event_date,event_time,id').all(...[from,to,...(status?[status]:[])]);
      const rows=await db.prepare(`SELECT p.id,p.amount_cents,p.status, p.created_at,b.reference_code,b.status AS booking_status
        FROM payments p JOIN bookings b ON b.id=p.booking_id WHERE
        replace(substr(p.created_at,1,19),'T',' ')>=? AND replace(substr(p.created_at,1,19),'T',' ')<?
        ${status?'AND b.status=?':''} ORDER BY p.id`).all(...[sqlTimestamp(start),sqlTimestamp(nextDay),...(status?[status]:[])]);
      const balances=await db.prepare(`SELECT booking_id,status,SUM(amount_cents) AS amount_cents FROM payments
        GROUP BY booking_id,status`).all();
      const byBooking=new Map();
      for(const row of balances){
        if(!byBooking.has(row.booking_id))byBooking.set(row.booking_id,{});
        byBooking.get(row.booking_id)[row.status]=Number(row.amount_cents);
      }
      const totals={bookings:bookings.length, confirmed:0, pending:0, upcoming:0, unknown_quotes:0,
        outstanding_cents:0, known_booking_value_cents:0, verified_collected_cents:0, recorded_refunded_cents:0,
        gross_collections_cents:0, net_collections_cents:0, pending_reference_cents:0, pending_references:0, unresolved_inactive_cents:0};
      const extras=new Map();
      const currentDay=today();
      const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
      for(const booking of bookings){
        const amounts=byBooking.get(booking.id)||{};
        const active=['pending','confirmed'].includes(booking.status);
        if(booking.status==='confirmed')totals.confirmed++;
        if(booking.status==='pending')totals.pending++;
        booking.upcoming=active&&(booking.event_date>currentDay||booking.event_date===currentDay&&booking.event_time>=clock);
        if(booking.upcoming)totals.upcoming++;
        const verified=amounts.verified||0;
        const pending=amounts.pending||0;
        const balance=booking.total_cents===null?null:Math.max(0,booking.total_cents-verified);
        totals.known_booking_value_cents+=booking.total_cents||0;
        if(active&&balance===null)totals.unknown_quotes++;
        if(active&&balance!==null)totals.outstanding_cents+=balance;
        if(['cancelled','expired'].includes(booking.status))totals.unresolved_inactive_cents+=verified+pending;
        const selection=JSON.parse(booking.selection_json||'{}');
        const items=Array.isArray(selection)?selection:JSON.parse(booking.add_ons||'[]').map(name=>({name,quantity:1}));
        for(const {name,quantity} of items)extras.set(name,(extras.get(name)||0)+quantity);
        delete booking.selection_json;delete booking.add_ons;
        Object.assign(booking,{verified_cents:verified,pending_cents:pending,balance_cents:balance});
      }
      for(const payment of rows){
        if(payment.status==='verified')totals.verified_collected_cents+=payment.amount_cents;
        if(payment.status==='refunded')totals.recorded_refunded_cents+=payment.amount_cents;
        if(payment.status==='pending'){totals.pending_reference_cents+=payment.amount_cents;totals.pending_references++;}
      }
      totals.net_collections_cents=totals.verified_collected_cents;
      totals.gross_collections_cents=totals.net_collections_cents+totals.recorded_refunded_cents;
      return {totals,bookings,payments:rows,extras:[...extras].sort((a,b)=>b[1]-a[1])};
    })();
    const generated=new Date().toISOString();
    if(req.path.endsWith('/reports')){
      const states={};const packages=new Map();const payments=new Map();
      for(const booking of result.bookings){
        states[booking.status]=(states[booking.status]||0)+1;
        if(!['expired','cancelled'].includes(booking.status))packages.set(booking.package_name,(packages.get(booking.package_name)||0)+1);
      }
      for(const payment of result.payments){
        const summary=payments.get(payment.status)||{status:payment.status,count:0,amount_cents:0};
        summary.count++;summary.amount_cents+=payment.amount_cents;payments.set(payment.status,summary);
      }
      return res.json({...result.totals,currency:'PHP',from,to,generated_at:generated,
        date_basis:{bookings:'event_date',payments:'original receipt date in Philippine time',outstanding:'pending or confirmed bookings with event dates in range'},
        total_bookings:result.bookings.length,bookings:states,payments:[...payments.values()],
        popular_packages:[...packages].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count),
        popular_add_ons:result.extras.map(([name,quantity])=>({name,quantity})),
        notes:'Current verification and refund state grouped by original receipt date.'});
    }
    res.json({...result,from,to,status,today:today(),refreshed_at:generated});
  }));
}

module.exports={registerOverview};

