import { VNode, VDomPatch, ReorderMove } from '../types.js';
import {
  createPatch,
  removePatch,
  replacePatch,
  updatePropsPatch,
  setTextPatch,
  reorderChildrenPatch,
} from './patches.js';

export function diffTrees(oldTree: VNode | null | undefined, newTree: VNode | null | undefined): VDomPatch[] {
  return diff(oldTree, newTree, []);
}

export function diff(
  oldTree: VNode | null | undefined,
  newTree: VNode | null | undefined,
  path: number[] = []
): VDomPatch[] {
  const patches: VDomPatch[] = [];

  // Case 1: Node created
  if (!oldTree && newTree) {
    patches.push(createPatch(path, newTree.nodeId || 'root', newTree));
    return patches;
  }

  // Case 2: Node removed
  if (oldTree && !newTree) {
    patches.push(removePatch(path, oldTree.nodeId || 'root'));
    return patches;
  }

  if (!oldTree || !newTree) {
    return patches;
  }

  // Case 3: Node replaced (different tag or different type or different key)
  if (oldTree.tag !== newTree.tag || (oldTree.key !== undefined && newTree.key !== undefined && oldTree.key !== newTree.key)) {
    patches.push(replacePatch(path, oldTree.nodeId || 'root', newTree));
    return patches;
  }

  // Case 4: Text changed
  if (oldTree.text !== newTree.text) {
    patches.push(setTextPatch(path, oldTree.nodeId || 'root', newTree.text || ''));
  }

  // Case 5: Props updated
  diffProps(oldTree.props || {}, newTree.props || {}, path, oldTree.nodeId || 'root', patches);

  // Case 6: Children diffing & Reordering
  diffChildren(oldTree.children || [], newTree.children || [], path, oldTree.nodeId || 'root', patches);

  return patches;
}

function diffProps(
  oldProps: Record<string, unknown>,
  newProps: Record<string, unknown>,
  path: number[],
  targetNodeId: string,
  patches: VDomPatch[]
): void {
  const setProps: Record<string, unknown> = {};
  const removeProps: string[] = [];

  for (const key in newProps) {
    if (key === 'key') continue;
    if (oldProps[key] !== newProps[key]) {
      setProps[key] = newProps[key];
    }
  }

  for (const key in oldProps) {
    if (key === 'key') continue;
    if (!(key in newProps)) {
      removeProps.push(key);
    }
  }

  if (Object.keys(setProps).length > 0 || removeProps.length > 0) {
    patches.push(updatePropsPatch(path, targetNodeId, setProps, removeProps));
  }
}

function diffChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  parentPath: number[],
  parentNodeId: string,
  patches: VDomPatch[]
): void {
  const hasKeys =
    oldChildren.some((c) => c.key !== undefined) ||
    newChildren.some((c) => c.key !== undefined);

  if (hasKeys) {
    diffKeyedChildren(oldChildren, newChildren, parentPath, parentNodeId, patches);
  } else {
    diffUnkeyedChildren(oldChildren, newChildren, parentPath, parentNodeId, patches);
  }
}

function diffUnkeyedChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  parentPath: number[],
  parentNodeId: string,
  patches: VDomPatch[]
): void {
  const commonLength = Math.min(oldChildren.length, newChildren.length);

  for (let i = 0; i < commonLength; i++) {
    const childPatches = diff(oldChildren[i], newChildren[i], [...parentPath, i]);
    patches.push(...childPatches);
  }

  // New children added
  if (newChildren.length > oldChildren.length) {
    for (let i = commonLength; i < newChildren.length; i++) {
      patches.push(createPatch([...parentPath, i], parentNodeId, newChildren[i], i));
    }
  }

  // Old children removed
  if (oldChildren.length > newChildren.length) {
    for (let i = oldChildren.length - 1; i >= commonLength; i--) {
      patches.push(removePatch([...parentPath, i], oldChildren[i].nodeId || parentNodeId, i));
    }
  }
}

function diffKeyedChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  parentPath: number[],
  parentNodeId: string,
  patches: VDomPatch[]
): void {
  const oldKeyMap = new Map<string | number, { node: VNode; index: number }>();
  oldChildren.forEach((child, index) => {
    const key = child.key !== undefined ? child.key : child.props?.key;
    if (key !== undefined) {
      oldKeyMap.set(key, { node: child, index });
    }
  });

  const newKeyMap = new Map<string | number, { node: VNode; index: number }>();
  newChildren.forEach((child, index) => {
    const key = child.key !== undefined ? child.key : child.props?.key;
    if (key !== undefined) {
      newKeyMap.set(key, { node: child, index });
    }
  });

  const moves: ReorderMove[] = [];
  const newOrderKeys: Array<string | number> = [];
  const order: number[] = [];
  let reordered = false;

  // 1. Remove old keys not in new tree (in descending oldIndex order to avoid index shifts on sequential removal)
  for (let oldIndex = oldChildren.length - 1; oldIndex >= 0; oldIndex--) {
    const oldChild = oldChildren[oldIndex];
    const key = oldChild.key !== undefined ? oldChild.key : oldChild.props?.key;
    if (key !== undefined && !newKeyMap.has(key)) {
      patches.push(removePatch([...parentPath, oldIndex], oldChild.nodeId || parentNodeId, oldIndex));
    }
  }

  // 2. Diff matching nodes and emit create patches for new keys
  newChildren.forEach((newChild, newIndex) => {
    const key = newChild.key !== undefined ? newChild.key : newChild.props?.key;
    if (key !== undefined) {
      newOrderKeys.push(key);
      const match = oldKeyMap.get(key);
      if (match) {
        order.push(match.index);
        if (match.index !== newIndex) {
          reordered = true;
          moves.push({ fromIndex: match.index, toIndex: newIndex, key });
        }
        // Diff matching nodes at the node's current matching index
        const childPatches = diff(match.node, newChild, [...parentPath, match.index]);
        patches.push(...childPatches);
      } else {
        order.push(-1);
        reordered = true;
        patches.push(createPatch([...parentPath, newIndex], parentNodeId, newChild, newIndex));
      }
    } else {
      order.push(-1);
      if (newIndex < oldChildren.length) {
        const childPatches = diff(oldChildren[newIndex], newChild, [...parentPath, newIndex]);
        patches.push(...childPatches);
      } else {
        patches.push(createPatch([...parentPath, newIndex], parentNodeId, newChild, newIndex));
      }
    }
  });

  // 3. Reorder children
  if (reordered || moves.length > 0) {
    patches.push(reorderChildrenPatch(parentPath, parentNodeId, moves, newOrderKeys, order));
  }
}
