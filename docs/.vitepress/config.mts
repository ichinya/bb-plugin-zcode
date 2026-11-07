import { defineConfig } from 'vitepress';

const pages = ['index', 'installation', 'configuration', 'quotas', 'remote-control', 'runtime', 'troubleshooting', 'development', 'legacy'];
const en = ['Overview', 'Installation', 'Configuration', 'Plan quotas', 'QR remote control', 'Standalone zcode-acp', 'Troubleshooting', 'Development & releases', 'Legacy macOS bridge'];
const ru = ['Обзор', 'Установка', 'Настройка', 'Квоты планов', 'Удалённое управление по QR', 'Самостоятельный zcode-acp', 'Решение проблем', 'Разработка и релизы', 'Прежний мост для macOS'];
const sidebar = (lang: string, labels: string[]) => [{
  text: lang === 'ru' ? 'Руководство' : 'Guide',
  items: pages.map((page, i) => ({ text: labels[i], link: `/${lang}/${page === 'index' ? '' : page}` }))
}];

export default defineConfig({
  title: 'ZCode for BB',
  description: 'ZCode CLI/ACP integration and plan quotas for BB.',
  base: process.env.DOCS_BASE || '/bb-plugin-zcode/',
  srcExclude: ['verification/**', 'skill/**', 'native-control.md', 'usage.md', 'README.md'],
  cleanUrls: false,
  lastUpdated: true,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${process.env.DOCS_BASE || '/bb-plugin-zcode/'}logo.svg` }]],
  locales: {
    en: {
      label: 'English', lang: 'en', link: '/en/',
      themeConfig: {
        nav: [{ text: 'Guide', link: '/en/' }, { text: 'Install', link: '/en/installation' }],
        sidebar: sidebar('en', en),
        outline: { label: 'On this page' },
        docFooter: { prev: 'Previous', next: 'Next' },
        lastUpdated: { text: 'Updated' },
        footer: { message: 'Apache-2.0 · Based on VKirill/bb-plugin-zcode', copyright: 'ZCode for BB · Community integration' }
      }
    },
    ru: {
      label: 'Русский', lang: 'ru', link: '/ru/',
      description: 'Интеграция ZCode CLI/ACP и квоты планов в BB.',
      themeConfig: {
        nav: [{ text: 'Руководство', link: '/ru/' }, { text: 'Установка', link: '/ru/installation' }],
        sidebar: sidebar('ru', ru),
        outline: { label: 'На этой странице' },
        docFooter: { prev: 'Назад', next: 'Далее' },
        lastUpdated: { text: 'Обновлено' },
        darkModeSwitchLabel: 'Оформление', lightModeSwitchTitle: 'Светлая тема', darkModeSwitchTitle: 'Тёмная тема',
        sidebarMenuLabel: 'Меню', returnToTopLabel: 'Наверх',
        langMenuLabel: 'Изменить язык', skipToContentLabel: 'К содержимому',
        footer: { message: 'Apache-2.0 · На основе VKirill/bb-plugin-zcode', copyright: 'ZCode для BB · Независимая интеграция' }
      }
    }
  },
  themeConfig: {
    logo: '/logo.svg',
    socialLinks: [{ icon: 'github', link: 'https://github.com/ichinya/bb-plugin-zcode' }],
    search: { provider: 'local', options: { locales: { ru: { translations: {
      button: { buttonText: 'Поиск', buttonAriaLabel: 'Поиск по документации' },
      modal: { noResultsText: 'Ничего не найдено', resetButtonTitle: 'Очистить', footer: { selectText: 'выбрать', navigateText: 'перейти', closeText: 'закрыть' } }
    } } } } },
    outline: [2, 3],
  },
});
