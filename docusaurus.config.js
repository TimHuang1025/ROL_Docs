// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: '游戏项目文档',
  tagline: 'Unity战略游戏技术文档',
  favicon: 'img/favicon.ico',

  url: 'https://timhuang1025.github.io',  // 你的GitHub Pages地址
  baseUrl: '/ROL_Docs/',  // 你的仓库名（前后都要斜杠）

  organizationName: 'TimHuang1025',  // 你的GitHub用户名
  projectName: 'ROL_Docs',  // 你的仓库名
  deploymentBranch: 'gh-pages',  // 部署分支
  trailingSlash: false,  // URL末尾不加斜杠

  onBrokenLinks: 'warn',
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
              { label: '卡片系统', to: '/docs/卡牌' },  // 修改为实际路径
              { label: '工会系统', to: '/docs/工会' },  // 修改为实际路径
            ],
          },
          {
            href: 'https://github.com/TimHuang1025/ROL_Docs',  // 添加GitHub链接
            label: 'GitHub',
            position: 'right',
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