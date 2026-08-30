/**
 * @goat/bridge-mock - Domain 13: Web3 & Payments Handlers (7 Actions)
 */

import { mockState } from '../state/store.js';
import {
  Web3WalletAccountResult,
  Web3SignedTransactionResult,
  InvoicePaymentResult,
  IapProductItem,
} from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class Web3Handlers {
  private static txNonce: number = 100;

  /**
   * Action 142: WEB3_CONNECT_WALLET
   */
  public static connectWallet(payload: any = {}): Web3WalletAccountResult {
    mockState.web3.connected = true;
    if (payload.network) {
      mockState.web3.network = payload.network;
    }
    return {
      address: mockState.web3.address,
      publicKey: mockState.web3.publicKey,
      wallet: mockState.web3.wallet,
      network: mockState.web3.network,
      chainId: mockState.web3.chainId,
    };
  }

  /**
   * Action 143: WEB3_SIGN_TRANSACTION
   */
  public static signTransaction(payload: any = {}): Web3SignedTransactionResult {
    if (!mockState.isUserGestureFresh(10000)) {
      throw new GoatBridgeError(
        BridgeErrorCodes.GESTURE_REQUIRED,
        'Signing financial transactions requires recent user confirmation touch'
      );
    }
    const to = payload.to;
    if (!to) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required destination address "to"');
    }

    const txNonceVal = ++this.txNonce;
    const txHash = `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`;
    const signature = `0x3a4f8912c0...mock_sig_${txNonceVal}`;

    return {
      signature,
      txHash,
      network: mockState.web3.network,
      from: mockState.web3.address,
    };
  }

  /**
   * Action 144: WEB3_DISCONNECT
   */
  public static disconnect(): { disconnected: boolean } {
    mockState.web3.connected = false;
    return { disconnected: true };
  }

  /**
   * Action 145: WEB3_GET_ACCOUNT
   */
  public static getAccount(): {
    connected: boolean;
    address?: string;
    publicKey?: string;
    wallet?: string;
    network?: string;
    chainId?: string;
  } {
    if (!mockState.web3.connected) {
      return { connected: false };
    }
    return {
      connected: true,
      address: mockState.web3.address,
      publicKey: mockState.web3.publicKey,
      wallet: mockState.web3.wallet,
      network: mockState.web3.network,
      chainId: mockState.web3.chainId,
    };
  }

  /**
   * Action 146: OPEN_INVOICE
   */
  public static openInvoice(payload: any = {}): Promise<InvoicePaymentResult> {
    const invoiceSlug = payload.invoiceSlug;
    if (!invoiceSlug) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "invoiceSlug"');
    }
    const amount = typeof payload.amount === 'number' ? payload.amount : 1000;
    const currency = payload.currency || 'USD';
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const signature = `hmac_sha256_sig_${Math.random().toString(36).substring(2, 12)}`;

    mockState.iapPurchases.push({
      invoiceSlug,
      status: 'PAID',
      transactionId,
      amount,
    });

    return Promise.resolve({
      status: 'PAID',
      invoiceSlug,
      transactionId,
      amount,
      currency,
      signature,
    });
  }

  /**
   * Action 147: GET_PURCHASE_PRODUCTS
   */
  public static getProducts(): { products: IapProductItem[] } {
    return { products: [...mockState.iapProducts] };
  }

  /**
   * Action 148: RESTORE_PURCHASES
   */
  public static restorePurchases(): { purchases: Array<{ invoiceSlug: string; status: string; transactionId: string; amount: number }> } {
    return { purchases: [...mockState.iapPurchases] };
  }
}
