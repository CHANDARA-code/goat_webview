export interface ProjectShareState {
  name: string;
  code: string;
  template: string;
  platform: 'ios' | 'android' | 'web';
  device: string;
  deviceColor?: string;
  hardware?: {
    batteryLevel?: number;
    networkType?: string;
    theme?: string;
    mockResult?: string;
  };
  chaos?: {
    enabled: boolean;
    rate: number;
  };
}

export function encodeProjectState(state: ProjectShareState): string {
  try {
    const jsonStr = JSON.stringify(state);
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(jsonStr, 'utf-8').toString('base64url');
    }
    const bytes = new TextEncoder().encode(jsonStr);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

export function decodeProjectState(hash: string): ProjectShareState | null {
  try {
    if (!hash) return null;
    let clean = hash.startsWith('#') ? hash.slice(1) : hash;
    if (clean.startsWith('project=')) {
      clean = clean.slice('project='.length);
    }
    if (!clean) return null;
    let jsonStr = '';
    if (typeof Buffer !== 'undefined') {
      jsonStr = Buffer.from(clean, 'base64url').toString('utf-8');
    } else {
      let b64 = clean.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      jsonStr = new TextDecoder().decode(bytes);
    }
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.code === 'string') {
      return parsed as ProjectShareState;
    }
    return null;
  } catch {
    return null;
  }
}
