import { describe, it } from 'node:test';
import assert from 'node:assert';
import { h, diff, VDomEngine } from '../src/vdom/index.js';
import { VNode } from '../src/types.js';

describe('Virtual DOM Diffing & Patch Engine', () => {
  it('h() factory produces structured VNodes with children and props', () => {
    const vnode = h('div', { id: 'app', class: 'container' }, [
      h('span', { class: 'title' }, 'Goat WebView'),
      h('button', { disabled: true }, 'Submit'),
    ]);

    assert.strictEqual(vnode.tag, 'div');
    assert.strictEqual(vnode.props?.id, 'app');
    assert.strictEqual(vnode.props?.class, 'container');
    assert.strictEqual(vnode.children?.length, 2);
    assert.strictEqual(vnode.children[0].tag, 'span');
    assert.strictEqual(vnode.children[0].children?.[0].text, 'Goat WebView');
  });

  it('generates CREATE patch when new tree is constructed', () => {
    const newTree = h('view', { id: 'root' }, h('text', null, 'Hello'));
    const patches = diff(null, newTree);

    assert.strictEqual(patches.length, 1);
    assert.strictEqual(patches[0].type, 'CREATE');
    assert.strictEqual(patches[0].vnode?.tag, 'view');
  });

  it('generates REMOVE patch when tree or subnodes are deleted', () => {
    const oldTree = h('view', {}, [
      h('text', { id: 't1' }, 'Item 1'),
      h('text', { id: 't2' }, 'Item 2'),
    ]);
    const newTree = h('view', {}, [
      h('text', { id: 't1' }, 'Item 1'),
    ]);

    const patches = diff(oldTree, newTree);
    const removePatch = patches.find((p) => p.type === 'REMOVE');
    assert.ok(removePatch);
  });

  it('generates REPLACE patch when tag names change', () => {
    const oldTree = h('div', { id: 'box' });
    const newTree = h('span', { id: 'box' });

    const patches = diff(oldTree, newTree);
    assert.strictEqual(patches.length, 1);
    assert.strictEqual(patches[0].type, 'REPLACE');
  });

  it('generates UPDATE_PROPS and SET_TEXT patches for element mutations', () => {
    const oldTree = h('button', { class: 'btn primary', disabled: false }, 'Click Me');
    const newTree = h('button', { class: 'btn danger', disabled: true }, 'Loading...');

    const patches = diff(oldTree, newTree);
    const propsPatch = patches.find((p) => p.type === 'UPDATE_PROPS');
    const textPatch = patches.find((p) => p.type === 'SET_TEXT');

    assert.ok(propsPatch);
    assert.strictEqual(propsPatch.set?.class, 'btn danger');
    assert.strictEqual(propsPatch.set?.disabled, true);

    assert.ok(textPatch);
    assert.strictEqual(textPatch.text, 'Loading...');
  });

  it('generates REORDER patch for keyed list reordering', () => {
    const oldTree = h('ul', {}, [
      h('li', { key: 'a' }, 'A'),
      h('li', { key: 'b' }, 'B'),
      h('li', { key: 'c' }, 'C'),
    ]);

    const newTree = h('ul', {}, [
      h('li', { key: 'c' }, 'C'),
      h('li', { key: 'a' }, 'A'),
      h('li', { key: 'b' }, 'B'),
    ]);

    const patches = diff(oldTree, newTree);
    const reorderPatch = patches.find((p) => p.type === 'REORDER' || p.type === 'REORDER_CHILDREN');

    assert.ok(reorderPatch);
  });
});
