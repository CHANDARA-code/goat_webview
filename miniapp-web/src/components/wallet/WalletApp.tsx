import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Descriptions,
  Divider,
  Flex,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  DisconnectOutlined,
  ExperimentOutlined,
  KeyOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  UnlockOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { bridge } from '../../miniapp-bridge';

const { Text, Paragraph } = Typography;

/**
 * Live exercise of the wallet, passkey and hardware-vault surface.
 *
 * Two things this screen deliberately shows rather than hides:
 *  - when the host has registered no real `GoatWalletAdapter`, responses come back tagged
 *    `simulated: true`, and that is rendered as a warning rather than styled to look like a
 *    successful signature;
 *  - the Permit2 example requests an unlimited (`2^160-1`) allowance, which is exactly the
 *    payload a drainer sends. The native modal is what turns that into a visible threat badge.
 */

const PERMIT2_CONTRACT = '0x000000000022d473030f116ddee9f6b43ac78ba3';
const UINT160_MAX = '1461501637330902918203684832716283019655932542975';

interface ProviderRow {
  key: string;
  label: string;
  present: boolean;
  detail: string;
}

export const WalletApp: React.FC = () => {
  const { message } = App.useApp();

  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [account, setAccount] = useState<Record<string, unknown> | null>(null);
  const [lastResult, setLastResult] = useState<{ title: string; body: unknown } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [passkeySupport, setPasskeySupport] = useState<Record<string, unknown> | null>(null);
  const [envelope, setEnvelope] = useState<Record<string, unknown> | null>(null);

  const simulated = useMemo(() => {
    const body = lastResult?.body as Record<string, unknown> | undefined;
    return body?.simulated === true || (account?.wallet as string | undefined)?.includes('simulated');
  }, [lastResult, account]);

  const scanProviders = useCallback(() => {
    const w = window as any;
    const announced: string[] = [];
    const onAnnounce = (event: any) => {
      const info = event?.detail?.info;
      if (info?.rdns) announced.push(info.rdns);
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce as EventListener);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    window.removeEventListener('eip6963:announceProvider', onAnnounce as EventListener);

    setProviders([
      {
        key: 'eip6963',
        label: 'EIP-6963 discovery',
        present: announced.length > 0,
        detail: announced.length ? announced.join(', ') : 'no provider announced',
      },
      {
        key: 'ethereum',
        label: 'window.ethereum (EIP-1193)',
        present: !!w.ethereum,
        detail: w.ethereum?.isGoat ? 'goat provider' : w.ethereum ? 'third-party provider' : 'absent',
      },
      {
        key: 'solana',
        label: 'Solana Wallet Standard',
        present: Array.isArray(w.navigator?.wallets) || !!w.solana,
        detail: w.solana ? 'window.solana present' : 'navigator.wallets only',
      },
      {
        key: 'tonconnect',
        label: 'TonConnect v2',
        present: !!w.tonconnect,
        detail: w.tonconnect ? `protocol v${w.tonconnect.protocolVersion}` : 'absent',
      },
      {
        key: 'passkey',
        label: 'window.goat.passkey / goat.vault',
        present: !!w.goat?.passkey && !!w.goat?.vault,
        detail: w.goat?.passkey ? 'installed at document-start' : 'absent',
      },
    ]);
  }, []);

  useEffect(() => {
    scanProviders();
  }, [scanProviders]);

  const run = useCallback(
    async (label: string, key: string, fn: () => Promise<unknown>) => {
      setBusy(key);
      try {
        const res = await fn();
        setLastResult({ title: label, body: res });
        message.success(`${label} completed`);
        return res;
      } catch (err: any) {
        setLastResult({ title: `${label} — rejected`, body: err?.message ?? String(err) });
        // A rejection is the expected outcome for several of these (a stale gesture, an
        // undeclared rpId). Surfacing it verbatim is the point of the demo.
        message.warning(err?.message ?? `${label} failed`);
        return null;
      } finally {
        setBusy(null);
      }
    },
    [message]
  );

  const connect = () =>
    run('Connect wallet', 'connect', async () => {
      const res = await bridge.connectWeb3Wallet('ethereum');
      setAccount(res as unknown as Record<string, unknown>);
      return res;
    });

  const disconnect = () =>
    run('Disconnect', 'disconnect', async () => {
      const res = await bridge.disconnectWeb3Wallet();
      setAccount(null);
      return res;
    });

  const signPermit2 = () =>
    run('Sign Permit2 (unlimited)', 'permit2', () =>
      bridge.signWeb3Message({
        messageType: 'eth_signTypedData_v4',
        message: JSON.stringify({
          primaryType: 'PermitSingle',
          domain: { name: 'Permit2', chainId: '1', verifyingContract: PERMIT2_CONTRACT },
          message: {
            details: { token: '0xA0b8...', amount: UINT160_MAX, expiration: '1900000000', nonce: '0' },
            spender: '0x1111111111111111111111111111111111111111',
            sigDeadline: '1900000000',
          },
        }),
      })
    );

  const switchChain = () =>
    run('Switch to Polygon', 'switch', () => bridge.switchWeb3Chain('eip155:137'));

  const checkPasskeys = () =>
    run('Check passkey support', 'pk-support', async () => {
      const res = await (window as any).goat?.passkey?.checkBiometrics?.();
      setPasskeySupport(res ?? null);
      return res ?? 'window.goat.passkey is not installed in this context';
    });

  const registerPasskey = () =>
    run('Register passkey', 'pk-register', () =>
      (window as any).goat.passkey.register({ username: 'demo@goat.dev', displayName: 'Goat Demo' })
    );

  const encryptVault = () =>
    run('Vault encrypt', 'vault-enc', async () => {
      const res = await (window as any).goat.vault.encrypt('demo_vault', 'the launch codes');
      setEnvelope(res);
      return res;
    });

  const decryptVault = () =>
    run('Vault decrypt', 'vault-dec', () =>
      (window as any).goat.vault.decrypt('demo_vault', envelope)
    );

  return (
    <div className="p-4 space-y-4">
      <Card
        size="small"
        title={
          <Space>
            <ApiOutlined />
            Injected providers
          </Space>
        }
        extra={<Button size="small" onClick={scanProviders}>Rescan</Button>}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          {providers.map((p) => (
            <Flex key={p.key} justify="space-between" align="center">
              <Space>
                <Badge status={p.present ? 'success' : 'default'} />
                <Text>{p.label}</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>{p.detail}</Text>
            </Flex>
          ))}
        </Space>
      </Card>

      {simulated && (
        <Alert
          type="warning"
          showIcon
          icon={<ExperimentOutlined />}
          message="Reference adapter is answering"
          description="No production GoatWalletAdapter is registered on this host, so signatures are deterministic placeholders tagged simulated: true. They are not cryptographic."
        />
      )}

      <Card size="small" title={<Space><SafetyCertificateOutlined />Wallet</Space>}>
        {account ? (
          <Descriptions
            size="small"
            column={1}
            items={[
              { key: 'address', label: 'Address', children: <Text code>{String(account.address)}</Text> },
              { key: 'wallet', label: 'Wallet', children: String(account.wallet ?? '—') },
              { key: 'network', label: 'Network', children: String(account.network ?? '—') },
              { key: 'chain', label: 'Chain ID', children: <Tag>{String(account.chainId ?? '—')}</Tag> },
            ]}
          />
        ) : (
          <Paragraph type="secondary" style={{ marginBottom: 12 }}>
            Not connected.
          </Paragraph>
        )}

        <Divider style={{ margin: '12px 0' }} />

        <Space wrap>
          <Button type="primary" icon={<ApiOutlined />} loading={busy === 'connect'} onClick={connect}>
            Connect
          </Button>
          <Button
            danger
            icon={<WarningOutlined />}
            loading={busy === 'permit2'}
            disabled={!account}
            onClick={signPermit2}
          >
            Sign unlimited Permit2
          </Button>
          <Button icon={<SwapOutlined />} loading={busy === 'switch'} disabled={!account} onClick={switchChain}>
            Switch chain
          </Button>
          <Button icon={<DisconnectOutlined />} loading={busy === 'disconnect'} disabled={!account} onClick={disconnect}>
            Disconnect
          </Button>
        </Space>

        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          message="Why the Permit2 button is dangerous"
          description={`It requests an unlimited (2^160-1) allowance — the exact payload a drainer sends. It costs no gas and produces no transaction, which is why the native modal decodes it and shows a critical threat badge instead of letting it through silently.`}
        />
      </Card>

      <Card size="small" title={<Space><KeyOutlined />Passkeys &amp; hardware vault</Space>}>
        {passkeySupport && (
          <Descriptions
            size="small"
            column={1}
            style={{ marginBottom: 12 }}
            items={[
              { key: 's', label: 'Supported', children: String(passkeySupport.supported) },
              { key: 'b', label: 'Biometry', children: String(passkeySupport.biometryType) },
              { key: 'p', label: 'CTAP2 PRF', children: String(passkeySupport.prfSupported) },
              { key: 'v', label: 'Vault mode', children: <Tag>{String(passkeySupport.vaultMode)}</Tag> },
            ]}
          />
        )}

        <Space wrap>
          <Button icon={<CheckCircleOutlined />} loading={busy === 'pk-support'} onClick={checkPasskeys}>
            Check support
          </Button>
          <Button icon={<KeyOutlined />} loading={busy === 'pk-register'} onClick={registerPasskey}>
            Register passkey
          </Button>
          <Button icon={<LockOutlined />} loading={busy === 'vault-enc'} onClick={encryptVault}>
            Vault encrypt
          </Button>
          <Button icon={<UnlockOutlined />} loading={busy === 'vault-dec'} disabled={!envelope} onClick={decryptVault}>
            Vault decrypt
          </Button>
        </Space>

        <Alert
          style={{ marginTop: 12 }}
          type="success"
          showIcon
          message="The key never reaches this page"
          description="Encryption and decryption happen natively. There is no deriveKey action, and the CTAP2 PRF output is stripped from every passkey response before it crosses the bridge."
        />
      </Card>

      {lastResult && (
        <Card size="small" title={lastResult.title}>
          <pre style={{ margin: 0, fontSize: 11, overflowX: 'auto' }}>
            {typeof lastResult.body === 'string'
              ? lastResult.body
              : JSON.stringify(lastResult.body, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
};
