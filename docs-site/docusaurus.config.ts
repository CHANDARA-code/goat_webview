import { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Goat WebView Mini-App Engine",
  tagline:
    "High-Performance, Multi-Tenant, Enterprise-Hardened Mini-App Runtime",
  favicon: "img/favicon.ico",

  url: "https://chandara-code.github.io",
  baseUrl: "/goat_webview/",

  organizationName: "CHANDARA-code",
  projectName: "goat_webview",

  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "Goat WebView",
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Documentation",
        },
        {
          to: "/api",
          label: "API Matrix (197 Actions)",
          position: "left",
        },
        {
          to: "/simulator",
          label: "Device Simulator",
          position: "left",
        },
        {
          to: "/showcase",
          label: "Component Showcase",
          position: "left",
        },
        {
          href: "https://github.com/goat-webview/goatwebview",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Getting Started",
              to: "/getting-started/quickstart",
            },
            {
              label: "Bridge API Reference",
              to: "/bridge/api-reference",
            },
            {
              label: "Security & Sandboxing",
              to: "/security/owasp-masvs-compliance",
            },
          ],
        },
        {
          title: "Platforms",
          items: [
            {
              label: "Android SDK",
              to: "/platforms/android",
            },
            {
              label: "iOS Framework",
              to: "/platforms/ios",
            },
            {
              label: "React Native",
              to: "/platforms/react-native",
            },
            {
              label: "Flutter",
              to: "/platforms/flutter",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Goat WebView Engine. Built with Docusaurus.`,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
