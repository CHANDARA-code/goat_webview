import { VNode, VDomPatch } from '../types.js';
import { diff } from './diff.js';

export * from './types.js';
export * from './vnode.js';
export * from './h.js';
export * from './patches.js';
export * from './diff.js';

export class VDomEngine {
  public static createVNode(
    tag: string,
    props: Record<string, unknown> = {},
    children: VNode[] = [],
    text?: string,
    key?: string | number
  ): VNode {
    return { tag, props, children, text, key };
  }

  public static diff(
    oldNode: VNode | null | undefined,
    newNode: VNode | null | undefined,
    path: number[] = []
  ): VDomPatch[] {
    return diff(oldNode, newNode, path);
  }
}
