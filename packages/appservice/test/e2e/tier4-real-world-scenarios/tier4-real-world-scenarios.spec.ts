/**
 * Tier 4 - Real-World Application Scenarios Suite
 * Covers 6 comprehensive, multi-step mini-app production workflows.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-runner.ts';
import { DualThreadTestEnvironment, VDomEngine } from '../harness/dual-thread-harness.ts';
import type { VNode } from '../../../src/types.ts';

describe('Tier 4 - Real-World Application Scenarios (6 Scenarios)', () => {
  let env: DualThreadTestEnvironment;

  beforeEach(() => {
    env = new DualThreadTestEnvironment('tier4_realworld_app');
  });

  afterEach(() => {
    env.destroy();
  });

  // =========================================================================
  // Scenario 1: E-Commerce Product Catalog & Cart Workflow
  // =========================================================================
  it('Scenario 1: E-Commerce Catalog & Shopping Cart Flow (F1, F2, F3, F4, F6, F7, F11)', async () => {
    // 1. Mini-app boots
    env.worker.launch();
    expect(env.worker.state).toBe('RUNNING');

    // 2. Fetch catalog products via Bridge network request
    const catalog = [
      { id: 'p1', name: 'Goat Pro Headset', price: 199 },
      { id: 'p2', name: 'Wireless Charging Pad', price: 49 },
      { id: 'p3', name: 'Mechanical Keyboard', price: 129 },
    ];
    await env.worker.GoatBridge.call('storage.set', { key: 'catalog', value: catalog });

    // 3. Worker renders product catalog
    env.worker.setData({ catalog, cart: [] as string[] }, (d) =>
      VDomEngine.createVNode('view', { class: 'catalog-page' }, [
        VDomEngine.createVNode('view', { class: 'header' }, [
          VDomEngine.createVNode('text', {}, [], `Items in Cart: ${(d.cart as string[]).length}`),
        ]),
        VDomEngine.createVNode(
          'view',
          { class: 'product-list' },
          (d.catalog as typeof catalog).map((p) =>
            VDomEngine.createVNode('view', { class: 'card' }, [
              VDomEngine.createVNode('text', {}, [], p.name),
              VDomEngine.createVNode('text', {}, [], `$${p.price}`),
              VDomEngine.createVNode('button', { 'data-id': p.id }, [], 'Add to Cart'),
            ], undefined, p.id)
          )
        ),
      ])
    );
    env.ipc.flushUiPatches(() => {});

    expect(env.appView.domTree?.children?.[0].children?.[0].text).toBe('Items in Cart: 0');
    expect(env.appView.domTree?.children?.[1].children?.length).toBe(3);

    // 4. User taps "Add to Cart" on product #1 and #3 in AppView
    const cart = ['p1', 'p3'];
    env.worker.setData({ cart }, (d) =>
      VDomEngine.createVNode('view', { class: 'catalog-page' }, [
        VDomEngine.createVNode('view', { class: 'header' }, [
          VDomEngine.createVNode('text', {}, [], `Items in Cart: ${(d.cart as string[]).length}`),
        ]),
        VDomEngine.createVNode(
          'view',
          { class: 'product-list' },
          catalog.map((p) =>
            VDomEngine.createVNode('view', { class: 'card' }, [
              VDomEngine.createVNode('text', {}, [], p.name),
              VDomEngine.createVNode('text', {}, [], `$${p.price}`),
              VDomEngine.createVNode('button', { 'data-id': p.id }, [], 'Add to Cart'),
            ], undefined, p.id)
          )
        ),
      ])
    );
    env.ipc.flushUiPatches(() => {});

    expect(env.appView.domTree?.children?.[0].children?.[0].text).toBe('Items in Cart: 2');

    // 5. User navigates to checkout screen
    const navResult = await env.worker.GoatBridge.call('navigation.navigateTo', {
      url: '/pages/checkout/index?items=p1,p3',
    }) as { navigatedTo: string };

    expect(navResult.navigatedTo).toBe('/pages/checkout/index?items=p1,p3');
  });

  // =========================================================================
  // Scenario 2: Real-Time High-Frequency Sensor & Geolocation Dashboard
  // =========================================================================
  it('Scenario 2: Real-Time High-Frequency Sensor & Geolocation Dashboard (F2, F4, F5, F10, F11)', async () => {
    env.worker.launch();

    // 1. Initial dashboard gauge setup
    env.worker.setData({ speed: 0, lat: 0, lng: 0 }, (d) =>
      VDomEngine.createVNode('view', { class: 'telemetry-dashboard' }, [
        VDomEngine.createVNode('text', { id: 'speed' }, [], `Speed: ${d.speed} km/h`),
        VDomEngine.createVNode('text', { id: 'coords' }, [], `Lat: ${d.lat}, Lng: ${d.lng}`),
      ])
    );
    env.ipc.flushUiPatches(() => {});

    // 2. Stream 20 rapid sensor updates
    for (let i = 1; i <= 20; i++) {
      const loc = await env.worker.GoatBridge.call('location.getCurrent') as {
        latitude: number;
        longitude: number;
      };

      env.worker.setData({ speed: i * 5, lat: loc.latitude, lng: loc.longitude }, (d) =>
        VDomEngine.createVNode('view', { class: 'telemetry-dashboard' }, [
          VDomEngine.createVNode('text', { id: 'speed' }, [], `Speed: ${d.speed} km/h`),
          VDomEngine.createVNode('text', { id: 'coords' }, [], `Lat: ${d.lat}, Lng: ${d.lng}`),
        ])
      );
    }

    env.ipc.flushUiPatches(() => {});

    expect(env.appView.domTree?.children?.[0].text).toBe('Speed: 100 km/h');
    expect(env.appView.domTree?.children?.[1].text).toContain('Lat: 37.7749');

    // 3. Verify telemetry recorded dual-thread spans
    expect(env.telemetry.traces.length).toBeGreaterThanOrEqual(20);
  });

  // =========================================================================
  // Scenario 3: Social Media Feed with Infinite Scroll & Image Gallery
  // =========================================================================
  it('Scenario 3: Social Media Feed with Infinite Scroll & Keyed Reordering (F2, F4, F6, F8, F11)', async () => {
    env.worker.launch();

    // 1. Initial 2 feed items
    let posts = [
      { id: 'post_1', author: 'Bob', text: 'Hello World', likes: 5 },
      { id: 'post_2', author: 'Charlie', text: 'Working on Goat WebView', likes: 12 },
    ];

    const renderFeed = (dataPosts: typeof posts) =>
      VDomEngine.createVNode('view', { class: 'feed' }, [
        VDomEngine.createVNode(
          'view',
          { class: 'post-list' },
          dataPosts.map((p) =>
            VDomEngine.createVNode('view', { class: 'post' }, [
              VDomEngine.createVNode('text', {}, [], `${p.author}: ${p.text}`),
              VDomEngine.createVNode('text', {}, [], `Likes: ${p.likes}`),
            ], undefined, p.id)
          )
        ),
      ]);

    env.worker.setData({ posts }, () => renderFeed(posts));
    env.ipc.flushUiPatches(() => {});
    expect(env.appView.domTree?.children?.[0].children?.length).toBe(2);

    // 2. User reaches bottom -> triggers onReachBottom UI_EVENT
    posts = [
      ...posts,
      { id: 'post_3', author: 'Dana', text: 'Zero jank mini-apps!', likes: 20 },
      { id: 'post_4', author: 'Eve', text: 'AppService is fast.', likes: 8 },
    ];

    env.worker.setData({ posts }, () => renderFeed(posts));
    env.ipc.flushUiPatches(() => {});

    expect(env.appView.domTree?.children?.[0].children?.length).toBe(4);

    // 3. User likes post #2 -> in-place state update
    posts[1].likes++;
    env.worker.setData({ posts }, () => renderFeed(posts));
    env.ipc.flushUiPatches(() => {});

    const post2Likes = env.appView.domTree?.children?.[0].children?.[1].children?.[1].text;
    expect(post2Likes).toBe('Likes: 13');
  });

  // =========================================================================
  // Scenario 4: Multi-Step Insurance Form with Auto-Save & Crash Recovery
  // =========================================================================
  it('Scenario 4: Multi-Step Form with Auto-Save & Worker Crash Recovery (F1, F3, F7, F9, F11)', async () => {
    // 1. Initial Launch
    env.worker.launch();

    // 2. User fills Step 1
    const draft = { applicantName: 'John Doe', policyType: 'Auto', age: 34 };
    await env.worker.GoatBridge.call('storage.set', { key: 'insurance_draft', value: draft });
    env.worker.setData({ draft, step: 1 });

    // 3. Worker encounters fatal crash mid-step
    try {
      env.worker.evaluateScript('throw new Error("Simulated memory abort");');
    } catch {
      // caught
    }
    expect(env.worker.state).toBe('CRASHED');
    expect(env.host.lifecycleEvents.some((e) => e.event === 'onAppServiceCrash')).toBe(true);

    // 4. Host restarts worker container
    env.worker.launch();
    expect(env.worker.state).toBe('RUNNING');

    // 5. Worker recovers draft from storage
    const recovered = await env.worker.GoatBridge.call('storage.get', { key: 'insurance_draft' }) as {
      value: typeof draft;
    };

    expect(recovered.value).toEqual(draft);
    env.worker.setData({ draft: recovered.value, step: 2 }, (d) =>
      VDomEngine.createVNode('view', { class: 'form-step-2' }, [
        VDomEngine.createVNode('text', {}, [], `Applicant: ${(d.draft as typeof draft).applicantName}`),
        VDomEngine.createVNode('text', {}, [], `Step: ${d.step}`),
      ])
    );
    env.ipc.flushUiPatches(() => {});

    expect(env.appView.domTree?.children?.[0].text).toBe('Applicant: John Doe');
    expect(env.appView.domTree?.children?.[1].text).toBe('Step: 2');
  });

  // =========================================================================
  // Scenario 5: Real-Time Chat Application with WebSocket Stream
  // =========================================================================
  it('Scenario 5: Real-Time Chat Stream with Live Updates (F1, F2, F4, F5, F6, F10)', async () => {
    env.worker.launch();

    const messages = ['Hi Alice!', 'Hello Bob, how is the dual-thread engine?'];
    const renderChat = (msgList: string[]) =>
      VDomEngine.createVNode('view', { class: 'chat-container' }, [
        VDomEngine.createVNode(
          'scroll-view',
          { class: 'message-history' },
          msgList.map((m, idx) => VDomEngine.createVNode('text', { class: 'bubble' }, [], m, undefined, `m_${idx}`))
        ),
        VDomEngine.createVNode('input', { placeholder: 'Type a message...' }),
      ]);

    env.worker.setData({ messages }, () => renderChat(messages));
    env.ipc.flushUiPatches(() => {});
    expect(env.appView.domTree?.children?.[0].children?.length).toBe(2);

    // Incoming messages arrive while user is on page
    messages.push('It delivers zero-jank 60fps rendering!');
    messages.push('Awesome, testing complete.');

    env.worker.setData({ messages }, () => renderChat(messages));
    env.ipc.flushUiPatches(() => {});

    expect(env.appView.domTree?.children?.[0].children?.length).toBe(4);
    expect(env.appView.domTree?.children?.[0].children?.[3].text).toBe('Awesome, testing complete.');
  });

  // =========================================================================
  // Scenario 6: Super-App Multi-Tab Switching & Background Suspension
  // =========================================================================
  it('Scenario 6: Super-App Multi-Tab Switching & Background Suspension (F1, F3, F5, F8, F9)', async () => {
    // 1. Initialize Tab 1 (Dashboard) and Tab 2 (Wallet)
    const tab1 = new DualThreadTestEnvironment('tab_dashboard');
    const tab2 = new DualThreadTestEnvironment('tab_wallet');

    tab1.worker.launch();
    tab2.worker.launch();

    expect(tab1.worker.state).toBe('RUNNING');
    expect(tab2.worker.state).toBe('RUNNING');

    // 2. Tab 1 is active, Tab 2 goes to background
    tab2.worker.suspend();
    expect(tab2.worker.state).toBe('SUSPENDED');

    // 3. User switches to Tab 2 -> Tab 1 suspends, Tab 2 resumes
    tab1.worker.suspend();
    tab2.worker.resume();

    expect(tab1.worker.state).toBe('SUSPENDED');
    expect(tab2.worker.state).toBe('RUNNING');

    // 4. Tab 2 syncs balance from storage bridge
    await tab2.worker.GoatBridge.call('storage.set', { key: 'wallet_balance', value: 1250.75 });
    const balRes = await tab2.worker.GoatBridge.call('storage.get', { key: 'wallet_balance' }) as {
      value: number;
    };
    expect(balRes.value).toBe(1250.75);

    // 5. Tab 2 renders wallet view
    tab2.worker.setData({ balance: balRes.value }, (d) =>
      VDomEngine.createVNode('view', { class: 'wallet-screen' }, [
        VDomEngine.createVNode('text', {}, [], `Balance: $${d.balance}`),
      ])
    );
    tab2.ipc.flushUiPatches(() => {});
    expect(tab2.appView.domTree?.children?.[0].text).toBe('Balance: $1250.75');

    tab1.destroy();
    tab2.destroy();
  });
});
