# Самостоятельный zcode-acp

[zcode-acp](https://github.com/ichinya/zcode-acp) — отдельный **исполняемый файл на Rust**. Он обменивается ACP через stdin/stdout и работает без BB с совместимыми ACP-клиентами.

Адаптер запускает `resources/glm/zcode.cjs` установленного ZCode через **Electron/Node runtime самого приложения**. Для распознанной установки ZCode отдельная установка Node.js не требуется. Для защиты папок сессий в Windows используется Windows PowerShell 5.1.

## Сборка и установка

К опубликованным [релизам zcode-acp](https://github.com/ichinya/zcode-acp/releases) автоматически прикрепляются ZIP-архивы после успешной сборки: Windows x64, Linux x64, macOS ARM64 и macOS Intel. Рядом с каждым архивом находится файл `.sha256`. Распакуйте исполняемый файл и добавьте его в PATH либо укажите полный путь в плагине. Для готовых бинарников Rust не нужен.

Установите стабильный Rust toolchain, затем:

```sh
git clone https://github.com/ichinya/zcode-acp.git
cd zcode-acp
cargo build --release --locked
cargo install --path . --locked
```

`cargo install` помещает команду в папку bin Cargo. Добавьте её в PATH или укажите полный путь к бинарнику в клиенте. Для готового бинарника Rust не нужен. Локальная release-сборка: `target/release/zcode-acp.exe` в Windows и `target/release/zcode-acp` в macOS.

## Команды

```sh
zcode-acp --help
zcode-acp --version
zcode-acp --doctor
zcode-acp --permission=accept-edits
zcode-acp inventory --json
zcode-acp account-scope --json
zcode-acp usage --plan coding --json
zcode-acp usage --plan start --json
zcode-acp runtime-info --json
```

Без подкоманды запускается ACP, а не интерактивный чат терминала. По умолчанию используется `build`; `--permission=full` разрешает `yolo`. Совместимый псевдоним `--bb-permission` имеет приоритет.

Doctor проверяет аккаунт и каталог моделей, не выполняя генерацию. Inventory и account-scope работают локально и не запускают движок. Usage получает квоты только указанного плана, без ACP-сессии, запроса к модели и получения наград. Непрозрачный account scope предназначен для внутреннего ключа кэша.

## Нестандартные пути

```sh
zcode-acp --native-entry "D:/Apps/ZCode/resources/glm/zcode.cjs" --node "C:/Program Files/nodejs/node.exe"
```

Пример пути в macOS: `/Volumes/Apps/ZCode.app/Contents/Resources/glm/zcode.cjs`. `--native-entry` имеет приоритет над `ZCODE_NATIVE_ENTRY`; без них проверяются стандартные пути Windows/macOS. Ошибочный явный путь не заменяется другой установкой.

Runtime выбирается в таком порядке:

1. Явный `--node`, затем `ZCODE_NODE`. Ошибочный путь приводит к ошибке без переключения на другой runtime.
2. Runtime той же установки CLI: `.node-bundle-meta.json` должен объявлять `electron-node`. В Windows используется `ZCode.exe`, в macOS — исполняемый файл из `Contents/MacOS` этого приложения.
3. `node` из PATH для CLI вне распознанного пакета приложения. Для этого варианта нужен Node.js 24+.

`ELECTRON_RUN_AS_NODE=1` задаётся только дочернему процессу встроенного Electron. Для внешнего Node унаследованный флаг удаляется. Окружение родительского процесса не меняется. Ошибка после запуска не приводит к повторному запуску через другой runtime или повторной отправке запроса.

`inventory --json` и `--doctor` возвращают `nativeRuntime`: поля `kind`, `executable` и `source` показывают выбранный runtime и причину его выбора.

## Интерфейс процесса

ACP использует версию протокола 1 и построчный JSON-RPC 2.0. В stdout попадают только сообщения протокола. Inventory, account-scope и runtime-info возвращают JSON с `schemaVersion: 1`. Usage возвращает установленную структуру квот: `status`, `plan`, `accountEmail`, `planLabel` и, при успехе, `windows`. Эти команды не возвращают токены авторизации.

Плагин BB вызывает CLI и больше не зависит от npm-пакета адаптера. Провайдер напрямую запускает Rust-бинарник из PATH или по заданному пути. Адаптер выбирает runtime в указанном выше порядке. Прежняя JS-реализация сохранена в исходниках как образец для регрессионных проверок; Rust-бинарник и плагин её не используют.

## Сессии и проверки

Сохраняются ID `bb-native-*` и формат `binding.json` версии 1 в `~/.zcode-bridge/native-acp`. Базы и логи отделены от Desktop. Восстановление требует ту же каноническую рабочую папку. Если после попытки ввода native-история потеряна, адаптер выдаёт ошибку и не отправляет запрос повторно.

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --locked
cargo build --release --locked
node --test tests/rust-wire.test.mjs
```

Wire-тесты используют Node 24 и синтетический движок без обращений к аккаунту и модели. В CI настроены сборки Windows x64, Linux x64 и macOS ARM64/x64. Матрица CI сама по себе не подтверждает совместимость установленного ZCode на каждой ОС: её нужно проверить на целевой машине.

Apache-2.0; уведомление MIT для адаптированного потока авторизации сохранено в `NOTICE` и `LICENSES/`.

## Публикация бинарников

Задайте версию в `Cargo.toml`, выполните `cargo check` для обновления `Cargo.lock`, отправьте исходники и workflow в репозиторий, затем опубликуйте GitHub Release с соответствующим тегом, например `v0.3.1`. Событие `release: published` запускает проверки и сборку исходников этого тега. Архивы и SHA-256 прикрепляются к уже созданному релизу. Поддерживаются обычные и предварительные релизы; черновики сборку не запускают. Повторный запуск обновляет вложения без создания второго релиза. Запуски CI по push/PR и вручную создают артефакты, но не публикуют релиз.
