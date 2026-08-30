import { VDomPatch, UiPatchPayload, UiEventPayload, BridgeCallPayload } from '../types.js';

export type { VDomPatch, UiPatchPayload, UiEventPayload, BridgeCallPayload };

export interface DomNodeLike {
  nodeType: number;
  nodeName: string;
  childNodes: DomNodeLike[];
  parentNode: DomNodeLike | null;
  nodeValue: string | null;
  textContent: string;
  className?: string;
  style?: Record<string, any> | { cssText: string };
  dataset?: Record<string, string>;
  id?: string;
  appendChild(child: DomNodeLike): DomNodeLike;
  removeChild(child: DomNodeLike): DomNodeLike;
  replaceChild(newChild: DomNodeLike, oldChild: DomNodeLike): DomNodeLike;
  insertBefore(newChild: DomNodeLike, refChild: DomNodeLike | null): DomNodeLike;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getAttribute(name: string): string | null;
  addEventListener?(type: string, listener: (e: any) => void, useCapture?: boolean): void;
  removeEventListener?(type: string, listener: (e: any) => void, useCapture?: boolean): void;
}
