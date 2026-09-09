import { goatBridge } from '../GoatBridge';
import { GoatWebViewNativeModule } from '../GoatBridge';

/**
 * These assert the property the 2026-09-06 audit found missing across every RN companion: the
 * binding must actually reach the engine, and must never synthesise a result. A wallet or passkey
 * method that resolves without `executeAction` having been called is an auth/consent bypass.
 */
describe('React Native wallet & passkey bindings', () => {
  const calls: Array<{ action: string; payload: any }> = [];
  let original: any;

  beforeEach(() => {
    calls.length = 0;
    // Unlinked, GoatWebViewNativeModule is a throwing Proxy; installing a real property makes it
    // behave like a linked host for these tests.
    original = undefined;
    try {
      original = (GoatWebViewNativeModule as any).executeAction;
    } catch {
      original = undefined;
    }
    (GoatWebViewNativeModule as any).executeAction = async (action: string, payload: any) => {
      calls.push({ action, payload });
      if (action === 'WEB3_SIGN_TRANSACTION') return { signature: '0xsig', txHash: '0xhash' };
      if (action === 'VAULT_ENCRYPT') return { version: 1, vaultId: payload.vaultId, ciphertext: 'Y2k' };
      if (action === 'WEB3_GET_ACCOUNT') return { connected: false };
      return { ok: true };
    };
  });

  afterEach(() => {
    try {
      (GoatWebViewNativeModule as any).executeAction = original;
    } catch {
      /* the unlinked Proxy rejects writes too */
    }
  });

  it('routes every wallet action to the engine with the canonical action string', async () => {
    await goatBridge.web3ConnectWallet({ network: 'ethereum' });
    await goatBridge.web3SignTransaction({ to: '0xdead', amount: '1' });
    await goatBridge.web3SignMessage({ message: 'hi', messageType: 'personal_sign' });
    await goatBridge.web3SwitchChain({ chainId: '137' });
    await goatBridge.web3Disconnect();
    await goatBridge.web3GetAccount();

    expect(calls.map((c) => c.action)).toEqual([
      'WEB3_CONNECT_WALLET',
      'WEB3_SIGN_TRANSACTION',
      'WEB3_SIGN_MESSAGE',
      'WEB3_SWITCH_CHAIN',
      'WEB3_DISCONNECT',
      'WEB3_GET_ACCOUNT',
    ]);
  });

  it('routes every passkey and vault action to the engine', async () => {
    await goatBridge.passkeyCheckSupport();
    await goatBridge.passkeyRegister({ optionsJson: '{}', rpId: 'shop.example.com' });
    await goatBridge.passkeyAssert({ optionsJson: '{}', rpId: 'shop.example.com' });
    await goatBridge.vaultEncrypt({ vaultId: 'v', plaintext: 'secret' });
    await goatBridge.vaultDecrypt({ vaultId: 'v', envelope: { ciphertext: 'Y2k' } });

    expect(calls.map((c) => c.action)).toEqual([
      'PASSKEY_CHECK_SUPPORT',
      'PASSKEY_REGISTER',
      'PASSKEY_ASSERT',
      'VAULT_ENCRYPT',
      'VAULT_DECRYPT',
    ]);
  });

  it('propagates a native rejection instead of falling back to a synthesised result', async () => {
    (GoatWebViewNativeModule as any).executeAction = async () => {
      throw new Error('GESTURE_REQUIRED: stale gesture');
    };

    await expect(goatBridge.web3SignTransaction({ to: '0xdead' })).rejects.toThrow('GESTURE_REQUIRED');
    await expect(goatBridge.passkeyAssert({ optionsJson: '{}' })).rejects.toThrow('GESTURE_REQUIRED');
    await expect(goatBridge.vaultDecrypt({ vaultId: 'v', envelope: {} })).rejects.toThrow('GESTURE_REQUIRED');
  });

  it('fails loudly when the native module is missing rather than pretending to succeed', async () => {
    (GoatWebViewNativeModule as any).executeAction = undefined;
    await expect(goatBridge.web3SignTransaction({ to: '0xdead' })).rejects.toThrow('native module is unavailable');
    await expect(goatBridge.vaultEncrypt({ vaultId: 'v', plaintext: 'x' })).rejects.toThrow(
      'native module is unavailable'
    );
  });

  it('carries the payload through unmodified', async () => {
    await goatBridge.web3SignMessage({ message: 'permit', messageType: 'eth_signTypedData_v4' });
    expect(calls[0].payload).toEqual({ message: 'permit', messageType: 'eth_signTypedData_v4' });
  });
});
