import { EventEmitter } from 'events';
import { CDPTargetInfo } from './cdp.types';
import * as crypto from 'crypto';

export class CDPTargetManagerService extends EventEmitter {
  private targets: Map<string, CDPTargetInfo> = new Map();
  private host: string;
  private cdpPort: number;

  constructor(host: string = '127.0.0.1', cdpPort: number = 9222) {
    super();
    this.host = host;
    this.cdpPort = cdpPort;

    // Register a default initial page target
    this.createTarget({
      id: 'target-mini-app-default',
      title: 'Goat MiniApp Container',
      description: 'Goat MiniApp Container [appId: com.goat.default]',
      type: 'page',
      url: 'https://appassets.androidplatform.net/index.html',
      appId: 'com.goat.default',
    });
  }

  public setHostAndPort(host: string, cdpPort: number): void {
    this.host = host;
    this.cdpPort = cdpPort;
  }

  public createTarget(options: {
    id?: string;
    title?: string;
    description?: string;
    type?: 'page' | 'service_worker' | 'browser' | 'other';
    url?: string;
    appId?: string;
    faviconUrl?: string;
  }): CDPTargetInfo {
    const id = options.id || `target-${crypto.randomUUID()}`;
    const title = options.title || `Goat Target ${id.substring(0, 8)}`;
    const type = options.type || 'page';
    const url = options.url || 'about:blank';
    const appId = options.appId || 'com.goat.app';
    const description = options.description || `Goat MiniApp Container [appId: ${appId}]`;
    const faviconUrl = options.faviconUrl || 'https://appassets.androidplatform.net/favicon.ico';

    const wsUrl = `ws://${this.host}:${this.cdpPort}/devtools/page/${id}`;
    const devtoolsFrontendUrl = `devtools://devtools/bundled/inspector.html?ws=${this.host}:${this.cdpPort}/devtools/page/${id}`;

    const target: CDPTargetInfo = {
      id,
      title,
      description,
      type,
      url,
      devtoolsFrontendUrl,
      webSocketDebuggerUrl: wsUrl,
      faviconUrl,
      appId,
      connected: false,
      createdAt: Date.now(),
    };

    this.targets.set(id, target);
    this.emit('targetCreated', target);
    return target;
  }

  public listTargets(): CDPTargetInfo[] {
    return Array.from(this.targets.values());
  }

  public getTarget(id: string): CDPTargetInfo | undefined {
    return this.targets.get(id);
  }

  public activateTarget(id: string): boolean {
    const target = this.targets.get(id);
    if (!target) return false;
    this.emit('targetActivated', target);
    return true;
  }

  public closeTarget(id: string): boolean {
    const target = this.targets.get(id);
    if (!target) return false;
    this.targets.delete(id);
    this.emit('targetClosed', target);
    return true;
  }

  public updateTargetUrl(id: string, url: string, title?: string): CDPTargetInfo | null {
    const target = this.targets.get(id);
    if (!target) return null;
    target.url = url;
    if (title) target.title = title;
    this.emit('targetUpdated', target);
    return target;
  }
}
