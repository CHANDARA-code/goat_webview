"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useGoatWallet = useGoatWallet;
const react_1 = require("react");
const GoatBridge_1 = require("../GoatBridge");
/**
 * Wallet state and actions for a React Native host.
 *
 * Errors are surfaced both by rejecting the returned promise and in [error]; the hook never
 * resolves with a synthesised account or signature. A caller that renders "connected" must have
 * observed a real native response.
 */
function useGoatWallet(appId) {
    const [state, setState] = (0, react_1.useState)({
        account: null,
        connecting: false,
        error: null,
    });
    const connect = (0, react_1.useCallback)(async (options = {}) => {
        setState((s) => ({ ...s, connecting: true, error: null }));
        try {
            const account = (await GoatBridge_1.goatBridge.web3ConnectWallet(options, appId));
            setState({ account, connecting: false, error: null });
            return account;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            setState({ account: null, connecting: false, error });
            throw error;
        }
    }, [appId]);
    const disconnect = (0, react_1.useCallback)(async () => {
        try {
            const res = await GoatBridge_1.goatBridge.web3Disconnect(appId);
            setState({ account: null, connecting: false, error: null });
            return res;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            setState((s) => ({ ...s, error }));
            throw error;
        }
    }, [appId]);
    const refresh = (0, react_1.useCallback)(async () => {
        const res = await GoatBridge_1.goatBridge.web3GetAccount(appId);
        const account = res?.connected ? res : null;
        setState((s) => ({ ...s, account, error: null }));
        return account;
    }, [appId]);
    const signTransaction = (0, react_1.useCallback)((options) => GoatBridge_1.goatBridge.web3SignTransaction(options, appId), [appId]);
    const signMessage = (0, react_1.useCallback)((options) => GoatBridge_1.goatBridge.web3SignMessage(options, appId), [appId]);
    const switchChain = (0, react_1.useCallback)((options) => GoatBridge_1.goatBridge.web3SwitchChain(options, appId), [appId]);
    return (0, react_1.useMemo)(() => ({ ...state, connect, disconnect, refresh, signTransaction, signMessage, switchChain }), [state, connect, disconnect, refresh, signTransaction, signMessage, switchChain]);
}
