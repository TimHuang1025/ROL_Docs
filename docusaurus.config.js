// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: '游戏项目文档',
  tagline: 'Unity战略游戏技术文档',
  favicon: 'img/favicon.ico',

  url: 'https://your-site.com',  // 改成你的网址
  baseUrl: '/',

  organizationName: 'yourname',  // 你的GitHub用户名
  projectName: 'game-docs',      // 你的仓库名

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
        },
        blog: false,  // 关闭博客功能
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: '游戏文档',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'API文档',
          },
          {
            type: 'dropdown',
            label: '系统文档',
            position: 'left',
            items: [
              { label: '卡片系统', to: '/docs/systems/card' },
              { label: '联盟系统', to: '/docs/systems/union' },
            ],
          },
        ],
      },
      footer: {
        style: 'dark',
        copyright: `Copyright © ${new Date().getFullYear()} 游戏项目文档`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;