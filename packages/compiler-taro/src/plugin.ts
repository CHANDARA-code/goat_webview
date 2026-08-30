/**
 * @goat/compiler-taro - Taro CLI Platform Plugin
 * Registers the 'goat' platform in Taro CLI (@tarojs/service), configuring
 * Webpack 5 chains, Vite configs, conditional compilation macros, and bundle lifecycle hooks.
 */

import { TaroPluginContext, GoatTaroPluginOptions } from './types.js';
import { transformTaroConfig } from './config/index.js';
import { generateIntegrityManifest } from './bundler/integrity.js';

export const PLATFORM_NAME = 'goat';

/**
 * Main Taro Platform Plugin entrypoint for Goat WebView
 */
export default function GoatTaroPlugin(ctx: TaroPluginContext, pluginOptions: GoatTaroPluginOptions = {}): void {
  // 1. Register 'goat' platform in Taro CLI
  ctx.registerPlatform({
    name: PLATFORM_NAME,
    useConfigName: 'goat',
    async fn({ env }: { env: string }) {
      console.log(`[GoatTaroPlugin] Compiling Taro application for Goat WebView platform (env: ${env})...`);
    },
  });

  // 2. Webpack 5 Chain Configuration Hook
  if (typeof ctx.modifyWebpackChain === 'function') {
    ctx.modifyWebpackChain((chain) => {
      // Define conditional compilation flags
      if (chain.plugin('definePlugin')) {
        chain.plugin('definePlugin').tap((args: any[]) => {
          const defines = args[0] || {};
          defines['process.env.TARO_ENV'] = JSON.stringify('goat');
          defines['ENABLE_GOAT'] = JSON.stringify(true);
          args[0] = defines;
          return args;
        });
      }

      // Alias @tarojs/taro -> @goat/compiler-taro/runtime
      chain.resolve.alias.set('@tarojs/taro', '@goat/compiler-taro/runtime');

      // Add #ifdef GOAT preprocessor macro support for Vue/React loaders
      chain.module
        .rule('taro-goat-preprocessor')
        .test(/\.(js|jsx|ts|tsx|vue)$/)
        .use('ifdef-loader')
        .loader('ifdef-loader')
        .options({
          GOAT: true,
          TARO_ENV: 'goat',
          'ifdef-verbose': false,
        })
        .end();
    });
  }

  // 3. Vite Configuration Hook
  if (typeof ctx.modifyViteConfig === 'function') {
    ctx.modifyViteConfig((viteConfig) => {
      // Define constants
      viteConfig.define = {
        ...viteConfig.define,
        'process.env.TARO_ENV': JSON.stringify('goat'),
        ENABLE_GOAT: JSON.stringify(true),
      };

      // Resolve alias
      viteConfig.resolve = viteConfig.resolve || {};
      viteConfig.resolve.alias = {
        ...viteConfig.resolve.alias,
        '@tarojs/taro': '@goat/compiler-taro/runtime',
      };
    });
  }

  // 4. Build Lifecycle Hooks
  if (typeof ctx.onBuildStart === 'function') {
    ctx.onBuildStart(async () => {
      console.log('[GoatTaroPlugin] Build started. Validating Goat configuration...');
    });
  }

  if (typeof ctx.onBuildFinish === 'function') {
    ctx.onBuildFinish(async (params) => {
      if (params?.error) {
        console.error('[GoatTaroPlugin] Build failed:', params.error);
        return;
      }
      console.log('[GoatTaroPlugin] Build finished successfully. Emitted Goat distribution artifacts.');
    });
  }
}

export { GoatTaroPlugin };
