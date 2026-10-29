export interface ZipEntry {
  name: string;
  content: string;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function calculateCrc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ bytes[i]) & 0xff];
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZipFile(files: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const fileEntries: Array<{
    nameBytes: Uint8Array;
    contentBytes: Uint8Array;
    crc: number;
    offset: number;
  }> = [];

  const chunks: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const crc = calculateCrc32(contentBytes);
    const size = contentBytes.length;

    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);

    fileEntries.push({ nameBytes, contentBytes, crc, offset });
    chunks.push(header, nameBytes, contentBytes);
    offset += header.length + nameBytes.length + contentBytes.length;
  }

  const centralDirStart = offset;
  let centralDirSize = 0;

  for (const entry of fileEntries) {
    const cdHeader = new Uint8Array(46);
    const view = new DataView(cdHeader.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.contentBytes.length, true);
    view.setUint32(24, entry.contentBytes.length, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);

    chunks.push(cdHeader, entry.nameBytes);
    centralDirSize += cdHeader.length + entry.nameBytes.length;
  }

  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileEntries.length, true);
  view.setUint16(10, fileEntries.length, true);
  view.setUint32(12, centralDirSize, true);
  view.setUint32(16, centralDirStart, true);
  view.setUint16(20, 0, true);
  chunks.push(eocd);

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }

  return result;
}

export function downloadMiniAppZip(projectName: string, userCode: string): void {
  if (typeof window === 'undefined') return;

  const files: ZipEntry[] = [
    {
      name: 'index.html',
      content: userCode,
    },
    {
      name: 'goat.config.json',
      content: JSON.stringify(
        {
          name: projectName,
          version: '1.0.0',
          appId: `miniapp-${Date.now()}`,
          entry: 'index.html',
          targetSdkVersion: '1.4.0',
          permissions: ['LOCATION', 'CAMERA', 'BIOMETRIC', 'CONTACTS'],
        },
        null,
        2
      ),
    },
    {
      name: 'README.md',
      content: `# ${projectName}

Exported from Goat WebView Interactive Simulator.

## Continue Development Locally

To run this mini-app locally using the official Goat CLI:

\`\`\`bash
# 1. Install or run @goat/cli
npx @goat/cli dev

# Or if you have goat installed globally:
goat dev
\`\`\`

## Running in Mobile Superapp Host

- Android: Load \`index.html\` via \`GoatWebView\` with assets or remote domain.
- iOS: Configure \`GoatWKWebView\` with \`GoatBridgeConfig\`.
- All 197 bridge actions documented at https://chandara-code.github.io/goat_webview/api.
`,
    },
  ];

  const zipBytes = buildZipFile(files);
  const blob = new Blob([zipBytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'goat-miniapp'}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
