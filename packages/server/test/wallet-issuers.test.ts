import { describe, expect, it } from 'vitest';
import { createHash, createVerify, generateKeyPairSync } from 'node:crypto';
import { GoogleWalletIssuer } from '../src/wallet/google-wallet.service.js';
import type { GoogleWalletObject } from '../src/wallet/google-wallet.types.js';
import {
  PkPassBuildError,
  PkPassBuilder,
  UnconfiguredPkPassSigner,
  type PkPassFile,
  type PkPassSigner,
} from '../src/wallet/pkpass.service.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

function issuer() {
  return new GoogleWalletIssuer({ issuerEmail: 'issuer@goat.iam.gserviceaccount.com', privateKeyPem });
}

const loyalty: GoogleWalletObject = {
  kind: 'loyalty',
  object: {
    id: '3388000000022222222.SN-1',
    classId: '3388000000022222222.coffee',
    accountName: 'Ada Lovelace',
    barcode: { type: 'QR_CODE', value: 'SN-1' },
  },
};

function decodeSegment(segment: string): any {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

describe('Google Wallet issuer (PASS-G-08)', () => {
  it('signs a save JWT the client-side structural validator accepts', () => {
    const jwt = issuer().createSaveJwt([loyalty], { origins: ['https://shop.example.com'] });

    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
    // Same shape check the native GoogleWalletJwtValidator performs.
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
      expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces a signature that actually verifies against the issuer key', () => {
    const jwt = issuer().createSaveJwt([loyalty], {
      origins: ['https://shop.example.com'],
      issuedAtEpochSeconds: 1_700_000_000,
    });
    const [header, payload, signature] = jwt.split('.');

    const verified = createVerify('RSA-SHA256')
      .update(`${header}.${payload}`)
      .verify(publicKey, Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));

    expect(verified).toBe(true);
  });

  it('carries the claims Google requires', () => {
    const jwt = issuer().createSaveJwt([loyalty], {
      origins: ['https://shop.example.com'],
      issuedAtEpochSeconds: 1_700_000_000,
    });
    const payload = decodeSegment(jwt.split('.')[1]);

    expect(payload.iss).toBe('issuer@goat.iam.gserviceaccount.com');
    expect(payload.aud).toBe('google');
    expect(payload.typ).toBe('savetowallet');
    expect(payload.iat).toBe(1_700_000_000);
    expect(payload.origins).toEqual(['https://shop.example.com']);
    expect(decodeSegment(jwt.split('.')[0])).toEqual({ alg: 'RS256', typ: 'JWT' });
  });

  it('groups objects into the arrays the REST API names', () => {
    const grouped = GoogleWalletIssuer.groupObjects([
      loyalty,
      { kind: 'generic', object: { id: 'g1', classId: 'c1' } },
      { kind: 'boardingPass', object: { id: 'b1', classId: 'c2', passengerName: 'Ada' } },
    ]);
    expect(Object.keys(grouped).sort()).toEqual(['boardingPassObjects', 'genericObjects', 'loyaltyObjects']);
    expect(grouped.loyaltyObjects).toHaveLength(1);
  });

  it('merges `extra` fields verbatim so unmodelled API fields still ship', () => {
    const grouped = GoogleWalletIssuer.groupObjects([
      { kind: 'generic', object: { id: 'g1', classId: 'c1', extra: { heroImage: { sourceUri: { uri: 'x' } } } } },
    ]);
    const object = grouped.genericObjects[0] as Record<string, unknown>;
    expect(object.heroImage).toEqual({ sourceUri: { uri: 'x' } });
    expect(object).not.toHaveProperty('extra');
  });

  it('refuses an empty origins list rather than issuing a pass that never saves', () => {
    expect(() => issuer().createSaveJwt([loyalty], { origins: [] })).toThrow(/origin/i);
  });

  it('refuses to issue a JWT with no objects', () => {
    expect(() => issuer().createSaveJwt([], { origins: ['https://x.example'] })).toThrow(/at least one/i);
  });

  it('rejects credentials that are not a PEM private key', () => {
    expect(() => new GoogleWalletIssuer({ issuerEmail: 'a@b', privateKeyPem: 'not-a-key' })).toThrow(/PEM/);
    expect(() => new GoogleWalletIssuer({ issuerEmail: '', privateKeyPem })).toThrow(/issuerEmail/);
  });
});

describe('PassKit bundle builder (PASS-A-11)', () => {
  const passJson = Buffer.from(
    JSON.stringify({
      formatVersion: 1,
      passTypeIdentifier: 'pass.com.example.loyalty',
      serialNumber: 'SN-1',
      teamIdentifier: 'ABCDE12345',
      organizationName: 'Example Coffee',
      description: 'Coffee loyalty card',
    }),
    'utf8'
  );

  const files: PkPassFile[] = [
    { name: 'pass.json', contents: passJson },
    { name: 'icon.png', contents: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  ];

  const fakeSigner: PkPassSigner = { async sign(manifest) { return Buffer.concat([Buffer.from('SIG'), manifest.subarray(0, 4)]); } };

  it('hashes every file with SHA-1, as PassKit defines the manifest', () => {
    const manifest = JSON.parse(PkPassBuilder.buildManifest(files).toString('utf8'));
    expect(manifest['pass.json']).toBe(createHash('sha1').update(passJson).digest('hex'));
    expect(manifest['pass.json']).toHaveLength(40);
    // Not SHA-256: a 64-char digest here produces a bundle Wallet rejects.
    expect(manifest['pass.json']).not.toBe(createHash('sha256').update(passJson).digest('hex'));
  });

  it('emits a byte-identical manifest for the same inputs regardless of file order', () => {
    const a = PkPassBuilder.buildManifest(files);
    const b = PkPassBuilder.buildManifest([...files].reverse());
    expect(a.equals(b)).toBe(true);
  });

  it('returns the full bundle including manifest and signature', async () => {
    const built = await new PkPassBuilder(fakeSigner).build(files);
    const names = built.map((f) => f.name).sort();
    expect(names).toEqual(['icon.png', 'manifest.json', 'pass.json', 'signature']);
    expect(built.find((f) => f.name === 'signature')!.contents.length).toBeGreaterThan(0);
  });

  it('refuses a bundle missing a file Apple requires', async () => {
    await expect(
      new PkPassBuilder(fakeSigner).build([{ name: 'pass.json', contents: passJson }])
    ).rejects.toThrow(/icon\.png/);
  });

  it('refuses reserved filenames rather than silently overwriting them', () => {
    expect(() =>
      PkPassBuilder.validate([...files, { name: 'manifest.json', contents: Buffer.from('{}') }])
    ).toThrow(/generated by the builder/);
  });

  it('refuses duplicate filenames', () => {
    expect(() => PkPassBuilder.validate([...files, { name: 'icon.png', contents: Buffer.from('x') }]))
      .toThrow(/duplicate/);
  });

  it('validates the fields pass.json must carry', () => {
    for (const missing of ['passTypeIdentifier', 'serialNumber', 'teamIdentifier', 'organizationName', 'description']) {
      const parsed = JSON.parse(passJson.toString('utf8'));
      delete parsed[missing];
      expect(() =>
        PkPassBuilder.validate([
          { name: 'pass.json', contents: Buffer.from(JSON.stringify(parsed)) },
          files[1],
        ])
      ).toThrow(new RegExp(missing));
    }
  });

  it('rejects malformed pass.json', () => {
    expect(() =>
      PkPassBuilder.validate([{ name: 'pass.json', contents: Buffer.from('not json') }, files[1]])
    ).toThrow(/not valid JSON/);
  });

  it('refuses to emit a pass when the signer returns nothing', async () => {
    const emptySigner: PkPassSigner = { async sign() { return Buffer.alloc(0); } };
    await expect(new PkPassBuilder(emptySigner).build(files)).rejects.toThrow(/unsigned pass/);
  });

  it('fails closed with actionable guidance when no signer is configured', async () => {
    await expect(new PkPassBuilder(new UnconfiguredPkPassSigner()).build(files))
      .rejects.toThrow(/openssl smime -sign/);
  });

  it('derives the pass id the client tracks', () => {
    expect(PkPassBuilder.passIdFrom(passJson)).toBe('pass.com.example.loyalty:SN-1');
  });
});
