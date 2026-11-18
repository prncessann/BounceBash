'use strict';
/* Public payment details shown to booking owners on manage-booking.html.
   These values are NOT secret, but they must be the team's real details.
   Leave a field empty to hide it. If everything is empty, customers see
   "Payment details will be shared by the team" instead of a fake number. */
window.BB_PAYMENT_CONFIG = {
  gcash: {
    name: 'Hazel D. Baniqued',
    number: '09128463267',
    qrImage: '../assets/payments/gcash-qr.png'
  },
  bank: {
    bankName: 'GoTyme Bank',
    accountName: 'Hazel D. Baniqued',
    accountNumber: ''
  },
  note: 'Send the payment using one of these methods, then submit the transaction reference below. The team verifies each payment manually.'
};