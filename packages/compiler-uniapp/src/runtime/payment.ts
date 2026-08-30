/**
 * @goat/compiler-uniapp Payment JSAPI Shims
 */
import { callBridgeAction } from './bridge.js';
import type { PaymentResult, RequestPaymentOptions, UniError } from '../types.js';

function buildPaymentPayload(options: RequestPaymentOptions): Record<string, unknown> {
  const orderInfo =
    typeof options.orderInfo === 'object' && options.orderInfo !== null
      ? (options.orderInfo as Record<string, unknown>)
      : {};

  const orderId =
    (orderInfo.orderId as string) ||
    (orderInfo.order_id as string) ||
    options.package ||
    (typeof options.orderInfo === 'string' ? options.orderInfo : '') ||
    `order_${Date.now()}`;

  const intentId =
    (orderInfo.intentId as string) ||
    (orderInfo.intent_id as string) ||
    options.package ||
    `intent_${orderId}`;

  const nonce =
    options.nonceStr ||
    (orderInfo.nonce as string) ||
    Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  const signedPayload =
    options.paySign ||
    (orderInfo.signedPayload as string) ||
    (orderInfo.signature as string) ||
    '';

  const invoiceSlug =
    options.invoiceSlug ||
    (typeof options.orderInfo === 'string' ? options.orderInfo : '') ||
    options.package ||
    '';

  return {
    provider: options.provider,
    orderId,
    intentId,
    amount: options.amount,
    currency: options.currency || 'USD',
    nonce,
    signedPayload,
    signature: signedPayload,
    expiresAt: orderInfo.expiresAt,
    invoiceSlug,
    orderInfo: options.orderInfo,
    title: options.title || 'Digital Purchase',
    timeStamp: options.timeStamp,
    nonceStr: options.nonceStr,
    package: options.package,
    signType: options.signType,
    paySign: options.paySign,
  };
}

/**
 * uni.requestPayment
 */
export function requestPayment(options: RequestPaymentOptions = {}): Promise<PaymentResult> {
  const payload = buildPaymentPayload(options);

  return callBridgeAction('OPEN_INVOICE', payload)
    .catch(() => callBridgeAction('REQUEST_PAYMENT', payload))
    .then((nativeRes: any) => {
      if (nativeRes?.status === 'CANCELLED' || nativeRes?.cancel) {
        const cancelError: UniError = { errMsg: 'requestPayment:fail cancel' };
        options.fail?.(cancelError);
        options.complete?.(cancelError);
        return Promise.reject(cancelError);
      }

      const result: PaymentResult = {
        errMsg: 'requestPayment:ok',
        transactionId: nativeRes?.transactionId || `tx_${Date.now()}`,
        rawResponse: nativeRes,
      };

      options.success?.(result);
      options.complete?.(result);
      return result;
    })
    .catch((err: any) => {
      const errMsg = err?.errMsg || `requestPayment:fail ${err?.message || 'payment error'}`;
      const error: UniError = { errMsg, details: err };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}
