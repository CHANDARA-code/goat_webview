import { VNode, VNodeProps } from '../types.js';
import { createVNode, createTextVNode } from './vnode.js';

export function h(
  tag: string,
  props: VNodeProps | null = null,
  ...children: Array<VNode | string | number | boolean | null | undefined | Array<VNode | string | number | boolean | null | undefined>>
): VNode {
  const normalizedProps: VNodeProps = props || {};
  const normalizedChildren: VNode[] = [];

  const flatten = (items: Array<unknown>): void => {
    for (const item of items) {
      if (item === null || item === undefined || item === false || item === true) {
        continue;
      }
      if (Array.isArray(item)) {
        flatten(item);
      } else if (typeof item === 'object' && 'tag' in (item as any)) {
        normalizedChildren.push(item as VNode);
      } else {
        normalizedChildren.push(createTextVNode(String(item)));
      }
    }
  };

  flatten(children);

  return createVNode(
    tag,
    normalizedProps,
    normalizedChildren,
    undefined,
    normalizedProps.key
  );
}
