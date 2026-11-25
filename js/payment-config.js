'use strict';
const paymentScriptUrl = document.currentScript.src;
/* Public payment details shown to booking owners on manage-booking.html.
   These values are NOT secret, but they must be the team's real details.
   GCash is supplied for the demo and its receiving details remain unverified.
   Enable bank transfer or cash only after business approval and configuration. */
window.BB_PAYMENT_CONFIG = {
  gcash: {
    name: 'Hazel D. Baniqued',
    number: '09128463267',
    qrImage: new URL('../assets/payments/gcash-qr.jpg', paymentScriptUrl).href
  },
  bank: {
    businessApproved: false,
    bankName: 'GoTyme Bank',
    accountName: 'Hazel D. Baniqued',
    accountNumber: ''
  },
  cash: { businessApproved: false, instructions: '' },
  note: 'Confirm the receiving details with the team before transferring. Then submit the transaction reference below. The team verifies each payment manually.'
};
