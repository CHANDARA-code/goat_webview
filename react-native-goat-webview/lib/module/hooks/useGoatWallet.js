import { useCallback, useMemo, useState } from 'react';
import { goatBridge } from '../GoatBridge';
/**
 * Wallet state and actions for a React Native host.
 *
 * Errors are surfaced both by rejecting the returned promise and in [error]; the hook never
 * resolves with a synthesised account or signature. A caller that renders "connected" must have
 * observed a real native response.
 */
export function useGoatWallet(appId) {
    const [state, setState] = useState({
        account: null,
        connecting: false,
        error: null,
    });
    const connect = useCallback(async (options = {}) => {
        setState((s) => ({ ...s, connecting: true, error: null }));
        try {
            const account = (await goatBridge.web3ConnectWallet(options, appId));
            setState({ account, connecting: false, error: null });
            return account;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            setState({ account: null, connecting: false, error });
            throw error;
        }
    }, [appId]);
    const disconnect = useCallback(async () => {
        try {
            const res = await goatBridge.web3Disconnect(appId);
            setState({ account: null, connecting: false, error: null });
            return res;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            setState((s) => ({ ...s, error }));
            throw error;
        }
    }, [appId]);
    const refresh = useCallback(async () => {
        const res = await goatBridge.web3GetAccount(appId);
        const account = res?.connected ? res : null;
        setState((s) => ({ ...s, account, error: null }));
        return account;
    }, [appId]);
    const signTransaction = useCallback((options) => goatBridge.web3SignTransaction(options, appId), [appId]);
    const signMessage = useCallback((options) => goatBridge.web3SignMessage(options, appId), [appId]);
    const switchChain = useCallback((options) => goatBridge.web3SwitchChain(options, appId), [appId]);
    return useMemo(() => ({ ...state, connect, disconnect, refresh, signTransaction, signMessage, switchChain }), [state, connect, disconnect, refresh, signTransaction, signMessage, switchChain]);
}
