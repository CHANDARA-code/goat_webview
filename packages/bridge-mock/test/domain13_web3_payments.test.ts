import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState } from '../src/index.js';

test('Domain 13: Web3 & Payments', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('WEB3_CONNECT_WALLET, GET_ACCOUNT, DISCONNECT', async () => {
    const conn = await bridge.callNative('WEB3_CONNECT_WALLET', { network: 'Polygon Mainnet' });
    assert.equal(conn.network, 'Polygon Mainnet');
    assert.equal(typeof conn.address, 'string');
    assert.match(conn.address, /^0x/);

    const account = await bridge.callNative('WEB3_GET_ACCOUNT');
    assert.equal(account.connected, true);
    assert.equal(account.address, conn.address);

    const disconn = await bridge.callNative('WEB3_DISCONNECT');
    assert.equal(disconn.disconnected, true);

    const afterDisconn = await bridge.callNative('WEB3_GET_ACCOUNT');
    assert.equal(afterDisconn.connected, false);
  });

  await t.test('WEB3_SIGN_TRANSACTION produces cryptographic signature', async () => {
    await bridge.callNative('WEB3_CONNECT_WALLET');
    const signRes = await bridge.callNative('WEB3_SIGN_TRANSACTION', {
      to: '0x3568cE4d51Ea722339C9b626e2e283F15E0F2B0b',
      amount: '0.05',
    });
    assert.match(signRes.signature, /^0x/);
    assert.match(signRes.txHash, /^0x/);
    assert.equal(signRes.from, mockState.web3.address);
  });

  await t.test('OPEN_INVOICE completes in-app payment sheet flow', async () => {
    const invRes = await bridge.callNative('OPEN_INVOICE', {
      invoiceSlug: 'inv_annual_subscription_2026',
      title: 'Annual Pro Pass',
      amount: 49.99,
      currency: 'USD',
    });
    assert.equal(invRes.status, 'PAID');
    assert.equal(invRes.invoiceSlug, 'inv_annual_subscription_2026');
    assert.equal(invRes.amount, 49.99);
    assert.match(invRes.transactionId, /^txn_/);
  });

  await t.test('GET_PURCHASE_PRODUCTS and RESTORE_PURCHASES', async () => {
    const productsRes = await bridge.callNative('GET_PURCHASE_PRODUCTS');
    assert.equal(productsRes.products.length >= 3, true);

    const restoreRes = await bridge.callNative('RESTORE_PURCHASES');
    assert.equal(Array.isArray(restoreRes.purchases), true);
  });
});
