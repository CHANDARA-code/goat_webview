/**
 * @goat/compiler-taro - Payment JSAPI Runtime Bridge
 * Implements Taro.requestPayment mapped to Goat REQUEST_PAYMENT / OPEN_INVOICE.
 */

import { invokeBridgeCallback } from './bridge.js';
import { RequestPaymentOptions, GeneralCallbackResult } from '../types.js';

/**
 * Maps legacy WeChat payment fields into the standard 5-layer payment payload schema
 * (`orderId`, `intentId`, `nonce`, `signedPayload`, `signature`) before dispatching.
 */
function buildPaymentPayload(options: RequestPaymentOptions): Record<string, unknown> {
  const orderId = options.package || options.invoiceSlug || `order_${Date.now()}`;
  const intentId = options.package || `intent_${orderId}`;
  const nonce =
    options.nonceStr ||
    Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const signedPayload = options.paySign || '';

  return {
    provider: options.provider || 'default',
    orderId,
    intentId,
    nonce,
    signedPayload,
    signature: signedPayload,
    invoiceSlug: options.invoiceSlug || options.package || 'default_invoice',
    timeStamp: options.timeStamp || String(Math.floor(Date.now() / 1000)),
    nonceStr: options.nonceStr,
    package: options.package,
    signType: options.signType || 'RSA',
    paySign: options.paySign,
  };
}

/**
 * Taro.requestPayment -> REQUEST_PAYMENT / OPEN_INVOICE
 */
export async function requestPayment(options: RequestPaymentOptions = {}): Promise<GeneralCallbackResult> {
  const payload = buildPaymentPayload(options);

  return invokeBridgeCallback<GeneralCallbackResult, RequestPaymentOptions>(
    'requestPayment',
    'REQUEST_PAYMENT',
    payload,
    options,
    () => ({ errMsg: 'requestPayment:ok' }),
    (err) => {
      if (err?.code === 'PAYMENT_CANCELLED' || err?.code === 'USER_CANCELLED') {
        return 'cancel';
      }
      return err?.message || 'payment failed';
    }
  );
}
