/**
 * @goat/devtools - Vanilla JS Mini-App Project Template
 */

import type { ProjectTemplate } from '../types/ide.ts';

export const VANILLA_TEMPLATE: ProjectTemplate = {
  id: 'vanilla',
  name: 'Vanilla Dual-Thread Mini-App',
  description: 'Zero-dependency pure ES mini-app template with dual-thread AppService / AppView and direct GoatBridge calls.',
  framework: 'vanilla',
  version: '1.0.0',
  icon: 'Code2',
  entryFile: 'src/app.js',
  files: {
    'manifest.json': JSON.stringify(
      {
        appId: 'com.goat.demo',
        appName: 'Goat Demo MiniApp',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'src/pages/index.html',
        pages: ['pages/index/index', 'pages/logs/logs'],
        permissions: ['LOCATION', 'STORAGE', 'BIOMETRIC', 'CAMERA'],
        window: {
          title: 'Goat Mini-App Demo',
          navigationBarTitleText: 'Goat Mini-App Demo',
          navigationBarBackgroundColor: '#007acc',
          navigationBarTextStyle: 'white',
          backgroundColor: '#f4f6f8',
          enablePullDownRefresh: true,
          orientation: 'portrait',
        },
        tabBar: {
          color: '#8e8e93',
          selectedColor: '#007acc',
          backgroundColor: '#ffffff',
          borderStyle: 'black',
          list: [
            {
              pagePath: 'pages/index/index',
              text: 'Home',
            },
            {
              pagePath: 'pages/logs/logs',
              text: 'Logs',
            },
          ],
        },
        subpackages: [
          {
            root: 'packageFeature',
            name: 'feature',
            pages: ['pages/detail/detail'],
            independent: false,
          },
        ],
      },
      null,
      2
    ),

    'goat.config.json': JSON.stringify(
      {
        name: 'goat-demo-app',
        appid: 'com.goat.demo',
        appId: 'com.goat.demo',
        projectname: 'Goat Mini-App Studio Template',
        framework: 'vanilla',
        dev: {
          port: 4000,
          mock: true,
        },
        compilerOptions: {
          target: 'ES2022',
          minify: true,
          v8Bytecode: false,
          sourceMap: true,
        },
        setting: {
          urlCheck: false,
          es6: true,
          postcss: true,
          minified: false,
        },
        outputDir: 'dist',
      },
      null,
      2
    ),

    'src/app.js': `// AppService Worker Entry Point
App({
  onLaunch(options) {
    console.log('[AppService] Mini-App onLaunch options:', options);
    this.globalData = { version: '1.0.0' };
  },
});
`,

    'src/pages/index.html': `<div class="container">
  <h2>Welcome to Goat Mini-App</h2>
  <p>Standard dual-thread architecture</p>
</div>
`,

    'app.js': `// AppService Worker Entry Point
App({
  onLaunch(options) {
    console.log('[AppService] Mini-App onLaunch options:', options);
    GoatBridge.call('GET_DEVICE_INFO', {}).then((info) => {
      console.log('[AppService] Device Info:', info);
    });
  },
});
`,

    'app.css': `page {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: #f4f6f8;
  color: #1a1a1a;
  box-sizing: border-box;
}

.container {
  padding: 16px;
}
`,

    'pages/index/index.js': `// Index Page Logic
Page({
  data: {
    title: 'Welcome to Goat Mini-App',
    count: 0,
  },
  handleIncrement() {
    this.setData({ count: this.data.count + 1 });
    GoatBridge.call('HAPTIC_FEEDBACK', { type: 'medium' });
  },
});
`,

    'pages/index/index.html': `<div class="container">
  <h2>{{title}}</h2>
  <button bindtap="handleIncrement">Count: {{count}}</button>
</div>
`,

    'pages/index/index.css': `h2 { font-size: 20px; font-weight: 700; color: #007acc; }`,
  },
};
