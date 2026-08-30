import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { preprocessCode } from '../dist/preprocessor/index.js';

describe('Conditional Preprocessor Engine', () => {
  it('processes JS/TS single-line #ifdef GOAT directives', () => {
    const input = `
const title = "App";
// #ifdef GOAT
const platform = "goat-engine";
// #endif
// #ifdef H5
const platform = "browser";
// #endif
console.log(platform);
`;

    const result = preprocessCode(input, { targetPlatform: 'GOAT' });
    assert.ok(result.code.includes('const platform = "goat-engine";'));
    assert.ok(!result.code.includes('const platform = "browser";'));
    // Line count must be exactly preserved
    assert.equal(result.code.split('\n').length, input.split('\n').length);
  });

  it('processes JS/TS block-comment /* #ifdef */ directives', () => {
    const input = `
/* #ifdef GOAT */
import { uni } from '@goat/compiler-uniapp/runtime';
/* #endif */
/* #ifdef APP-PLUS */
import plus from 'plus';
/* #endif */
`;

    const result = preprocessCode(input, { targetPlatform: 'GOAT' });
    assert.ok(result.code.includes("import { uni } from '@goat/compiler-uniapp/runtime';"));
    assert.ok(!result.code.includes("import plus from 'plus';"));
    assert.equal(result.code.split('\n').length, input.split('\n').length);
  });

  it('evaluates logical OR platform expressions', () => {
    const input = `
// #ifdef MP-WEIXIN || MP-ALIPAY || GOAT
const isMiniApp = true;
// #endif
// #ifdef H5 || QUICKAPP
const isMiniApp = false;
// #endif
`;

    const result = preprocessCode(input, { targetPlatform: 'GOAT' });
    assert.ok(result.code.includes('const isMiniApp = true;'));
    assert.ok(!result.code.includes('const isMiniApp = false;'));
  });

  it('evaluates negative #ifndef directives', () => {
    const input = `
// #ifndef H5
const isEmbedded = true;
// #endif
// #ifndef GOAT
const isNativeBrowser = true;
// #endif
`;

    const result = preprocessCode(input, { targetPlatform: 'GOAT' });
    assert.ok(result.code.includes('const isEmbedded = true;'));
    assert.ok(!result.code.includes('const isNativeBrowser = true;'));
  });

  it('handles nested #ifdef / #ifndef blocks correctly with ConditionStack', () => {
    const input = `
// #ifdef MP
const level1 = 1;
// #ifndef H5
const level2 = 2;
// #ifdef GOAT
const level3 = 3;
// #endif
// #ifdef APP-PLUS
const level3Excluded = 3;
// #endif
// #endif
// #endif
`;

    const result = preprocessCode(input, { targetPlatform: 'GOAT' });
    assert.ok(result.code.includes('const level1 = 1;'));
    assert.ok(result.code.includes('const level2 = 2;'));
    assert.ok(result.code.includes('const level3 = 3;'));
    assert.ok(!result.code.includes('const level3Excluded = 3;'));
  });

  it('processes Vue SFC template HTML comments', () => {
    const input = `
<template>
  <view class="container">
    <!-- #ifdef GOAT -->
    <goat-same-layer-view id="video1" />
    <!-- #endif -->
    <!-- #ifdef H5 -->
    <video src="sample.mp4" />
    <!-- #endif -->
  </view>
</template>
`;

    const result = preprocessCode(input, { targetPlatform: 'GOAT' });
    assert.ok(result.code.includes('<goat-same-layer-view id="video1" />'));
    assert.ok(!result.code.includes('<video src="sample.mp4" />'));
    assert.equal(result.code.split('\n').length, input.split('\n').length);
  });

  it('processes CSS / SCSS style comment directives', () => {
    const input = `
.header {
  height: 44px;
  /* #ifdef GOAT */
  padding-top: constant(safe-area-inset-top);
  /* #endif */
  /* #ifdef H5 */
  padding-top: 0px;
  /* #endif */
}
`;

    const result = preprocessCode(input, { targetPlatform: 'GOAT' });
    assert.ok(result.code.includes('padding-top: constant(safe-area-inset-top);'));
    assert.ok(!result.code.includes('padding-top: 0px;'));
    assert.equal(result.code.split('\n').length, input.split('\n').length);
  });

  it('supports strict mode vs compat mode for MP-WEIXIN', () => {
    const input = `
// #ifdef MP-WEIXIN
const isWeChat = true;
// #endif
`;

    // In compat mode (default)
    const compatResult = preprocessCode(input, { targetPlatform: 'GOAT', compatMode: true });
    assert.ok(compatResult.code.includes('const isWeChat = true;'));

    // In strict mode
    const strictResult = preprocessCode(input, { targetPlatform: 'GOAT', compatMode: false });
    assert.ok(!strictResult.code.includes('const isWeChat = true;'));
  });
});
