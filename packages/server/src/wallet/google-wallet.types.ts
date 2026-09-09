/**
 * Google Wallet pass object shapes, narrowed to the fields an issuer must supply.
 *
 * These mirror the REST API v1 resources rather than wrapping them: a caller who knows the Google
 * docs should recognise the field names exactly, and anything not modelled here can be passed
 * through untouched via `extra`.
 */

export type BarcodeType = 'QR_CODE' | 'PDF_417' | 'AZTEC' | 'CODE_128';

export interface GoogleBarcode {
  type: BarcodeType;
  value: string;
  alternateText?: string;
}

export interface GoogleLocalizedString {
  defaultValue: { language: string; value: string };
}

interface BaseObject {
  id: string;
  classId: string;
  state?: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'INACTIVE';
  barcode?: GoogleBarcode;
  /** Fields not modelled above, merged verbatim into the object. */
  extra?: Record<string, unknown>;
}

export interface GenericObject extends BaseObject {
  cardTitle?: GoogleLocalizedString;
  header?: GoogleLocalizedString;
  subheader?: GoogleLocalizedString;
}

export interface LoyaltyObject extends BaseObject {
  accountId?: string;
  accountName?: string;
  loyaltyPoints?: { label?: string; balance?: { string?: string; int?: number } };
}

export interface BoardingPassObject extends BaseObject {
  passengerName?: string;
  boardingAndSeatingInfo?: { boardingGroup?: string; seatNumber?: string };
  reservationInfo?: { confirmationCode?: string };
}

export type GoogleWalletObject =
  | { kind: 'generic'; object: GenericObject }
  | { kind: 'loyalty'; object: LoyaltyObject }
  | { kind: 'boardingPass'; object: BoardingPassObject };

/** The service-account credentials an issuer signs with. */
export interface GoogleWalletIssuerCredentials {
  /** Service account email, becomes the JWT `iss`. */
  issuerEmail: string;
  /** PEM-encoded RSA private key from the service account JSON. */
  privateKeyPem: string;
}

export interface SaveJwtOptions {
  /** Origins permitted to present the save link. Google rejects a save from anywhere else. */
  origins: string[];
  /** Overrides `iat`; present so tests are deterministic rather than clock-dependent. */
  issuedAtEpochSeconds?: number;
}
