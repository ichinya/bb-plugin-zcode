# Разработка и релизы

## Проверка плагина

Из корня репозитория:

```sh
npm ci
npm run verify
```

Команда проверяет типы и сгенерированные файлы авторизации через закреплённый модуль, собирает бандлы BB и запускает профильные тесты CLI/ACP, квот и правил тегирования. Фикстуры не отправляют запросы к модели. В `npm test` также входит расширенный набор прежнего моста; он не является контрактом CI для трёх ОС.

Workflow `CI` работает на Linux, Windows и macOS с Node 24 и закреплённым BB CLI 0.49.0. Открытый модуль загружается по полному коммиту из `package.json`, затем npm использует этот проверенный локальный клон. Ключ модуля не требуется; pull request из fork может выполнять те же проверки.

## Автоматические теги

Обновляйте версию плагина вместе с lockfile:

```sh
npm version 0.1.1 --no-git-tag-version
```

Создайте коммит и отправьте в `main`. Когда все три проверки пройдут, Actions создаст `v<версия>` для проверенного коммита. Существующие теги не переносятся; повторное использование версии пропускает создание тега. Устаревшие запуски тоже пропускают его. Ручной CI в `main` следует тем же правилам. Тег не публикует пакет в npm.

## Документация

Языковые версии находятся в `docs/en` и `docs/ru`. У VitePress отдельные manifest и lockfile, поэтому сборка сайта не устанавливает ACP-runtime.

```sh
cd docs
npm ci
npm run dev
```

Для просмотра production-сборки:

```sh
npm run build
npm run check
npm run preview
```

Базовый путь сайта — `/bb-plugin-zcode/`. Для размещения под другим репозиторием задайте `DOCS_BASE` перед сборкой. Сборка отклоняет неработающие Markdown-ссылки; проверка сайта сверяет языковые разделы, ссылки статических страниц и скриншоты.

Загружается только результат `.vitepress/dist`. Локальные отчёты проверок и прежние материалы agent skill исключены из поиска страниц. Приватным файлам не место в `docs/public`.

## Настройка GitHub Pages

Workflow `Documentation` собирает сайт при изменении связанных файлов в push и pull request. Для публикации нужно включить Pages с источником **GitHub Actions** и переменную репозитория `PAGES_ENABLED=true`.

Этот репозиторий и `zcode-acp` открыты. Сайт публикуется по адресу [ichinya.github.io/bb-plugin-zcode](https://ichinya.github.io/bb-plugin-zcode/). Настройка хостинга описана в [инструкции GitHub по источнику публикации](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Для восстановления конфигурации Pages в подходящем fork замените имя репозитория и выполните:

```sh
gh api repos/ichinya/bb-plugin-zcode/pages --method POST -f build_type=workflow
gh variable set PAGES_ENABLED --repo ichinya/bb-plugin-zcode --body true
gh workflow run docs.yml --repo ichinya/bb-plugin-zcode
```

Публикации выполняются последовательно через окружение `github-pages` с разрешениями `pages: write` и `id-token: write`. Публикуется только собранный артефакт документации.

## Авторство и лицензии

Плагин основан на [VKirill/bb-plugin-zcode](https://github.com/VKirill/bb-plugin-zcode), Apache-2.0. MIT-атрибуция адаптера аккаунта и уведомления об исходниках сохранены в самостоятельном модуле `zcode-acp`. Интеграция поддерживается сообществом.
