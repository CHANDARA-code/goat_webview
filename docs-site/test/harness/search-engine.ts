/**
 * In-Memory Search Engine Simulator for Docs Portal & API Catalog
 * Validates instant search indexing, fuzzy query matching, domain filtering, and Cmd+K semantics.
 */

import { DOMAIN_CATALOG } from './api-catalog-oracle.ts';
import type { ActionSpec } from './api-catalog-oracle.ts';

export interface SearchDoc {
  id: string;
  type: 'action' | 'domain' | 'guide' | 'concept';
  title: string;
  domain: string;
  domainId?: number;
  description: string;
  keywords: string[];
  permissions: string[];
  platforms: string[];
  url: string;
  snippet?: string;
}

export interface SearchFilter {
  domain?: string;
  domainId?: number;
  platform?: string;
  type?: 'action' | 'domain' | 'guide' | 'concept';
}

export interface SearchResult {
  doc: SearchDoc;
  score: number;
  matchedFields: string[];
}

export class DocsSearchEngine {
  private documents: SearchDoc[] = [];
  private isIndexed: boolean = false;

  constructor() {
    this.buildIndex();
  }

  /**
   * Builds the comprehensive in-memory inverted index
   */
  public buildIndex(): void {
    this.documents = [];

    // 1. Index all 18 domains and 197 actions
    for (const domain of DOMAIN_CATALOG) {
      // Index domain concept
      this.documents.push({
        id: `domain_${domain.id}`,
        type: 'domain',
        title: domain.name,
        domain: domain.name,
        domainId: domain.id,
        description: domain.description,
        keywords: [domain.slug, 'domain', 'api', 'bridge', ...domain.name.toLowerCase().split(/\s+/)],
        permissions: [],
        platforms: ['android', 'ios', 'react-native', 'flutter', 'web'],
        url: `/docs/bridge/api-reference#domain-${domain.id}`,
      });

      // Index each action
      for (const act of domain.actions) {
        const keywords = [
          act.action.toLowerCase(),
          ...act.aliases.map(a => a.toLowerCase()),
          ...act.permissions.map(p => p.toLowerCase()),
          ...act.expectedReturnFields.map(f => f.toLowerCase()),
          ...act.errorCodes.map(e => e.toLowerCase()),
          domain.name.toLowerCase(),
          domain.slug,
        ];

        this.documents.push({
          id: `act_${act.action}`,
          type: 'action',
          title: act.action,
          domain: domain.name,
          domainId: domain.id,
          description: act.description,
          keywords: Array.from(new Set(keywords)),
          permissions: act.permissions,
          platforms: ['android', 'ios', 'react-native', 'flutter', 'web'],
          url: `/docs/bridge/api-reference#${act.action.toLowerCase().replace(/_/g, '-')}`,
          snippet: `await goatBridge.callNative('${act.action}', ${JSON.stringify(act.samplePayload)});`,
        });
      }
    }

    // 2. Index Documentation Guides
    const guides = [
      { id: 'guide_quickstart', title: 'Quickstart Guide', domain: 'Getting Started', description: 'Get started building Mini-Apps and Host Apps with Goat WebView.', url: '/docs/getting-started/quickstart', keywords: ['quickstart', 'react', 'vue', 'svelte', 'cli', 'install', 'init'] },
      { id: 'guide_android', title: 'Android Kotlin SDK Integration', domain: 'Platforms', description: 'Jetpack Compose GoatView, coroutine bridge, and Android Keystore encryption.', url: '/docs/platforms/android', keywords: ['android', 'kotlin', 'compose', 'gradle', 'dokka', 'aar'] },
      { id: 'guide_ios', title: 'iOS Swift Framework Integration', domain: 'Platforms', description: 'SwiftUI GoatSwiftUIView, WKWebView recycling, and Keychain security enclave.', url: '/docs/platforms/ios', keywords: ['ios', 'swift', 'swiftui', 'wkwebview', 'cocoapods', 'swiftpm'] },
      { id: 'guide_rn', title: 'React Native TurboModule & Fabric', domain: 'Platforms', description: 'React Native Fabric ViewManager, TurboModule JSI bindings, and useGoatBridge.', url: '/docs/platforms/react-native', keywords: ['react-native', 'rn', 'fabric', 'turbomodule', 'jsi', 'hooks'] },
      { id: 'guide_flutter', title: 'Flutter PlatformView & MethodChannels', domain: 'Platforms', description: 'Flutter Hybrid Composition PlatformView and MethodChannel executeAction.', url: '/docs/platforms/flutter', keywords: ['flutter', 'dart', 'platformview', 'methodchannel', 'pub'] },
      { id: 'guide_web', title: 'Web Mini-App SDK & TypeScript Hooks', domain: 'Platforms', description: 'Client-side bridge API, React 19 hooks, and WebMessageListener IPC.', url: '/docs/platforms/web', keywords: ['web', 'typescript', 'sdk', 'hooks', 'miniapp-web', 'vite'] },
      { id: 'arch_stack', title: '120 FPS Page Stack Architecture', domain: 'Architecture', description: 'Multi-WebView hardware-accelerated page transitions and memory pooling.', url: '/docs/architecture/multi-tenant-sandboxing', keywords: ['120fps', 'page stack', 'performance', 'fluidity', 'multi-webview'] },
      { id: 'arch_routing', title: 'Virtual Domain Asset Routing (goat://)', domain: 'Architecture', description: 'Zero-trust virtual origin asset interception and sandboxing.', url: '/docs/architecture/multi-tenant-sandboxing', keywords: ['goat://', 'virtual domain', 'routing', 'asset loader', 'origin'] },
      { id: 'arch_security', title: 'Zero-Trust SSRF & Sandboxing Security', domain: 'Security', description: 'OWASP MASVS compliance, path traversal prevention, and SSRF guardrails.', url: '/docs/security/owasp-masvs-compliance', keywords: ['security', 'ssrf', 'sandboxing', 'owasp', 'masvs', 'zero-trust'] },
      { id: 'arch_cdp', title: 'Remote CDP & Safari Web Inspector Debugging', domain: 'Architecture', description: 'Chrome DevTools Protocol and Safari Web Inspector relay protocol.', url: '/docs/architecture/headless-runtime', keywords: ['cdp', 'chrome devtools', 'safari inspector', 'remote debug', 'websocket'] },
    ];

    for (const g of guides) {
      this.documents.push({
        id: g.id,
        type: 'guide',
        title: g.title,
        domain: g.domain,
        description: g.description,
        keywords: g.keywords,
        permissions: [],
        platforms: ['android', 'ios', 'react-native', 'flutter', 'web'],
        url: g.url,
      });
    }

    this.isIndexed = true;
  }

  /**
   * Total indexed document count
   */
  public getDocumentCount(): number {
    return this.documents.length;
  }

  /**
   * Queries search index with text and optional filter criteria
   */
  public search(rawQuery: string, filter?: SearchFilter): SearchResult[] {
    if (!this.isIndexed) this.buildIndex();

    const query = (rawQuery || '').trim().toLowerCase();
    if (!query && !filter) {
      return [];
    }

    const queryTokens = query.split(/\s+/).filter(Boolean);
    const results: SearchResult[] = [];

    for (const doc of this.documents) {
      // Apply filters
      if (filter) {
        if (filter.type && doc.type !== filter.type) continue;
        if (filter.domain && doc.domain.toLowerCase() !== filter.domain.toLowerCase()) continue;
        if (filter.domainId !== undefined && doc.domainId !== filter.domainId) continue;
        if (filter.platform && !doc.platforms.includes(filter.platform.toLowerCase())) continue;
      }

      if (queryTokens.length === 0) {
        // Filter-only search
        results.push({ doc, score: 1.0, matchedFields: ['filter'] });
        continue;
      }

      let score = 0;
      const matchedFields: string[] = [];

      for (const token of queryTokens) {
        // Exact title match (highest score)
        if (doc.title.toLowerCase() === token) {
          score += 100;
          matchedFields.push('title_exact');
        } else if (doc.title.toLowerCase().startsWith(token)) {
          score += 50;
          matchedFields.push('title_prefix');
        } else if (doc.title.toLowerCase().includes(token)) {
          score += 25;
          matchedFields.push('title_contains');
        }

        // Action string snake_case match
        if (doc.type === 'action' && doc.title.toLowerCase().replace(/_/g, '').includes(token.replace(/_/g, ''))) {
          score += 20;
          matchedFields.push('action_normalized');
        }

        // Keywords match
        for (const kw of doc.keywords) {
          if (kw === token) {
            score += 15;
            matchedFields.push(`keyword_${kw}`);
          } else if (kw.includes(token)) {
            score += 5;
            matchedFields.push(`keyword_sub_${kw}`);
          }
        }

        // Description match
        if (doc.description.toLowerCase().includes(token)) {
          score += 5;
          matchedFields.push('description');
        }
      }

      if (score > 0) {
        results.push({ doc, score, matchedFields });
      }
    }

    // Sort by descending score
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Simulates Cmd+K quick action lookup
   */
  public cmdKLookup(query: string, maxResults: number = 8): SearchResult[] {
    const results = this.search(query);
    return results.slice(0, maxResults);
  }
}
