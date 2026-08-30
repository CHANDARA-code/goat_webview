/**
 * @goat/compiler-uniapp Responsive Pixel (rpx) Runtime & Transform Engine
 */

export function rpx2px(
  rpx: number,
  windowWidth: number = 375,
  maxDeviceWidth: number = 960
): number {
  const effectiveWidth = Math.min(windowWidth, maxDeviceWidth);
  return (rpx * effectiveWidth) / 750;
}

export function px2rpx(
  px: number,
  windowWidth: number = 375,
  maxDeviceWidth: number = 960
): number {
  const effectiveWidth = Math.min(windowWidth, maxDeviceWidth);
  return (px * 750) / effectiveWidth;
}

const RPX_REGEX = /([0-9.]+)\s*rpx\b/g;

export function transformRpxInCss(
  css: string,
  maxDeviceWidth: number = 960
): string {
  return css.replace(RPX_REGEX, (_, val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return `${val}rpx`;
    // Generate standard responsive CSS calculation with max-width clamp
    return `min(calc(${num} * 100vw / 750), calc(${num} * ${maxDeviceWidth}px / 750))`;
  });
}
