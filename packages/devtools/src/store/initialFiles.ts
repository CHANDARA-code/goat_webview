export const VANILLA_TEMPLATE_FILES: Record<string, string> = {
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
            iconPath: 'assets/home.png',
            selectedIconPath: 'assets/home-active.png',
          },
          {
            pagePath: 'pages/logs/logs',
            text: 'Logs',
            iconPath: 'assets/logs.png',
            selectedIconPath: 'assets/logs-active.png',
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
  'pages/logs/logs.js': `Page({ data: { logs: [] } });`,
  'pages/logs/logs.html': `<div class="container"><h3>Logs</h3></div>`,
  'pages/logs/logs.css': ``,
};

export const REACT_TEMPLATE_FILES: Record<string, string> = {
  ...VANILLA_TEMPLATE_FILES,
  'manifest.json': JSON.stringify(
    {
      appId: 'com.goat.react',
      appName: 'Goat React MiniApp',
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'src/pages/index.tsx',
      permissions: ['LOCATION', 'STORAGE', 'BIOMETRIC'],
    },
    null,
    2
  ),
  'src/App.tsx': `import React from 'react';

export default function App() {
  return <div>Goat React Mini-App</div>;
}
`,
  'src/pages/index.tsx': `import React, { useState } from 'react';

export default function IndexPage() {
  const [count, setCount] = useState(0);
  return (
    <div className="container">
      <h2>React Mini-App</h2>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </div>
  );
}
`,
};

export const VUE_TEMPLATE_FILES: Record<string, string> = {
  ...VANILLA_TEMPLATE_FILES,
  'manifest.json': JSON.stringify(
    {
      appId: 'com.goat.vue',
      appName: 'Goat Vue MiniApp',
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'src/pages/index.vue',
      permissions: ['LOCATION', 'STORAGE', 'BIOMETRIC'],
    },
    null,
    2
  ),
  'src/App.vue': `<template>
  <div class="container">
    <h2>Goat Vue Mini-App</h2>
  </div>
</template>
<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>
`,
  'src/pages/index.vue': `<template>
  <div class="container">
    <h2>Vue 3 Page</h2>
  </div>
</template>
`,
};
