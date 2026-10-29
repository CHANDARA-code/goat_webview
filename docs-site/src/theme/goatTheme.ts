import { theme as antdTheme, type ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark';

const fontFamily =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const fontFamilyCode =
  "'JetBrains Mono', 'SF Mono', SFMono-Regular, ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace";

export interface Palette {
  bgBase: string;
  bgLayout: string;
  bgContainer: string;
  bgElevated: string;
  bgInput: string;
  bgInputHover: string;
  bgInputActive: string;
  bgSpotlight: string;
  bgMask: string;
  bgDisabled: string;

  border: string;
  borderSecondary: string;
  borderStrong: string;
  split: string;

  text: string;
  textHeading: string;
  textLabel: string;
  textSecondary: string;
  textTertiary: string;
  textQuaternary: string;
  textPlaceholder: string;
  textDisabled: string;
  textOnPrimary: string;
  textLightSolid: string;

  fill: string;
  fillSecondary: string;
  fillTertiary: string;
  fillQuaternary: string;

  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryBg: string;
  primaryBgHover: string;
  primaryBorder: string;
  primaryBorderHover: string;
  primaryText: string;
  primaryTextHover: string;
  primaryTextActive: string;

  success: string;
  successHover: string;
  successActive: string;
  successBg: string;
  successBgHover: string;
  successBorder: string;
  successBorderHover: string;

  warning: string;
  warningHover: string;
  warningActive: string;
  warningBg: string;
  warningBgHover: string;
  warningBorder: string;
  warningBorderHover: string;

  error: string;
  errorHover: string;
  errorActive: string;
  errorBg: string;
  errorBgHover: string;
  errorBorder: string;
  errorBorderHover: string;

  info: string;
  infoHover: string;
  infoActive: string;
  infoBg: string;
  infoBgHover: string;
  infoBorder: string;
  infoBorderHover: string;

  controlOutline: string;
  errorOutline: string;
  warningOutline: string;

  shadow: string;
  shadowSecondary: string;
  shadowTertiary: string;
  shadowCard: string;
}

export const lightPalette: Palette = {
  bgBase: '#FAF9F5',
  bgLayout: '#FAF9F5',
  bgContainer: '#F4F3EE',
  bgElevated: '#ECEAE1',
  bgInput: '#FAF9F5',
  bgInputHover: '#FFFFFF',
  bgInputActive: '#FFFFFF',
  bgSpotlight: '#2B2925',
  bgMask: 'rgba(31, 30, 28, 0.45)',
  bgDisabled: 'rgba(31, 30, 28, 0.04)',

  border: '#E3E1D9',
  borderSecondary: '#E3E1D9',
  borderStrong: '#D2CFC4',
  split: 'rgba(31, 30, 28, 0.08)',

  text: '#1F1E1C',
  textHeading: '#1F1E1C',
  textLabel: '#3D3B37',
  textSecondary: '#6B6862',
  textTertiary: '#B1ADA1',
  textQuaternary: '#D2CFC4',
  textPlaceholder: '#A19D92',
  textDisabled: '#B1ADA1',
  textOnPrimary: '#FFFFFF',
  textLightSolid: '#FFFFFF',

  fill: 'rgba(31, 30, 28, 0.12)',
  fillSecondary: 'rgba(31, 30, 28, 0.08)',
  fillTertiary: 'rgba(31, 30, 28, 0.05)',
  fillQuaternary: 'rgba(31, 30, 28, 0.03)',

  primary: '#C15F3C',
  primaryHover: '#A94F30',
  primaryActive: '#8E3F24',
  primaryBg: '#F8E9E2',
  primaryBgHover: '#F2D7CA',
  primaryBorder: '#E7B7A1',
  primaryBorderHover: '#D98F70',
  primaryText: '#C15F3C',
  primaryTextHover: '#A94F30',
  primaryTextActive: '#8E3F24',

  success: '#4A7862',
  successHover: '#3C6551',
  successActive: '#2F5141',
  successBg: '#E6EFEA',
  successBgHover: '#D3E3DA',
  successBorder: '#A9C6B7',
  successBorderHover: '#7FA791',

  warning: '#B08838',
  warningHover: '#957230',
  warningActive: '#7A5D26',
  warningBg: '#F6EEDA',
  warningBgHover: '#EFE2BF',
  warningBorder: '#E2CE9D',
  warningBorderHover: '#CDB36E',

  error: '#B3492F',
  errorHover: '#963B24',
  errorActive: '#7B2F1C',
  errorBg: '#F7E4DE',
  errorBgHover: '#F0CFC5',
  errorBorder: '#E3B3A5',
  errorBorderHover: '#D08C78',

  info: '#4F6D8F',
  infoHover: '#3F5A78',
  infoActive: '#324A63',
  infoBg: '#E5EBF2',
  infoBgHover: '#D3DDE8',
  infoBorder: '#B3C4D7',
  infoBorderHover: '#8CA4BF',

  controlOutline: 'rgba(193, 95, 60, 0.18)',
  errorOutline: 'rgba(179, 73, 47, 0.18)',
  warningOutline: 'rgba(176, 136, 56, 0.18)',

  shadow:
    '0 6px 16px 0 rgba(31, 30, 28, 0.08), 0 3px 6px -4px rgba(31, 30, 28, 0.12), 0 9px 28px 8px rgba(31, 30, 28, 0.05)',
  shadowSecondary:
    '0 6px 16px 0 rgba(31, 30, 28, 0.08), 0 3px 6px -4px rgba(31, 30, 28, 0.12), 0 9px 28px 8px rgba(31, 30, 28, 0.05)',
  shadowTertiary:
    '0 1px 2px 0 rgba(31, 30, 28, 0.04), 0 1px 6px -1px rgba(31, 30, 28, 0.03), 0 2px 4px 0 rgba(31, 30, 28, 0.03)',
  shadowCard: '0 1px 2px 0 rgba(31, 30, 28, 0.05)',
};

export const darkPalette: Palette = {
  bgBase: '#1A1917',
  bgLayout: '#1A1917',
  bgContainer: '#26241F',
  bgElevated: '#322F29',
  bgInput: '#1A1917',
  bgInputHover: '#201E1B',
  bgInputActive: '#201E1B',
  bgSpotlight: '#4A463D',
  bgMask: 'rgba(0, 0, 0, 0.65)',
  bgDisabled: 'rgba(244, 243, 238, 0.06)',

  border: '#3D3A33',
  borderSecondary: '#3D3A33',
  borderStrong: '#4F4B42',
  split: 'rgba(244, 243, 238, 0.10)',

  text: '#F4F3EE',
  textHeading: '#F4F3EE',
  textLabel: '#D9D6CB',
  textSecondary: '#B1ADA1',
  textTertiary: '#7A766D',
  textQuaternary: '#5A574F',
  textPlaceholder: '#7A766D',
  textDisabled: '#5A574F',
  textOnPrimary: '#1A1917',
  textLightSolid: '#F4F3EE',

  fill: 'rgba(244, 243, 238, 0.18)',
  fillSecondary: 'rgba(244, 243, 238, 0.12)',
  fillTertiary: 'rgba(244, 243, 238, 0.08)',
  fillQuaternary: 'rgba(244, 243, 238, 0.04)',

  primary: '#D97B57',
  primaryHover: '#E68F6D',
  primaryActive: '#C15F3C',
  primaryBg: '#3B2A22',
  primaryBgHover: '#4A332A',
  primaryBorder: '#6B4332',
  primaryBorderHover: '#8F5A41',
  primaryText: '#D97B57',
  primaryTextHover: '#E68F6D',
  primaryTextActive: '#C15F3C',

  success: '#6FA085',
  successHover: '#88B49B',
  successActive: '#4A7862',
  successBg: '#22302A',
  successBgHover: '#2B3E35',
  successBorder: '#3F5C4D',
  successBorderHover: '#55785F',

  warning: '#D0A85C',
  warningHover: '#DDB874',
  warningActive: '#B08838',
  warningBg: '#342C1A',
  warningBgHover: '#443A22',
  warningBorder: '#5E4E2A',
  warningBorderHover: '#7D6838',

  error: '#D9705A',
  errorHover: '#E68A76',
  errorActive: '#B3492F',
  errorBg: '#3A2420',
  errorBgHover: '#4A2D28',
  errorBorder: '#6B3A31',
  errorBorderHover: '#8F4D40',

  info: '#7E9FC4',
  infoHover: '#99B4D3',
  infoActive: '#5F82A9',
  infoBg: '#222B36',
  infoBgHover: '#2B3745',
  infoBorder: '#3C5068',
  infoBorderHover: '#51698A',

  controlOutline: 'rgba(217, 123, 87, 0.25)',
  errorOutline: 'rgba(217, 112, 90, 0.25)',
  warningOutline: 'rgba(208, 168, 92, 0.25)',

  shadow:
    '0 6px 16px 0 rgba(0, 0, 0, 0.35), 0 3px 6px -4px rgba(0, 0, 0, 0.45), 0 9px 28px 8px rgba(0, 0, 0, 0.25)',
  shadowSecondary:
    '0 6px 16px 0 rgba(0, 0, 0, 0.35), 0 3px 6px -4px rgba(0, 0, 0, 0.45), 0 9px 28px 8px rgba(0, 0, 0, 0.25)',
  shadowTertiary:
    '0 1px 2px 0 rgba(0, 0, 0, 0.25), 0 1px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px 0 rgba(0, 0, 0, 0.2)',
  shadowCard: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
};

export const sharedToken: NonNullable<ThemeConfig['token']> = {
  fontFamily,
  fontFamilyCode,
  fontSize: 14,
  fontSizeSM: 12,
  fontSizeLG: 16,
  fontSizeXL: 20,
  fontSizeHeading1: 38,
  fontSizeHeading2: 30,
  fontSizeHeading3: 24,
  fontSizeHeading4: 20,
  fontSizeHeading5: 16,
  fontWeightStrong: 600,

  lineHeight: 1.5714285714285714,
  lineHeightLG: 1.5,
  lineHeightSM: 1.6666666666666667,
  lineHeightHeading1: 1.2105263157894737,
  lineHeightHeading2: 1.2666666666666666,
  lineHeightHeading3: 1.3333333333333333,
  lineHeightHeading4: 1.4,
  lineHeightHeading5: 1.5,

  borderRadius: 10,
  borderRadiusXS: 4,
  borderRadiusSM: 6,
  borderRadiusLG: 12,
  borderRadiusOuter: 4,

  lineWidth: 1,
  lineWidthBold: 2,
  lineWidthFocus: 3,
  lineType: 'solid',

  controlHeight: 42,
  controlHeightSM: 34,
  controlHeightLG: 50,
  controlInteractiveSize: 16,
  controlOutlineWidth: 2,
  controlPaddingHorizontal: 12,
  controlPaddingHorizontalSM: 8,

  sizeUnit: 4,
  sizeStep: 4,
  sizePopupArrow: 16,
  size: 16,
  sizeXXS: 4,
  sizeXS: 8,
  sizeSM: 12,
  sizeMD: 16,
  sizeMS: 16,
  sizeLG: 24,
  sizeXL: 32,
  sizeXXL: 48,

  padding: 16,
  paddingXXS: 4,
  paddingXS: 8,
  paddingSM: 12,
  paddingMD: 20,
  paddingLG: 24,
  paddingXL: 32,
  paddingContentHorizontal: 16,
  paddingContentVertical: 12,

  margin: 16,
  marginXXS: 4,
  marginXS: 8,
  marginSM: 12,
  marginMD: 20,
  marginLG: 24,
  marginXL: 32,
  marginXXL: 48,

  motion: true,
  motionUnit: 0.1,
  motionBase: 0,
  motionDurationFast: '0.1s',
  motionDurationMid: '0.2s',
  motionDurationSlow: '0.3s',
  motionEaseInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
  motionEaseOut: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  motionEaseInOutCirc: 'cubic-bezier(0.78, 0.14, 0.15, 0.86)',
  motionEaseOutCirc: 'cubic-bezier(0.08, 0.82, 0.17, 1)',
  motionEaseOutBack: 'cubic-bezier(0.12, 0.4, 0.29, 1.46)',
  motionEaseInBack: 'cubic-bezier(0.71, -0.46, 0.88, 0.6)',

  zIndexBase: 0,
  zIndexPopupBase: 1000,

  opacityImage: 1,
  opacityLoading: 0.65,

  screenXS: 480,
  screenSM: 576,
  screenMD: 768,
  screenLG: 992,
  screenXL: 1200,
  screenXXL: 1600,

  linkDecoration: 'none',
  linkHoverDecoration: 'underline',
  linkFocusDecoration: 'underline',

  wireframe: false,
};

export const buildToken = (p: Palette): NonNullable<ThemeConfig['token']> => ({
  ...sharedToken,

  colorBgBase: p.bgBase,
  colorBgLayout: p.bgLayout,
  colorBgContainer: p.bgContainer,
  colorBgElevated: p.bgElevated,
  colorBgContainerDisabled: p.bgDisabled,
  colorBgSpotlight: p.bgSpotlight,
  colorBgMask: p.bgMask,

  colorBorder: p.border,
  colorBorderSecondary: p.borderSecondary,
  colorBorderBg: p.border,
  colorSplit: p.split,

  colorTextBase: p.text,
  colorText: p.text,
  colorTextHeading: p.textHeading,
  colorTextLabel: p.textLabel,
  colorTextSecondary: p.textSecondary,
  colorTextDescription: p.textSecondary,
  colorTextTertiary: p.textTertiary,
  colorTextQuaternary: p.textQuaternary,
  colorTextPlaceholder: p.textPlaceholder,
  colorTextDisabled: p.textDisabled,
  colorTextLightSolid: p.textLightSolid,

  colorFill: p.fill,
  colorFillSecondary: p.fillSecondary,
  colorFillTertiary: p.fillTertiary,
  colorFillQuaternary: p.fillQuaternary,

  colorPrimary: p.primary,
  colorPrimaryHover: p.primaryHover,
  colorPrimaryActive: p.primaryActive,
  colorPrimaryBg: p.primaryBg,
  colorPrimaryBgHover: p.primaryBgHover,
  colorPrimaryBorder: p.primaryBorder,
  colorPrimaryBorderHover: p.primaryBorderHover,
  colorPrimaryText: p.primaryText,
  colorPrimaryTextHover: p.primaryTextHover,
  colorPrimaryTextActive: p.primaryTextActive,

  colorSuccess: p.success,
  colorSuccessHover: p.successHover,
  colorSuccessActive: p.successActive,
  colorSuccessBg: p.successBg,
  colorSuccessBgHover: p.successBgHover,
  colorSuccessBorder: p.successBorder,
  colorSuccessBorderHover: p.successBorderHover,
  colorSuccessText: p.success,
  colorSuccessTextHover: p.successHover,
  colorSuccessTextActive: p.successActive,

  colorWarning: p.warning,
  colorWarningHover: p.warningHover,
  colorWarningActive: p.warningActive,
  colorWarningBg: p.warningBg,
  colorWarningBgHover: p.warningBgHover,
  colorWarningBorder: p.warningBorder,
  colorWarningBorderHover: p.warningBorderHover,
  colorWarningText: p.warning,
  colorWarningTextHover: p.warningHover,
  colorWarningTextActive: p.warningActive,
  colorWarningOutline: p.warningOutline,

  colorError: p.error,
  colorErrorHover: p.errorHover,
  colorErrorActive: p.errorActive,
  colorErrorBg: p.errorBg,
  colorErrorBgHover: p.errorBgHover,
  colorErrorBorder: p.errorBorder,
  colorErrorBorderHover: p.errorBorderHover,
  colorErrorText: p.error,
  colorErrorTextHover: p.errorHover,
  colorErrorTextActive: p.errorActive,
  colorErrorOutline: p.errorOutline,

  colorInfo: p.info,
  colorInfoHover: p.infoHover,
  colorInfoActive: p.infoActive,
  colorInfoBg: p.infoBg,
  colorInfoBgHover: p.infoBgHover,
  colorInfoBorder: p.infoBorder,
  colorInfoBorderHover: p.infoBorderHover,
  colorInfoText: p.info,
  colorInfoTextHover: p.infoHover,
  colorInfoTextActive: p.infoActive,

  colorLink: p.primary,
  colorLinkHover: p.primaryHover,
  colorLinkActive: p.primaryActive,
  colorHighlight: p.error,

  controlOutline: p.controlOutline,
  controlItemBgHover: p.fillQuaternary,
  controlItemBgActive: p.primaryBg,
  controlItemBgActiveHover: p.primaryBgHover,
  controlItemBgActiveDisabled: p.fill,

  boxShadow: p.shadow,
  boxShadowSecondary: p.shadowSecondary,
  boxShadowTertiary: p.shadowTertiary,
});

export const buildComponents = (p: Palette): NonNullable<ThemeConfig['components']> => ({
  Layout: {
    bodyBg: p.bgLayout,
    headerBg: p.bgLayout,
    headerColor: p.text,
    headerHeight: 72,
    headerPadding: '0 16px',
    footerBg: p.bgLayout,
    footerPadding: '24px 16px',
    siderBg: p.bgContainer,
    triggerBg: p.bgElevated,
    triggerColor: p.textSecondary,
    triggerHeight: 48,
    zeroTriggerWidth: 36,
    zeroTriggerHeight: 42,
    lightSiderBg: p.bgContainer,
    lightTriggerBg: p.bgElevated,
    lightTriggerColor: p.textSecondary,
  },

  Menu: {
    itemBg: 'transparent',
    itemColor: p.textSecondary,
    itemHoverBg: p.fillTertiary,
    itemHoverColor: p.text,
    itemActiveBg: p.primaryBg,
    itemSelectedBg: p.primaryBg,
    itemSelectedColor: p.primary,
    itemBorderRadius: 8,
    itemHeight: 42,
    itemMarginInline: 8,
    itemMarginBlock: 4,
    itemPaddingInline: 12,
    iconSize: 16,
    collapsedIconSize: 18,
    collapsedWidth: 64,
    subMenuItemBg: 'transparent',
    groupTitleColor: p.textTertiary,
    groupTitleFontSize: 12,
    activeBarWidth: 0,
    activeBarHeight: 2,
    activeBarBorderWidth: 0,
    horizontalItemSelectedColor: p.primary,
    horizontalItemHoverColor: p.primary,
    horizontalLineHeight: '70px',
    popupBg: p.bgElevated,
    dangerItemColor: p.error,
    dangerItemHoverColor: p.errorHover,
    dangerItemSelectedColor: p.error,
    dangerItemActiveBg: p.errorBg,
    dangerItemSelectedBg: p.errorBg,
    darkItemBg: p.bgContainer,
    darkSubMenuItemBg: p.bgBase,
    darkItemColor: p.textSecondary,
    darkItemHoverColor: p.text,
    darkItemSelectedBg: p.primaryBg,
    darkItemSelectedColor: p.primary,
    darkItemHoverBg: p.fillTertiary,
    darkGroupTitleColor: p.textTertiary,
    darkPopupBg: p.bgElevated,
  },

  Button: {
    controlHeight: 42,
    controlHeightSM: 34,
    controlHeightLG: 50,
    fontWeight: 600,
    contentFontSize: 14,
    contentFontSizeSM: 13,
    contentFontSizeLG: 16,
    paddingInline: 18,
    paddingInlineSM: 12,
    paddingInlineLG: 22,
    onlyIconSize: 16,
    onlyIconSizeSM: 14,
    onlyIconSizeLG: 18,
    borderRadius: 8,
    borderRadiusSM: 6,
    borderRadiusLG: 10,

    colorPrimary: p.primary,
    colorPrimaryHover: p.primaryHover,
    colorPrimaryActive: p.primaryActive,
    primaryColor: p.textOnPrimary,
    primaryShadow: 'none',

    dangerColor: p.textOnPrimary,
    dangerShadow: 'none',

    defaultBg: p.bgContainer,
    defaultColor: p.text,
    defaultBorderColor: p.border,
    defaultHoverBg: p.bgElevated,
    defaultHoverColor: p.primary,
    defaultHoverBorderColor: p.primaryBorderHover,
    defaultActiveBg: p.bgElevated,
    defaultActiveColor: p.primaryActive,
    defaultActiveBorderColor: p.primaryActive,
    defaultShadow: 'none',

    defaultGhostColor: p.text,
    defaultGhostBorderColor: p.borderStrong,
    ghostBg: 'transparent',

    textTextColor: p.text,
    textTextHoverColor: p.text,
    textTextActiveColor: p.text,
    textHoverBg: p.fillTertiary,
    linkHoverBg: 'transparent',

    borderColorDisabled: p.border,
  },

  Card: {
    colorBgContainer: p.bgContainer,
    colorBorderSecondary: p.border,
    borderRadiusLG: 12,
    paddingLG: 16,
    headerBg: 'transparent',
    headerFontSize: 16,
    headerFontSizeSM: 14,
    headerHeight: 56,
    headerHeightSM: 44,
    headerPadding: 16,
    headerPaddingSM: 12,
    bodyPadding: 16,
    bodyPaddingSM: 12,
    actionsBg: p.bgContainer,
    actionsLiMargin: '10px 0',
    extraColor: p.textSecondary,
    tabsMarginBottom: -17,
    boxShadowTertiary: p.shadowCard,
  },

  Table: {
    colorBgContainer: p.bgContainer,
    borderColor: p.border,
    headerBg: p.bgElevated,
    headerColor: p.textHeading,
    headerSortActiveBg: p.bgElevated,
    headerSortHoverBg: p.borderSecondary,
    headerSplitColor: p.border,
    headerBorderRadius: 10,
    headerFilterHoverBg: p.fillTertiary,
    rowHoverBg: p.bgElevated,
    rowSelectedBg: p.primaryBg,
    rowSelectedHoverBg: p.primaryBgHover,
    rowExpandedBg: p.bgBase,
    bodySortBg: p.bgContainer,
    fixedHeaderSortActiveBg: p.bgElevated,
    footerBg: p.bgElevated,
    footerColor: p.textSecondary,
    stickyScrollBarBg: p.borderStrong,
    stickyScrollBarBorderRadius: 100,
    filterDropdownBg: p.bgElevated,
    filterDropdownMenuBg: p.bgElevated,
    cellFontSize: 14,
    cellFontSizeMD: 14,
    cellFontSizeSM: 13,
    cellPaddingBlock: 14,
    cellPaddingInline: 16,
    cellPaddingBlockMD: 10,
    cellPaddingInlineMD: 12,
    cellPaddingBlockSM: 8,
    cellPaddingInlineSM: 8,
    selectionColumnWidth: 48,
  },

  Tabs: {
    itemColor: p.textSecondary,
    itemHoverColor: p.primary,
    itemSelectedColor: p.primary,
    itemActiveColor: p.primaryActive,
    inkBarColor: p.primary,
    cardBg: p.bgContainer,
    cardHeight: 40,
    cardPadding: '8px 16px',
    cardGutter: 4,
    horizontalMargin: '0 0 16px 0',
    horizontalItemGutter: 28,
    horizontalItemPadding: '12px 0',
    titleFontSize: 14,
    titleFontSizeLG: 16,
    titleFontSizeSM: 13,
  },

  Input: {
    colorBgContainer: p.bgInput,
    colorBorder: p.border,
    colorText: p.text,
    hoverBorderColor: p.primary,
    activeBorderColor: p.primary,
    hoverBg: p.bgInputHover,
    activeBg: p.bgInputActive,
    activeShadow: `0 0 0 2px ${p.controlOutline}`,
    errorActiveShadow: `0 0 0 2px ${p.errorOutline}`,
    warningActiveShadow: `0 0 0 2px ${p.warningOutline}`,
    addonBg: p.bgElevated,
    paddingBlock: 9,
    paddingBlockSM: 5,
    paddingBlockLG: 12,
    paddingInline: 12,
    paddingInlineSM: 8,
    paddingInlineLG: 14,
    inputFontSize: 14,
    inputFontSizeSM: 13,
    inputFontSizeLG: 16,
  },

  InputNumber: {
    colorBgContainer: p.bgInput,
    hoverBorderColor: p.primary,
    activeBorderColor: p.primary,
    hoverBg: p.bgInputHover,
    activeBg: p.bgInputActive,
    activeShadow: `0 0 0 2px ${p.controlOutline}`,
    errorActiveShadow: `0 0 0 2px ${p.errorOutline}`,
    warningActiveShadow: `0 0 0 2px ${p.warningOutline}`,
    addonBg: p.bgElevated,
    handleBg: p.bgElevated,
    handleHoverColor: p.primary,
    handleActiveBg: p.fillTertiary,
    handleBorderColor: p.border,
    handleWidth: 24,
    handleVisible: 'auto',
  },

  Select: {
    colorBgContainer: p.bgInput,
    colorBgElevated: p.bgElevated,
    selectorBg: p.bgInput,
    hoverBorderColor: p.primary,
    activeBorderColor: p.primary,
    activeOutlineColor: p.controlOutline,
    optionSelectedBg: p.primaryBg,
    optionSelectedColor: p.text,
    optionSelectedFontWeight: 600,
    optionActiveBg: p.fillTertiary,
    optionPadding: '8px 12px',
    optionFontSize: 14,
    optionHeight: 36,
    optionLineHeight: 1.5714285714285714,
    clearBg: p.bgElevated,
    multipleItemBg: p.fillTertiary,
    multipleItemBorderColor: 'transparent',
    multipleItemBorderColorDisabled: 'transparent',
    multipleItemColorDisabled: p.textDisabled,
    multipleSelectorBgDisabled: p.bgDisabled,
    showArrowPaddingInlineEnd: 18,
  },

  DatePicker: {
    colorBgContainer: p.bgInput,
    colorBgElevated: p.bgElevated,
    hoverBorderColor: p.primary,
    activeBorderColor: p.primary,
    activeShadow: `0 0 0 2px ${p.controlOutline}`,
    cellHoverBg: p.fillTertiary,
    cellActiveWithRangeBg: p.primaryBg,
    cellHoverWithRangeBg: p.primaryBgHover,
    cellRangeBorderColor: p.primaryBorder,
    cellBgDisabled: p.bgDisabled,
    presetsWidth: 120,
    presetsMaxWidth: 200,
  },

  Form: {
    labelColor: p.textLabel,
    labelFontSize: 14,
    labelHeight: 32,
    labelColonMarginInlineStart: 2,
    labelColonMarginInlineEnd: 8,
    labelRequiredMarkColor: p.error,
    itemMarginBottom: 20,
    inlineItemMarginBottom: 0,
    verticalLabelPadding: '0 0 6px',
    verticalLabelMargin: 0,
  },

  Checkbox: {
    colorPrimary: p.primary,
    colorPrimaryHover: p.primaryHover,
    colorBgContainer: p.bgInput,
    borderRadiusSM: 4,
    controlInteractiveSize: 16,
  },

  Radio: {
    colorPrimary: p.primary,
    colorPrimaryHover: p.primaryHover,
    colorPrimaryActive: p.primaryActive,
    buttonBg: p.bgContainer,
    buttonColor: p.text,
    buttonCheckedBg: p.primaryBg,
    buttonCheckedBgDisabled: p.bgDisabled,
    buttonCheckedColorDisabled: p.textDisabled,
    buttonSolidCheckedColor: p.textOnPrimary,
    buttonSolidCheckedBg: p.primary,
    buttonSolidCheckedHoverBg: p.primaryHover,
    buttonSolidCheckedActiveBg: p.primaryActive,
    dotColorDisabled: p.textDisabled,
    dotSize: 8,
    radioSize: 16,
    wrapperMarginInlineEnd: 8,
  },

  Switch: {
    colorPrimary: p.primary,
    colorPrimaryHover: p.primaryHover,
    colorTextQuaternary: p.borderStrong,
    colorTextTertiary: p.textTertiary,
    handleBg: '#FFFFFF',
    handleSize: 18,
    handleSizeSM: 12,
    trackHeight: 24,
    trackHeightSM: 16,
    trackMinWidth: 44,
    trackMinWidthSM: 28,
    trackPadding: 2,
    innerMinMargin: 9,
    innerMaxMargin: 27,
  },

  Slider: {
    trackBg: p.primaryBorder,
    trackHoverBg: p.primaryBorderHover,
    railBg: p.fillSecondary,
    railHoverBg: p.fill,
    handleColor: p.primaryBorder,
    handleActiveColor: p.primary,
    handleColorDisabled: p.textDisabled,
    dotBorderColor: p.border,
    dotActiveBorderColor: p.primaryBorder,
    handleSize: 10,
    handleSizeHover: 12,
    railSize: 4,
  },

  Segmented: {
    trackBg: p.fillTertiary,
    trackPadding: 3,
    itemColor: p.textSecondary,
    itemHoverColor: p.text,
    itemHoverBg: p.fillTertiary,
    itemActiveBg: p.fillSecondary,
    itemSelectedBg: p.bgContainer,
    itemSelectedColor: p.primary,
  },

  Tag: {
    borderRadiusSM: 6,
    defaultBg: p.fillTertiary,
    defaultColor: p.textSecondary,
    fontSizeIcon: 10,
  },

  Badge: {
    dotSize: 8,
    indicatorHeight: 20,
    indicatorHeightSM: 16,
    statusSize: 8,
    textFontSize: 12,
    textFontSizeSM: 12,
    textFontWeight: 600,
    indicatorZIndex: 'auto',
  },

  Modal: {
    contentBg: p.bgContainer,
    headerBg: p.bgContainer,
    footerBg: p.bgContainer,
    titleColor: p.textHeading,
    titleFontSize: 18,
    titleLineHeight: 1.4,
    colorBgMask: p.bgMask,
    colorIcon: p.textSecondary,
    colorIconHover: p.text,
    borderRadiusLG: 14,
  },

  Drawer: {
    colorBgElevated: p.bgContainer,
    colorBgMask: p.bgMask,
    colorText: p.text,
    colorSplit: p.split,
    footerPaddingBlock: 12,
    footerPaddingInline: 16,
    zIndexPopup: 1000,
  },

  Dropdown: {
    colorBgElevated: p.bgElevated,
    paddingBlock: 6,
    zIndexPopup: 1050,
  },

  Popover: {
    colorBgElevated: p.bgElevated,
    titleMinWidth: 177,
    zIndexPopup: 1030,
  },

  Popconfirm: {
    zIndexPopup: 1060,
  },

  Tooltip: {
    colorBgSpotlight: p.bgSpotlight,
    colorTextLightSolid: p.textLightSolid,
    zIndexPopup: 1070,
    borderRadius: 8,
  },

  Message: {
    contentBg: p.bgElevated,
    contentPadding: '10px 16px',
    zIndexPopup: 2010,
  },

  Notification: {
    colorBgElevated: p.bgElevated,
    width: 384,
    zIndexPopup: 2050,
  },

  Alert: {
    defaultPadding: '10px 14px',
    withDescriptionPadding: '16px 18px',
    withDescriptionIconSize: 22,
    borderRadiusLG: 10,
  },

  Progress: {
    defaultColor: p.primary,
    remainingColor: p.fillSecondary,
    circleTextColor: p.text,
    circleTextFontSize: '1em',
    lineBorderRadius: 100,
  },

  Spin: {
    colorPrimary: p.primary,
    contentHeight: 400,
    dotSize: 20,
    dotSizeSM: 14,
    dotSizeLG: 32,
  },

  Skeleton: {
    gradientFromColor: p.fillTertiary,
    gradientToColor: p.fillSecondary,
    blockRadius: 6,
    titleHeight: 16,
    paragraphLiHeight: 16,
    paragraphMarginTop: 24,
  },

  Result: {
    titleFontSize: 24,
    subtitleFontSize: 14,
    iconFontSize: 64,
    extraMargin: '24px 0 0 0',
  },

  Empty: {
    colorText: p.textSecondary,
    colorTextDescription: p.textTertiary,
  },

  Pagination: {
    itemBg: p.bgContainer,
    itemLinkBg: p.bgContainer,
    itemInputBg: p.bgInput,
    itemActiveBg: p.primaryBg,
    itemActiveBgDisabled: p.bgDisabled,
    itemActiveColorDisabled: p.textDisabled,
    itemSize: 34,
    itemSizeSM: 26,
    miniOptionsSizeChangerTop: 0,
  },

  Breadcrumb: {
    itemColor: p.textSecondary,
    lastItemColor: p.text,
    linkColor: p.textSecondary,
    linkHoverColor: p.primary,
    separatorColor: p.textTertiary,
    separatorMargin: 8,
    iconFontSize: 14,
    fontSize: 14,
  },

  Steps: {
    colorPrimary: p.primary,
    iconSize: 32,
    iconSizeSM: 24,
    iconFontSize: 14,
    titleLineHeight: 32,
    dotSize: 8,
    dotCurrentSize: 10,
    navArrowColor: p.textTertiary,
    descriptionMaxWidth: 140,
  },

  Anchor: {
    linkPaddingBlock: 4,
    linkPaddingInlineStart: 16,
  },

  Descriptions: {
    labelBg: p.bgElevated,
    titleColor: p.textHeading,
    titleMarginBottom: 16,
    itemPaddingBottom: 16,
    itemPaddingEnd: 16,
    colonMarginRight: 8,
    colonMarginLeft: 2,
    contentColor: p.text,
    extraColor: p.textSecondary,
  },

  List: {
    colorBgContainer: p.bgContainer,
    colorSplit: p.split,
    itemPadding: '12px 0',
    itemPaddingSM: '8px 12px',
    itemPaddingLG: '16px 24px',
    headerBg: 'transparent',
    footerBg: 'transparent',
    avatarMarginRight: 16,
    metaMarginBottom: 16,
    titleMarginBottom: 12,
    contentWidth: 220,
  },

  Statistic: {
    titleFontSize: 14,
    contentFontSize: 24,
    colorTextDescription: p.textSecondary,
    colorText: p.text,
  },

  Collapse: {
    headerBg: p.bgElevated,
    headerPadding: '12px 16px',
    contentBg: p.bgContainer,
    contentPadding: '16px',
    colorBorder: p.border,
    borderRadiusLG: 10,
  },

  Timeline: {
    dotBg: p.bgContainer,
    dotBorderWidth: 2,
    tailColor: p.border,
    tailWidth: 2,
    itemPaddingBottom: 20,
  },

  Tree: {
    colorBgContainer: 'transparent',
    nodeHoverBg: p.fillTertiary,
    nodeHoverColor: p.text,
    nodeSelectedBg: p.primaryBg,
    nodeSelectedColor: p.text,
    directoryNodeSelectedBg: p.primary,
    directoryNodeSelectedColor: p.textOnPrimary,
    titleHeight: 28,
    indentSize: 24,
  },

  TreeSelect: {
    nodeHoverBg: p.fillTertiary,
    nodeSelectedBg: p.primaryBg,
    titleHeight: 28,
  },

  Cascader: {
    optionSelectedBg: p.primaryBg,
    optionSelectedColor: p.text,
    menuPadding: 4,
    dropdownHeight: 180,
    controlWidth: 184,
    controlItemWidth: 111,
  },

  Avatar: {
    containerSize: 34,
    containerSizeSM: 26,
    containerSizeLG: 42,
    textFontSize: 16,
    textFontSizeSM: 14,
    textFontSizeLG: 20,
    groupBorderColor: p.bgContainer,
    groupOverlapping: -8,
    groupSpace: 4,
    colorTextPlaceholder: p.textSecondary,
  },

  Calendar: {
    fullBg: p.bgContainer,
    fullPanelBg: p.bgContainer,
    itemActiveBg: p.primaryBg,
    miniContentHeight: 256,
  },

  Rate: {
    starColor: p.warning,
    starBg: p.fillSecondary,
    starSize: 20,
    starHoverScale: 'scale(1.1)',
  },

  Image: {
    previewOperationColor: p.textLightSolid,
    previewOperationHoverColor: p.textLightSolid,
    previewOperationColorDisabled: p.textDisabled,
    previewOperationSize: 18,
    colorBgMask: p.bgMask,
  },

  Typography: {
    titleMarginTop: '1.2em',
    titleMarginBottom: '0.5em',
    colorLink: p.primary,
    colorLinkHover: p.primaryHover,
    colorLinkActive: p.primaryActive,
    colorTextDescription: p.textSecondary,
    colorTextHeading: p.textHeading,
  },

  Divider: {
    colorSplit: p.split,
    textPaddingInline: '1em',
    orientationMargin: 0.05,
    verticalMarginInline: 8,
  },

  Upload: {
    actionsColor: p.textSecondary,
    colorFillAlter: p.bgElevated,
    colorBgMask: p.bgMask,
  },

  FloatButton: {
    colorBgElevated: p.bgElevated,
    colorText: p.text,
    colorPrimary: p.primary,
    colorPrimaryHover: p.primaryHover,
    borderRadiusLG: 12,
  },
});

export const lightAntdTheme: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
  hashed: true,
  token: buildToken(lightPalette),
  components: buildComponents(lightPalette),
};

export const darkAntdTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  hashed: true,
  token: buildToken(darkPalette),
  components: buildComponents(darkPalette),
};

export const getAntdTheme = (mode: ThemeMode): ThemeConfig =>
  mode === 'dark' ? darkAntdTheme : lightAntdTheme;

export const palettes: Record<ThemeMode, Palette> = {
  light: lightPalette,
  dark: darkPalette,
};
