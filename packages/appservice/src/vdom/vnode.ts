import { VNode, VNodeType, VNodeProps } from '../types.js';

let nodeIdCounter = 0;

export function resetNodeIdCounter(): void {
  nodeIdCounter = 0;
}

export function createVNode(
  tag: string,
  props: VNodeProps = {},
  children: VNode[] = [],
  text?: string,
  key?: string | number,
  type: VNodeType = 'ELEMENT'
): VNode {
  const nodeId = props.id ? String(props.id) : `vnode_${tag}_${++nodeIdCounter}`;
  const effectiveKey = key !== undefined ? key : props.key;

  return {
    type,
    nodeId,
    tag: tag.toLowerCase(),
    props,
    children,
    text,
    key: effectiveKey,
  };
}

export function createTextVNode(text: string, key?: string | number): VNode {
  return {
    type: 'TEXT',
    nodeId: `txt_${++nodeIdCounter}`,
    tag: '#text',
    props: {},
    children: [],
    text,
    key,
  };
}
