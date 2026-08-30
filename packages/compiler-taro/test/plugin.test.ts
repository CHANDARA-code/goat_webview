/**
 * @goat/compiler-taro - Taro CLI Platform Plugin Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GoatTaroPlugin, PLATFORM_NAME } from '../src/plugin.js';
import { TaroPluginContext } from '../src/types.js';

describe('GoatTaroPlugin Platform Integration', () => {
  it('registers "goat" platform in Taro CLI context', () => {
    let registeredPlatform: any = null;

    const mockCtx: TaroPluginContext = {
      registerPlatform(platform) {
        registeredPlatform = platform;
      },
    };

    GoatTaroPlugin(mockCtx, {});

    assert.ok(registeredPlatform);
    assert.strictEqual(registeredPlatform.name, 'goat');
    assert.strictEqual(registeredPlatform.useConfigName, 'goat');
    assert.strictEqual(typeof registeredPlatform.fn, 'function');
  });

  it('configures Webpack 5 chain with definePlugin, alias and #ifdef preprocessor', () => {
    const definesMap: Record<string, any> = {};
    const aliasMap = new Map<string, string>();
    let loaderAdded = false;

    const mockChain: any = {
      plugin(name: string) {
        if (name === 'definePlugin') {
          return {
            tap(fn: any) {
              const res = fn([{}]);
              Object.assign(definesMap, res[0]);
            },
          };
        }
        return null;
      },
      resolve: {
        alias: {
          set(k: string, v: string) {
            aliasMap.set(k, v);
          },
        },
      },
      module: {
        rule(ruleName: string) {
          return {
            test: () => ({
              use: (loaderName: string) => ({
                loader: () => ({
                  options: (opts: any) => ({
                    end: () => {
                      loaderAdded = true;
                    },
                  }),
                }),
              }),
            }),
          };
        },
      },
    };

    const mockCtx: TaroPluginContext = {
      registerPlatform() {},
      modifyWebpackChain(fn) {
        fn(mockChain);
      },
    };

    GoatTaroPlugin(mockCtx, {});

    assert.strictEqual(definesMap['process.env.TARO_ENV'], JSON.stringify('goat'));
    assert.strictEqual(aliasMap.get('@tarojs/taro'), '@goat/compiler-taro/runtime');
    assert.strictEqual(loaderAdded, true);
  });

  it('configures Vite config with define constants and resolve alias', () => {
    const viteConfig: any = {
      define: {},
      resolve: { alias: {} },
    };

    const mockCtx: TaroPluginContext = {
      registerPlatform() {},
      modifyViteConfig(fn) {
        fn(viteConfig);
      },
    };

    GoatTaroPlugin(mockCtx, {});

    assert.strictEqual(viteConfig.define['process.env.TARO_ENV'], JSON.stringify('goat'));
    assert.strictEqual(viteConfig.define['ENABLE_GOAT'], JSON.stringify(true));
    assert.strictEqual(viteConfig.resolve.alias['@tarojs/taro'], '@goat/compiler-taro/runtime');
  });

  it('hooks into onBuildStart and onBuildFinish lifecycle', async () => {
    let startCalled = false;
    let finishCalled = false;

    const mockCtx: TaroPluginContext = {
      registerPlatform() {},
      onBuildStart(fn) {
        fn();
        startCalled = true;
      },
      onBuildFinish(fn) {
        fn({});
        finishCalled = true;
      },
    };

    GoatTaroPlugin(mockCtx, {});

    assert.strictEqual(startCalled, true);
    assert.strictEqual(finishCalled, true);
  });
});
