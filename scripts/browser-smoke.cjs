'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.env.BOUNCEBASH_PLAYWRIGHT_MODULE || 'playwright');
const { fixture } = require('../tests/support-fixture.cjs');

async function main() {
  const f = await fixture({DB_DRIVER:'sqlite', CRON_SECRET:'isolated-browser-scheduler-secret-1234'});
  let browser;
  try {
    browser = await chromium.launch({ channel:process.env.BOUNCEBASH_BROWSER_CHANNEL || 'msedge', headless:true });
    const context = await browser.newContext({viewport:{width:1440,height:900}});
    const page = await context.newPage();
    const errors = [], failed = [];
    let expectedPaymentDisconnect = false;
    const origin = f.env.PUBLIC_URL;
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', entry => {
      if (entry.type() === 'error' && !entry.text().startsWith('Failed to load resource:')) errors.push(entry.text());
    });
    page.on('requestfailed', request => {
      if (expectedPaymentDisconnect && request.method() === 'POST' && request.url().endsWith('/payments')) return;
      if (request.failure()?.errorText !== 'net::ERR_ABORTED') failed.push([new URL(request.url()).hostname, new URL(request.url()).pathname, request.failure()?.errorText]);
    });
    page.on('response', response => {
      if (response.status() >= 400) failed.push([new URL(response.url()).pathname, response.status()]);
    });
    await page.addInitScript(() => {
      window.print = () => { window.printRequested = true; };
      document.addEventListener('securitypolicyviolation', event => console.error('CSP blocked ' + event.violatedDirective));
    });
    const q = selector => page.locator(selector);
    const go = name => page.goto(origin + '/Bouncebash_CS/' + name);
    const submit = id => q('#' + id + ' button[type=submit]').click();
    const contains = (selector, value) => page.waitForFunction(([css,text]) => document.querySelector(css)?.textContent.includes(text),[selector,value]);
    const visible = selector => q(selector).first().waitFor({state:'visible'});
    async function checkLayout(name, width) {
      const layout = await page.evaluate(() => {
        const ids = Array.from(document.querySelectorAll('[id]'), node => node.id);
        const overlap = Array.from(document.querySelectorAll('.card-grid, #rental-grid')).some(grid => {
          const boxes = Array.from(grid.children, node => node.getBoundingClientRect()).filter(box => box.width && box.height);
          return boxes.some((a, i) => boxes.slice(i+1).some(b =>
            Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));
        });
        return {overflow:document.documentElement.scrollWidth > window.innerWidth, duplicate:ids.some((id,i) => ids.indexOf(id)!==i), overlap};
      });
      assert.deepEqual(layout,{overflow:false,duplicate:false,overlap:false},name+' at '+width+'px');
    }

    await go('signup.html');
    await q('#name').fill('Browser QA');
    await q('#email').fill('browser@example.test');
    await q('#password').fill('TestPassword123!');
    await submit('signup-form');
    await page.waitForURL('**/profile.html');
    await contains('#booking-list','No bookings yet.');
    const identity = async () => (await context.cookies()).map(cookie => cookie.name+'='+cookie.value).join('; ');
    await q('#profile-name').fill('Browser Updated');
    await q('#profile-phone').fill('09123456789');
    await submit('profile-form');
    await contains('#profile-message','updated');
    assert.equal((await f.api('/api/customers/me',{cookie:await identity()})).data.user.name,'Browser Updated');
    console.log('PASS signup, browser session, profile update, and empty booking list');

    await q('#new-password').fill('NextPassword123!');
    await q('#current-password').fill('TestPassword123!');
    await submit('password-form');
    await contains('#password-message','updated');
    await q('#new-email').fill('browser-next@example.test');
    await q('#email-password').fill('NextPassword123!');
    await submit('change-email-form');
    await contains('#email-message','changed');
    await q('#resend-verification').click();
    await f.api('/api/operator/maintenance',{method:'POST',operator:true,body:{}});
    const verification = f.received.filter(item=>item.data.kind==='account.verify' && item.data.recipient==='browser-next@example.test').at(-1);
    assert.ok(verification);
    await page.goto(verification.data.url);
    await submit('account-help-form');
    await contains('#tools-message','verified');
    console.log('PASS password change, email change, resend and verification via captured link');

    await go('booking.html');
    await visible('.rental-option');
    assert.equal(await q('.rental-option img').count(),5);
    await q('#wizard-next').click();
    await visible('#rental-error');
    const zone = await q('#zone-filter option').nth(1).getAttribute('value');
    await q('#zone-filter').selectOption(zone);
    assert.ok(await q('.rental-option').count() < 5);
    await q('#zone-filter').selectOption('');
    await q('.rental-option').first().click();
    await q('#rental-variant').selectOption({index:1});
    await q('#wizard-next').click();
    await visible('#event-date');
    await q('#wizard-next').click();
    assert.equal(await q('#event-date').getAttribute('aria-invalid'),'true');
    await q('#event-date').fill('2090-09-01');
    await q('#event-time').fill('10:00');
    await q('#city-id').selectOption('quezon-city');
    await q('#venue').fill('Synthetic browser venue');
    await q('#extra-hours').selectOption('1');
    await q('#wizard-back').click();
    await q('#wizard-next').click();
    assert.equal(await q('#venue').inputValue(),'Synthetic browser venue');
    await q('#wizard-next').click();
    await visible('#arch-selected');
    await q('#ball-color').selectOption({index:1});
    await q('#arch-selected').check();
    await q('#arch-color-count').selectOption('2');
    await q('#arch-color-1').selectOption({index:1});
    await q('#arch-color-2').selectOption({index:2});
    await q('#backdrop-selected').check();
    await q('#backdrop-event').selectOption('Other');
    await q('#wizard-next').click();
    assert.equal(await q('#backdrop-other').getAttribute('aria-invalid'),'true');
    await q('#backdrop-other').fill('Synthetic celebration');
    await q('#wizard-next').click();
    await contains('#wizard-price','Final total');
    await q('#reservation-fee').check();
    await q('#wizard-submit').dblclick();
    await visible('#booking-success');
    assert.match(await q('#booking-success').textContent(),/Date hold remaining/);
    const cookie = await identity();
    const owner = async () => (await f.api('/api/bookings/mine',{cookie})).data.bookings;
    const [booking] = await owner();
    assert.equal((await owner()).length,1);
    assert.equal(booking.total_cents,850000);
    console.log('PASS rental photos, zone filter, variant, required fields, retained values, all extras, review, duplicate-click prevention and persisted hold');

    await go('profile.html');
    await q('.account-booking a').click();
    await visible('#payment-reference-form');
    assert.equal(await q('#booking-receipt').isVisible(),false);
    assert.equal(await q('#track-booking-form').count(),0);
    for (const width of [1440,768,390]) {
      await page.setViewportSize({width,height:900});
      await checkLayout('Active Manage Booking',width);
      assert.equal(await q('#payment-reference-form button[type=submit]').isVisible(),true);
    }
    await page.setViewportSize({width:1440,height:900});
    const payments = '/api/bookings/' + booking.reference + '/payments';
    const submission = page.waitForResponse(r => r.url().endsWith(payments) && r.request().method()==='POST');
    await q('#payment-amount').fill('2499.99');
    await q('#payment-reference').fill('BROWSER-TRANSFER');
    await submit('payment-reference-form');
    assert.equal((await submission).status(),201);
    await contains('#payment-message','Payment reference submitted. Your payment is awaiting verification.');
    const [payment] = (await owner())[0].payments;
    assert.equal(payment.amount_cents,249999);
    assert.equal(payment.status,'pending');
    assert.equal(await q('#booking-receipt').isVisible(),false);
    expectedPaymentDisconnect = true;
    let releaseResponse;
    const delayResponse = new Promise(resolve => { releaseResponse = resolve; });
    await page.route('**' + payments, async route => {
      const committed = await route.fetch();
      assert.equal(committed.status(),201);
      await delayResponse;
      await route.abort('connectionreset');
    }, {times:1});
    await q('#payment-amount').fill('1');
    await q('#payment-reference').fill('BROWSER-RESPONSE-LOST');
    await submit('payment-reference-form');
    assert.equal(await q('#payment-reference-form').getAttribute('aria-busy'),'true');
    releaseResponse();
    await contains('#payment-message','whether your change was saved');
    expectedPaymentDisconnect = false;
    assert.equal(await q('#payment-reference').inputValue(),'BROWSER-RESPONSE-LOST');
    assert.equal((await owner())[0].payments.filter(row=>row.reference==='BROWSER-RESPONSE-LOST').length,1);
    assert.equal((await f.api('/api/operator/payments/'+payment.id,{method:'PUT',operator:true,body:{status:'verified',note:'Synthetic browser check'}})).status,200);
    await q('#refresh-booking').click();
    await visible('#booking-receipt');
    assert.equal(await q('#payment-reference-form').isVisible(),true);
    const operatorBooking = '/api/operator/bookings/'+booking.reference;
    async function recordAndVerify(amount,reference) {
      const recorded=await f.api(operatorBooking+'/payments',{method:'POST',operator:true,body:{amount,reference,method:'Cash'}});
      assert.equal(recorded.status,201,JSON.stringify(recorded.data));
      assert.equal((await owner())[0].payments.find(row=>row.id===recorded.data.paymentId).status,'pending');
      assert.equal((await f.api('/api/operator/payments/'+recorded.data.paymentId,{method:'PUT',operator:true,body:{status:'verified',note:'Synthetic staff balance'}})).status,200);
    }
    await recordAndVerify('1750.01','BROWSER-DEPOSIT-REMAINDER');
    await page.reload();
    await contains('#booking-details','Downpayment verified — awaiting booking confirmation.');
    assert.match(await q('#booking-details').textContent(),/Remaining balance₱4,250\.00/);
    for(const selector of ['#payment-reference-form','#payment-instructions','#payment-history','#payment-pending-note']){
      assert.equal(await q(selector).isVisible(),false);
    }
    assert.doesNotMatch(await q('#booking-receipt').textContent(),/BROWSER-RESPONSE-LOST/);
    assert.equal((await f.api(operatorBooking+'/status',{method:'PUT',operator:true,body:{status:'confirmed'}})).status,200);
    await q('#refresh-booking').click();
    await contains('#booking-details','StatusConfirmed');
    await page.setViewportSize({width:390,height:900});
    await q('#open-reschedule').click();
    await visible('#reschedule-dialog');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'move-date');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await submit('reschedule-booking-form');
    await contains('#reschedule-message','different date or time');
    await q('#move-date').fill('2000-01-01');
    await submit('reschedule-booking-form');
    assert.equal(await q('#move-date').getAttribute('aria-invalid'),'true');
    await q('#move-date').fill('2090-09-04');
    await q('#move-time').fill('');
    await submit('reschedule-booking-form');
    assert.equal(await q('#move-time').getAttribute('aria-invalid'),'true');
    await q('#move-time').fill('11:00');
    assert.equal((await f.api('/api/operator/date-blocks',{method:'POST',operator:true,body:{date:'2090-09-04',reason:'Synthetic conflict'}})).status,201);
    await q('#move-date').fill('2090-09-04');
    await submit('reschedule-booking-form');
    await contains('#reschedule-message','unavailable');
    await q('#keep-schedule').click();
    assert.equal((await owner())[0].event_date,'2090-09-01');
    await q('#open-reschedule').click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.activeElement.id==='open-reschedule');
    await q('#open-reschedule').click();
    await q('#move-date').fill('2090-09-02');
    let moves=0;
    page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/reschedule'))moves++;});
    await q('#reschedule-booking-form button[type=submit]').dblclick();
    await contains('#reschedule-result','Reschedule requested.');
    assert.equal(moves,1);
    await contains('#booking-details','Downpayment verified — awaiting booking confirmation.');
    assert.equal(await q('#payment-instructions').isVisible(),false);
    assert.equal((await owner())[0].payments.find(row=>row.id===payment.id).status,'verified');
    assert.equal((await f.api('/api/availability?date=2090-09-01')).data.available,true);
    assert.equal((await f.api('/api/availability?date=2090-09-02')).data.available,false);
    const duplicate=(await owner())[0].payments.find(row=>row.reference==='BROWSER-RESPONSE-LOST');
    assert.equal((await f.api('/api/operator/payments/'+duplicate.id,{method:'PUT',operator:true,body:{status:'rejected',note:'Synthetic exercise'}})).status,200);
    await recordAndVerify('4250','BROWSER-FINAL-BALANCE');
    await q('#refresh-booking').click();
    await contains('#booking-receipt','BROWSER-FINAL-BALANCE');
    assert.equal((await owner())[0].balance_cents,0);
    assert.match(await q('#booking-details').textContent(),/Remaining balance₱0\.00/);
    await q('.btn-receipt-print').click();
    assert.equal(await page.evaluate(() => window.printRequested),true);
    await go('profile.html');
    await q('.booking-cancel').click();
    assert.equal(await page.evaluate(() => document.activeElement.id),'profile-cancel-reason');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.classList.contains('booking-cancel'));
    await q('.booking-cancel').click();
    await q('#profile-cancel-reason').fill('Synthetic cancellation');
    await q('dialog button[type=submit]').click();
    await contains('#booking-list','Status: cancelled');
    assert.equal((await owner())[0].payments.find(row=>row.id===payment.id).status,'verified');
    await go('manage-booking.html?reference='+booking.reference);
    await contains('#booking-details','StatusCancelled');
    await visible('#booking-receipt');
    assert.equal(await q('#open-reschedule').isVisible(),false);
    await page.setViewportSize({width:1440,height:900});
    const held = await f.api('/api/bookings',{method:'POST',cookie,body:{
      rentalId:booking.model_id,variantId:booking.variant_id,name:'Browser QA',contact:'09123456789',
      eventDate:'2090-09-05',eventTime:'10:00',cityId:'quezon-city',venue:'Synthetic venue',reservationFeeAccepted:true
    }});
    assert.equal(held.status,201,JSON.stringify(held.data));
    const heldRef=held.data.booking.reference;
    const late = await f.api('/api/bookings/'+heldRef+'/payments',{method:'POST',cookie,body:{amount:'3350',reference:'BROWSER-EXPIRED-VERIFIED',method:'GCash'}});
    assert.equal(late.status,201);
    assert.equal((await f.api('/api/operator/payments/'+late.data.paymentId,{method:'PUT',operator:true,body:{status:'verified',note:'Synthetic expired hold'}})).status,200);
    const expiredDb=new (require('better-sqlite3'))(f.env.BOUNCEBASH_DB_PATH);
    try { expiredDb.prepare('UPDATE bookings SET expires_at=? WHERE reference_code=?').run('2000-01-01T00:00:00.000Z',heldRef); }
    finally { expiredDb.close(); }
    await go('manage-booking.html?reference='+heldRef);
    await contains('#booking-details','StatusExpired');
    await contains('#booking-receipt','BROWSER-EXPIRED-VERIFIED');
    assert.equal(await q('#open-reschedule').isVisible(),false);
    assert.equal(await q('#payment-reference-form').isVisible(),false);
    assert.equal((await f.api('/api/availability?date=2090-09-05')).data.available,true);
    console.log('PASS ₱2,499.99 pending reference, staff verification, receipt Print invocation, rescheduling and paid cancellation');

    await go('profile.html');
    await q('#logout-link').click();
    await page.waitForURL('**/index.html');
    assert.equal((await f.api('/api/auth/session',{cookie:await identity()})).data.authenticated,false);
    await go('login.html');
    await q('#email').fill('browser-next@example.test');
    await q('#password').fill('NextPassword123!');
    await submit('login-form');
    await page.waitForURL('**/profile.html');
    await go('account-help.html');
    await q('#help-email').fill('browser-next@example.test');
    await submit('account-help-form');
    await contains('#tools-message','reset');
    for(let i=0;i<10&&!f.received.some(item=>item.data.kind==='account.reset');i++){
      await f.api('/api/operator/maintenance',{method:'POST',operator:true,body:{}});
    }
    const reset = f.received.find(item=>item.data.kind==='account.reset');
    assert.ok(reset);
    await page.goto(reset.data.url);
    await q('#help-password').fill('RecoveredPassword123!');
    await submit('account-help-form');
    await contains('#tools-message','reset successfully');
    console.log('PASS logout, login and password reset via captured link');

    await go('login.html');
    await q('#email').fill('browser-next@example.test');
    await q('#password').fill('RecoveredPassword123!');
    await submit('login-form');
    await page.waitForURL('**/profile.html');
    await go('booking.html');
    await visible('.rental-option');
    await q('.rental-option').first().click();
    await q('#rental-variant').selectOption({index:1});
    await q('#wizard-next').click();
    await q('#event-date').fill('2090-09-03');
    await q('#event-time').fill('11:00');
    await q('#city-id').selectOption('makati');
    await q('#venue').fill('Synthetic venue for quote');
    await q('#notes').fill('Synthetic request requiring quotation');
    await q('#wizard-next').click();
    await visible('#arch-selected');
    await q('#ball-color').selectOption({index:1});
    await q('#wizard-next').click();
    await contains('#wizard-price','pending');
    await q('#wizard-inquire').click();
    await contains('#booking-message','My Inquiries');
    assert.equal((await f.api('/api/inquiries/mine',{cookie:await identity()})).data.inquiries.length,1);
    assert.equal((await f.api('/api/availability?date=2090-09-03')).data.available,true);
    await q('#reservation-fee').check();
    await q('#wizard-submit').click();
    await visible('#booking-success');
    const [quoted] = (await f.api('/api/bookings/mine',{cookie:await identity()})).data.bookings;
    assert.equal(quoted.total_cents,null);
    assert.equal(quoted.delivery_fee_cents,40000);
    await go('manage-booking.html?reference='+quoted.reference);
    await visible('#open-reschedule');
    assert.equal(await q('#payment-reference-form').isVisible(),false);
    assert.equal((await f.api('/api/operator/bookings/'+quoted.reference+'/quote',{method:'PUT',operator:true,body:{total:'7250.00',note:'Synthetic quotation'}})).status,200);
    await page.reload();
    await visible('#payment-reference-form');
    await go('profile.html');
    await contains('#inquiry-list','Inquiry ');
    await q('.booking-cancel').click();
    await q('#profile-cancel-reason').fill('Synthetic unpaid cancellation');
    await q('dialog button[type=submit]').click();
    await q('.booking-cancel').waitFor({state:'detached'});
    assert.equal((await f.api('/api/availability?date=2090-09-03')).data.available,true);
    console.log('PASS notes quotation, conditional payment visibility, operator quote and unpaid cancellation');

    for (const width of [1440,768,390]) {
      await page.setViewportSize({width,height:900});
      for (const name of ['index.html','packages.html','booking.html','profile.html','calendar.html','gallery.html','faq.html','feedback.html']) {
        await go(name);
        if (name === 'index.html') await visible('#featured-rentals article');
        if (name === 'booking.html') await visible('.rental-option');
        if (name === 'packages.html') await visible('.rental-grid article');
        await checkLayout(name,width);
      }
      console.log('PASS document width, unique IDs and card overlap across eight pages and active Manage Booking at '+width+'px');
    }
    await go('index.html');
    await q('.nav-toggle').press('Enter');
    assert.equal(await q('.nav-toggle').getAttribute('aria-expanded'),'true');
    await page.keyboard.press('Escape');
    assert.equal(await q('.nav-toggle').getAttribute('aria-expanded'),'false');
    await go('gallery.html');
    await q('#load-more').click();
    await q('[data-filter=dry]').click();
    await go('faq.html');
    await q('#faq-search').fill('zz-no-result');
    await visible('#faq-empty');
    await go('calendar.html');
    await q('#calendar-next').click();
    await go('blog.html');
    await q('#newsletter-form input[type=email]').fill('browser-newsletter@example.test');
    await submit('newsletter-form');
    await contains('#newsletter-message','Subscription recorded');
    await go('feedback.html');
    await q('#fb-name').fill('Browser QA');
    await q('#fb-event').selectOption('Birthday party');
    await q('#fb-text').fill('Synthetic browser feedback for this isolated test.');
    await q('#share-publicly').check();
    const feedback = page.waitForResponse(r=>r.url().endsWith('/api/reviews') && r.request().method()==='POST');
    await submit('feedback-form');
    const posted = await feedback;
    assert.equal(posted.status(),201);
    const approved = [ (await posted.json()).reviewId ];
    for (let i=0;i<6;i++) {
      const result = await f.api('/api/reviews',{method:'POST',body:{name:'Synthetic QA',message:'Synthetic paginated feedback '+i,rating:5,canFeature:true}});
      assert.equal(result.status,201);
      approved.push(result.data.reviewId);
    }
    for (const id of approved) assert.equal((await f.api('/api/operator/reviews/'+id,{method:'PUT',operator:true,body:{status:'approved'}})).status,200);
    await page.reload();
    await visible('#load-reviews');
    await q('#load-reviews').click();
    await page.waitForFunction(()=>document.querySelectorAll('#reviews-grid .review-card').length===7);
    await q('[data-review-rating="5"]').click();
    assert.equal(await q('[data-review-rating="5"]').getAttribute('aria-pressed'),'true');
    const db = new (require('better-sqlite3'))(f.env.BOUNCEBASH_DB_PATH);
    try { db.prepare('UPDATE sessions SET expires_at=?').run('2000-01-01T00:00:00.000Z'); }
    finally { db.close(); }
    await go('profile.html');
    await page.waitForURL('**/login.html');
    assert.equal((await f.api('/api/auth/session',{cookie:await identity()})).data.authenticated,false);
    assert.deepEqual(errors,[],'Browser errors');
    assert.deepEqual(failed,[],'Unexpected failed browser requests');
    console.log('PASS mobile keyboard menu, gallery, FAQ, calendar, newsletter, feedback, review filter/pagination, expired-session redirect and browser error collection');
  } finally {
    try { await browser?.close(); } finally { await f.close(); }
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });

