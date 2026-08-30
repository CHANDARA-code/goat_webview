/**
 * Tier 1 - Feature Coverage: F4 Virtual DOM Diff/Patch Protocol
 * Requirements: ORIGINAL_REQUEST §R1, PROJECT.md §F4
 */

import { describe, it, expect } from '../harness/test-runner.ts';
import { VDomEngine } from '../harness/dual-thread-harness.ts';
import type { VNode } from '../../../src/types.ts';

describe('Tier 1 - F4: Virtual DOM Diff/Patch Protocol', () => {
  it('T1.F4.01: builds VNode representations with tags, attributes, and children', () => {
    const vnode = VDomEngine.createVNode(
      'view',
      { class: 'container', id: 'main' },
      [VDomEngine.createVNode('text', {}, [], 'Hello Goat')]
    );

    expect(vnode.tag).toBe('view');
    expect(vnode.props?.class).toBe('container');
    expect(vnode.children?.length).toBe(1);
    expect(vnode.children?.[0].text).toBe('Hello Goat');
  });

  it('T1.F4.02: generates CREATE patch when inserting new nodes into hierarchy', () => {
    const oldTree: VNode | null = null;
    const newTree = VDomEngine.createVNode('view', { id: 'root' }, [
      VDomEngine.createVNode('button', {}, [], 'Submit'),
    ]);

    const patches = VDomEngine.diff(oldTree, newTree);
    expect(patches.length).toBe(1);
    expect(patches[0].type).toBe('CREATE');
    expect(patches[0].vnode?.tag).toBe('view');
  });

  it('T1.F4.03: generates REMOVE patch when removing nodes from tree', () => {
    const oldTree = VDomEngine.createVNode('view', {}, [
      VDomEngine.createVNode('text', {}, [], 'Item 1'),
      VDomEngine.createVNode('text', {}, [], 'Item 2'),
    ]);
    const newTree = VDomEngine.createVNode('view', {}, [
      VDomEngine.createVNode('text', {}, [], 'Item 1'),
    ]);

    const patches = VDomEngine.diff(oldTree, newTree);
    const removePatch = patches.find((p) => p.type === 'REMOVE');
    expect(removePatch).toBeDefined();
    expect(removePatch!.path).toEqual([1]);
  });

  it('T1.F4.04: generates UPDATE_PROPS and SET_TEXT patches for mutated elements', () => {
    const oldTree = VDomEngine.createVNode('button', { disabled: false, class: 'btn' }, [], 'Click Me');
    const newTree = VDomEngine.createVNode('button', { disabled: true, class: 'btn' }, [], 'Loading...');

    const patches = VDomEngine.diff(oldTree, newTree);
    const propsPatch = patches.find((p) => p.type === 'UPDATE_PROPS');
    const textPatch = patches.find((p) => p.type === 'SET_TEXT');

    expect(propsPatch).toBeDefined();
    expect(propsPatch!.props?.disabled).toBe(true);
    expect(textPatch).toBeDefined();
    expect(textPatch!.text).toBe('Loading...');
  });

  it('T1.F4.05: generates REORDER patch for keyed lists during reordering', () => {
    const oldTree = VDomEngine.createVNode('view', {}, [
      VDomEngine.createVNode('text', {}, [], 'Apple', 'k1'),
      VDomEngine.createVNode('text', {}, [], 'Banana', 'k2'),
      VDomEngine.createVNode('text', {}, [], 'Cherry', 'k3'),
    ]);
    const newTree = VDomEngine.createVNode('view', {}, [
      VDomEngine.createVNode('text', {}, [], 'Cherry', 'k3'),
      VDomEngine.createVNode('text', {}, [], 'Apple', 'k1'),
      VDomEngine.createVNode('text', {}, [], 'Banana', 'k2'),
    ]);

    const patches = VDomEngine.diff(oldTree, newTree);
    const reorderPatch = patches.find((p) => p.type === 'REORDER');

    expect(reorderPatch).toBeDefined();
    expect(reorderPatch!.order).toEqual([2, 0, 1]);
  });
});
