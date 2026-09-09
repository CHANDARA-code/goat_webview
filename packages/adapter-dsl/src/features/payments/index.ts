import { defineFeature } from "../types";

export const paymentsFeature = defineFeature(
  "payments",
  {
    requestPayment: "REQUEST_PAYMENT",
    tradePay: "REQUEST_PAYMENT",
    queryPayment: "QUERY_PAYMENT_STATUS",
    cancelPayment: "CANCEL_PAYMENT",
    openInvoice: "OPEN_INVOICE",
    getPurchaseProducts: "GET_PURCHASE_PRODUCTS",
    restorePurchases: "RESTORE_PURCHASES",
    connectWallet: "WEB3_CONNECT_WALLET",
    signTransaction: "WEB3_SIGN_TRANSACTION",
    disconnectWallet: "WEB3_DISCONNECT",
    getAccount: "WEB3_GET_ACCOUNT",
  },
  {
    verifyReceipt: "VERIFY_RECEIPT",
  },
);
export default paymentsFeature;
