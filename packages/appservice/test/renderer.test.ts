import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { AppViewDomRenderer, isSafeDOMProperty } from '../src/renderer/dom-renderer.js';
import { AppViewEventInterceptor } from '../src/renderer/event-interceptor.js';
import { IpcChannel } from '../src/ipc/channel.js';
import { InMemoryMessagePortPair } from '../src/simulation/in-memory-worker.js';
import { DomNodeStub } from './harness/dom-stub.js';
import { h } from '../src/vdom/h.js';
import { UiPatchPayload, UiEventPayload } from '../src/types.js';

describe('AppView DOM Renderer & Event Interception', () => {
  let pair: InMemoryMessagePortPair;
  let renderIpc: IpcChannel;
  let workerIpc: IpcChannel;
  let container: DomNodeStub;
  let renderer: AppViewDomRenderer;
  let interceptor: AppViewEventInterceptor;

  beforeEach(() => {
    pair = new InMemoryMessagePortPair();
    workerIpc = new IpcChannel('appservice', pair.port1);
    renderIpc = new IpcChannel('appview', pair.port2);
    container = new DomNodeStub('DIV');
    renderer = new AppViewDomRenderer(container, renderIpc);
    interceptor = new AppViewEventInterceptor(container, renderIpc);
  });

  afterEach(() => {
    interceptor.dispose();
    workerIpc.dispose();
    renderIpc.dispose();
  });

  it('renders initial VNode tree into synthetic DOM nodes', () => {
    const root = h('div', { id: 'main_view', class: 'root-box' }, [
      h('p', { class: 'text' }, 'Welcome to Goat WebView'),
      h('button', { id: 'btn_1' }, 'Click'),
    ]);

    const batch: UiPatchPayload = {
      batchId: 'batch_1',
      rootId: 'root',
      timestamp: Date.now(),
      patches: [{ type: 'CREATE', path: [], vnode: root }],
    };

    renderer.applyPatchBatch(batch);

    assert.strictEqual(container.childNodes.length, 1);
    const rootDom = container.childNodes[0];
    assert.strictEqual(rootDom.id, 'main_view');
    assert.strictEqual(rootDom.className, 'root-box');
    assert.strictEqual(rootDom.childNodes.length, 2);
  });

  it('applies SET_TEXT and UPDATE_PROPS patch mutations', () => {
    const root = h('button', { id: 'btn', class: 'btn' }, 'Old Text');
    renderer.applyPatchBatch({
      batchId: 'b1',
      rootId: 'root',
      timestamp: Date.now(),
      patches: [{ type: 'CREATE', path: [], vnode: root }],
    });

    const btnDom = container.childNodes[0];
    assert.strictEqual(btnDom.id, 'btn');

    renderer.applyPatchBatch({
      batchId: 'b2',
      rootId: 'root',
      timestamp: Date.now(),
      patches: [
        { type: 'UPDATE_PROPS', path: [0], targetNodeId: 'btn', set: { class: 'btn active' }, remove: [] },
        { type: 'SET_TEXT', path: [0, 0], text: 'New Text' },
      ],
    });

    assert.strictEqual(btnDom.className, 'btn active');
  });

  it('captures user interactions and forwards UI_EVENT frames to Worker', async () => {
    let capturedEvent: UiEventPayload | null = null;
    workerIpc.on('UI_EVENT', (frame) => {
      capturedEvent = frame.payload as UiEventPayload;
    });

    interceptor.simulateUserEvent('tap', [0, 1], { touchX: 150, touchY: 280 });

    // Wait for microtask delivery
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(capturedEvent);
    const event = capturedEvent as UiEventPayload;
    assert.strictEqual(event.eventType, 'tap');
    assert.deepStrictEqual(event.targetPath, [0, 1]);
    assert.strictEqual(event.data?.touchX, 150);
  });
});

describe('AppView DOM Renderer — XSS Property Injection Guards (BLK-P0-11)', () => {
  let container: DomNodeStub;
  let renderer: AppViewDomRenderer;

  beforeEach(() => {
    (globalThis as any).document = {
      createElement: (tag: string) => new DomNodeStub(tag),
      createTextNode: (text: string) => {
        const node = new DomNodeStub('#text', 3);
        node.nodeValue = text;
        node.textContent = text;
        return node;
      },
    };
    container = new DomNodeStub('DIV');
    renderer = new AppViewDomRenderer(container);
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('classifies dangerous property keys as unsafe', () => {
    for (const key of ['innerHTML', 'outerHTML', 'srcdoc', 'onclick', 'onLoad', 'ONERROR', '__proto__', 'prototype', 'constructor']) {
      assert.strictEqual(isSafeDOMProperty(key), false, `${key} must be blocked`);
    }
    for (const key of ['id', 'class', 'className', 'title', 'data-test', 'disabled', 'value', 'key']) {
      assert.strictEqual(isSafeDOMProperty(key), true, `${key} must be allowed`);
    }
  });

  it('neutralizes innerHTML/outerHTML/srcdoc/onclick injection via CREATE props', () => {
    const malicious = h('div', {
      id: 'evil',
      class: 'box',
      innerHTML: '<img src=x onerror=alert(1)>',
      outerHTML: '<script>alert(1)</script>',
      srcdoc: '<script>alert(2)</script>',
      onclick: 'alert(3)',
      title: 'safe title',
    }, []);

    renderer.applyPatchBatch({
      batchId: 'xss_1',
      rootId: 'root',
      timestamp: Date.now(),
      patches: [{ type: 'CREATE', path: [], vnode: malicious }],
    });

    const dom = container.childNodes[0];
    assert.strictEqual(dom.id, 'evil');
    assert.strictEqual(dom.className, 'box');
    assert.strictEqual((dom as any).innerHTML, undefined);
    assert.strictEqual((dom as any).outerHTML, undefined);
    assert.strictEqual((dom as any).onclick, undefined);
    assert.strictEqual(dom.getAttribute('srcdoc'), null);
    assert.strictEqual(dom.getAttribute('title'), 'safe title');
  });

  it('prevents prototype and constructor pollution through props', () => {
    const malicious = h('div', {
      '__proto__': { polluted: true },
      constructor: { polluted: true },
      prototype: { polluted: true },
    }, []);

    renderer.applyPatchBatch({
      batchId: 'xss_2',
      rootId: 'root',
      timestamp: Date.now(),
      patches: [{ type: 'CREATE', path: [], vnode: malicious }],
    });

    const dom = container.childNodes[0];
    assert.ok(dom instanceof DomNodeStub);
    assert.strictEqual(Object.getPrototypeOf(dom), DomNodeStub.prototype);
    assert.strictEqual(dom.constructor, DomNodeStub);
    assert.strictEqual((DomNodeStub.prototype as any).polluted, undefined);
    assert.strictEqual(({} as any).polluted, undefined);
  });

  it('neutralizes dangerous properties via UPDATE_PROPS while applying safe ones', () => {
    const root = h('button', { id: 'btn', class: 'btn' }, 'Press');
    renderer.applyPatchBatch({
      batchId: 'xss_3',
      rootId: 'root',
      timestamp: Date.now(),
      patches: [{ type: 'CREATE', path: [], vnode: root }],
    });

    const btnDom = container.childNodes[0];
    renderer.applyPatchBatch({
      batchId: 'xss_4',
      rootId: 'root',
      timestamp: Date.now(),
      patches: [{
        type: 'UPDATE_PROPS',
        path: [0],
        targetNodeId: 'btn',
        set: {
          innerHTML: '<script>alert(1)</script>',
          outerHTML: '<script>alert(2)</script>',
          onclick: 'alert(3)',
          srcdoc: '<script>alert(4)</script>',
          title: 'updated title',
        },
        remove: [],
      }],
    });

    assert.strictEqual((btnDom as any).innerHTML, undefined);
    assert.strictEqual((btnDom as any).outerHTML, undefined);
    assert.strictEqual((btnDom as any).onclick, undefined);
    assert.strictEqual(btnDom.getAttribute('srcdoc'), null);
    assert.strictEqual(btnDom.getAttribute('title'), 'updated title');
  });

  it('keeps dangerous props out of the internal VNode tree', () => {
    const root = h('div', { id: 'vnode_root' }, []);
    renderer.applyPatchBatch({
      batchId: 'xss_5',
      rootId: 'root',
      timestamp: Date.now(),
      patches: [{ type: 'CREATE', path: [], vnode: root }],
    });

    renderer.applyPatchBatch({
      batchId: 'xss_6',
      rootId: 'root',
      timestamp: Date.now(),
      patches: [{
        type: 'UPDATE_PROPS',
        path: [0],
        targetNodeId: 'vnode_root',
        set: {
          innerHTML: '<script>alert(1)</script>',
          onclick: 'alert(2)',
          'data-safe': 'yes',
        },
        remove: [],
      }],
    });

    const vnode = renderer.findVNodeById(renderer.domTree, 'vnode_root');
    assert.ok(vnode);
    assert.strictEqual(vnode.props?.innerHTML, undefined);
    assert.strictEqual(vnode.props?.onclick, undefined);
    assert.strictEqual(vnode.props?.['data-safe'], 'yes');
  });
});
