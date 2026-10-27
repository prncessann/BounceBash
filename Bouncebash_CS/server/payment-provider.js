const adapterMethods = ['createCheckout', 'verifyWebhook', 'refund'];

function createPaymentProvider(adapter) {
  if (!adapter || adapterMethods.some(method => typeof adapter[method] !== 'function')) {
    throw new TypeError(`Payment provider adapters must implement: ${adapterMethods.join(', ')}.`);
  }
  return Object.freeze(Object.fromEntries(adapterMethods.map(method => [
    method,
    adapter[method].bind(adapter)
  ])));
}

function paymentProviderNotConfigured() {
  const error = new Error('Payment processing is unavailable until a payment provider is configured.');
  error.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
  return error;
}

module.exports = { createPaymentProvider, paymentProviderNotConfigured };
