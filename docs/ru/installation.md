# Установка

## Требования

| Компонент | Версия / условие |
| --- | --- |
| BB | 0.49 или новее; совместимость с SDK плагинов 0.6.132 или новее. |
| Node.js | 24 или новее. В CI используется Node 24. |
| ZCode Desktop | Установлен, выполнен вход в аккаунт. Поиск установки реализован для Windows и macOS. |
| Git | Доступен в PATH для загрузки плагина и закреплённой зависимости из открытого репозитория модуля. |
| Windows | Windows PowerShell 5.1 для настройки прав на папки сессий. |

CLI не требует Python, Swift или разрешения Accessibility. Они нужны [прежнему мосту для macOS](./legacy.md).

## 1. Скачайте и соберите

Выполните команды в PowerShell на Windows или в терминале macOS:

```sh
git clone https://github.com/ichinya/bb-plugin-zcode.git
cd bb-plugin-zcode
npm ci
npm run build:cli
npm run build
```

Коммит модуля закреплён в `package.json` и `package-lock.json`. npm загрузит его автоматически.

## 2. Установите в BB

Запустите BB, затем из папки плагина выполните:

```sh
bb plugin install . --yes
node scripts/register-cli-agent.mjs --register
```

Установка добавляет один плагин `zcode`, включая квоты. Регистрация добавляет **ZCode CLI** через встроенный ACP-провайдер BB и сохраняет остальные пользовательские агенты. Она не запускает запрос к модели и не меняет провайдера существующих чатов.

<figure class="screenshot">

![Установленный плагин ZCode версии 0.1.0 в BB](/screenshots/plugin-installed.png)

<figcaption>Плагин устанавливается один раз. ACP-провайдер выбирается отдельно при создании чата.</figcaption>
</figure>

## 3. Выберите модель

Откройте новый чат BB, меню моделей и провайдера **ZCode CLI**. Выберите источник **Coding Plan**, **Start Plan** или API, затем модель и reasoning. Подробности — в разделе [настройки](./configuration.md).

## Проверка готовности

```sh
node bin/zcode-cli-acp.mjs --doctor
```

Doctor проверяет доступ к аккаунту и получает каталог моделей. Он обращается к сервису аккаунта, но не отправляет запрос модели. Перед публикацией вывода проверьте его на наличие данных аккаунта.

## Обновление

```sh
git pull --ff-only
npm ci
npm run build:cli
npm run build
bb plugin reload zcode
node scripts/register-cli-agent.mjs --register
```

Регистрация сохраняет абсолютные пути к Node и модулю. Повторяйте её после обновления или переноса папки. При установке из локальной папки она должна оставаться доступной BB.
