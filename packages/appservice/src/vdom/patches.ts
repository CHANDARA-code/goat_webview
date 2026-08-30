import { VNode, VDomPatch, ReorderMove } from '../types.js';

export function createPatch(
  path: number[],
  targetNodeId: string,
  vnode: VNode,
  insertIndex?: number
): VDomPatch {
  return {
    type: 'CREATE',
    path,
    targetNodeId,
    vnode,
    insertIndex,
  };
}

export function removePatch(
  path: number[],
  targetNodeId: string,
  childIndex?: number
): VDomPatch {
  return {
    type: 'REMOVE',
    path,
    targetNodeId,
    childIndex,
  };
}

export function replacePatch(
  path: number[],
  targetNodeId: string,
  newVNode: VNode
): VDomPatch {
  return {
    type: 'REPLACE',
    path,
    targetNodeId,
    vnode: newVNode,
    newVNode,
  };
}

export function updatePropsPatch(
  path: number[],
  targetNodeId: string,
  set: Record<string, unknown>,
  remove: string[] = []
): VDomPatch {
  const mergedProps: Record<string, unknown> = { ...set };
  for (const r of remove) {
    mergedProps[r] = null;
  }
  return {
    type: 'UPDATE_PROPS',
    path,
    targetNodeId,
    set,
    remove,
    props: mergedProps,
  };
}

export function setTextPatch(
  path: number[],
  targetNodeId: string,
  text: string
): VDomPatch {
  return {
    type: 'SET_TEXT',
    path,
    targetNodeId,
    text,
  };
}

export function reorderChildrenPatch(
  path: number[],
  targetNodeId: string,
  moves: ReorderMove[],
  newOrderKeys: Array<string | number>,
  order?: number[]
): VDomPatch {
  return {
    type: 'REORDER',
    path,
    targetNodeId,
    moves,
    newOrderKeys,
    order,
  };
}
