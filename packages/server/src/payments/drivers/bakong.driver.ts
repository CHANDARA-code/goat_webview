import { PaymentDriver, PaymentDriverIntent, PaymentDriverParams } from './driver.types';

const CURRENCY_NUMERIC: Record<string, string> = { USD: '840', KHR: '116' };

/** Builds one EMVCo Merchant Presented QR TLV field: 2-digit tag + 2-digit length + value. */
function tlv(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
}

/** Standard CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) used by the EMV QR Code spec's tag 63. */
function crc16CcittFalse(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface KhqrBuildParams {
  bakongAccountId: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  currency: 'USD' | 'KHR';
  billNumber: string;
}

/**
 * Builds a Bakong KHQR string following the EMVCo Merchant Presented QR TLV structure that NBC's
 * KHQR standard extends (Task 10206c/d). Field 29 carries the Bakong-specific merchant account
 * info (GUID `KHQR01` + Bakong account identifier); all other fields follow the generic EMVCo
 * layout. Production use should be calibrated against NBC's published KHQR field catalog.
 */
export function buildKhqrString(params: KhqrBuildParams): string {
  const currencyCode = CURRENCY_NUMERIC[params.currency] ?? CURRENCY_NUMERIC.KHR;
  const merchantAccountInfo = tlv('00', 'KHQR01') + tlv('01', params.bakongAccountId);
  const additionalData = tlv('01', params.billNumber.substring(0, 25));

  let payload = '';
  payload += tlv('00', '01'); // Payload Format Indicator
  payload += tlv('01', '12'); // Point of Initiation Method: 12 = dynamic (single-use, has amount)
  payload += tlv('29', merchantAccountInfo); // Bakong merchant account info
  payload += tlv('52', '5999'); // Merchant Category Code (generic retail)
  payload += tlv('53', currencyCode); // ISO 4217 numeric currency code
  payload += tlv('54', params.amount.toFixed(2)); // Transaction amount
  payload += tlv('58', 'KH'); // Country code
  payload += tlv('59', params.merchantName.substring(0, 25)); // Merchant name
  payload += tlv('60', params.merchantCity.substring(0, 15)); // Merchant city
  payload += tlv('62', additionalData); // Additional data field template (bill number)

  const withCrcTag = `${payload}6304`;
  return withCrcTag + crc16CcittFalse(withCrcTag);
}

/**
 * Bakong KHQR driver (Task 10206d). No card rail, no proprietary SDK: the Zone 4 proxy holds
 * the merchant's Bakong account identifier and mints a fresh KHQR string per intent, handed to
 * native purely to render as a QR code.
 */
export class BakongDriver implements PaymentDriver {
  public readonly providerId = 'bakong_khqr';

  constructor(
    private readonly bakongAccountId: string = process.env.GOAT_BAKONG_ACCOUNT_ID || 'merchant@devbank',
    private readonly merchantName: string = process.env.GOAT_BAKONG_MERCHANT_NAME || 'Goat WebView Merchant',
    private readonly merchantCity: string = process.env.GOAT_BAKONG_MERCHANT_CITY || 'Phnom Penh'
  ) {}

  public async createProviderIntent(params: PaymentDriverParams): Promise<PaymentDriverIntent> {
    const currency: 'USD' | 'KHR' = params.currency === 'USD' ? 'USD' : 'KHR';
    const qrString = buildKhqrString({
      bakongAccountId: this.bakongAccountId,
      merchantName: this.merchantName,
      merchantCity: this.merchantCity,
      amount: params.amount / 100,
      currency,
      billNumber: params.orderId,
    });
    return { providerIntentRef: `khqr_${params.intentId}`, clientToken: qrString };
  }
}
