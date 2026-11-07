# Самостоятельный zcode-acp

[`zcode-acp`](https://github.com/ichinya/zcode-acp) работает без BB. Это отдельный модуль Node.js без SDK BB и зависимостей npm во время исполнения. Он использует native `app-server --stdio` из установленного ZCode Desktop.

## Запуск из исходников

Нужны Node 24+, Git и ZCode Desktop с выполненным входом на Windows или macOS:

```sh
git clone https://github.com/ichinya/zcode-acp.git
cd zcode-acp
node bin/zcode-acp.mjs --help
node bin/zcode-acp.mjs --doctor
```

Doctor обращается к сервисам аккаунта и каталога, не отправляя запрос модели. Для запуска ACP:

```sh
node bin/zcode-acp.mjs --permission=accept-edits
```

Укажите эту команду в своём ACP-клиенте. Процесс обменивается построчным ACP JSON-RPC через stdin/stdout; это не интерактивный чат терминала. По умолчанию самостоятельный запуск спрашивает перед изменениями. Явный `--permission=full` разрешает полный режим native runtime; псевдоним `--bb-permission` сохранён для совместимости с BB.

## Нестандартная установка

Выберите встроенный CLI через `--native-entry ПУТЬ` или `--native-entry=ПУТЬ`:

```sh
node bin/zcode-acp.mjs --native-entry "D:/Apps/ZCode/resources/glm/zcode.cjs"
node bin/zcode-acp.mjs --doctor --native-entry "D:/Apps/ZCode/resources/glm/zcode.cjs"
```

Пример для нестандартного расположения на macOS:
`/Volumes/Apps/ZCode.app/Contents/Resources/glm/zcode.cjs`.
Аргумент имеет приоритет над `ZCODE_NATIVE_ENTRY`. Если оба отсутствуют,
проверяются стандартные папки установки. Несуществующий явно заданный файл
вызывает ошибку, без незаметного выбора другой установки. Пути с пробелами поддерживаются.

В JavaScript передавайте `env: { ...process.env, ZCODE_NATIVE_ENTRY: path }`
в `NativeAcpAgent`, `collectPlanUsage` или `nativeDoctor(cwd, { env })`.

## JavaScript API

При установке в качестве зависимости:

```js
import {
  collectPlanUsage,
  getAccountFingerprint,
  getRuntimeInfo,
} from 'zcode-acp';

const runtime = getRuntimeInfo();
const usage = await collectPlanUsage('start'); // также доступен 'coding'
const accountScope = await getAccountFingerprint();
```

Импорт корня пакета не запускает процессы, stdio или сеть. Вызов функций сбора квот обращается к сервисам аккаунта. `getRuntimeInfo()` возвращает версию, путь CLI и ревизию. Отпечаток аккаунта — непрозрачная область кэша в памяти, а не учётные данные или публичный ID. Ответы квот могут содержать сведения об аккаунте; учитывайте это при их обработке.

Также экспортируются `NativeAcpAgent`, `findNativeEntry`, `nativeDoctor`, `codingQuotaUsage` и `startQuotaUsage`. Типы описаны в `index.d.ts` модуля. Явный импорт `zcode-acp/cli` или `zcode-acp/stdio` запускает ввод-вывод.

## Хранение и жизненный цикл

Адаптер владеет сессиями `bb-native-*` в `~/.zcode-bridge/native-acp`. Привязки сессий, изолированные базы и журналы отделены от задач Desktop. Загрузка существующей сессии требует того же рабочего пространства. Закрытие соединения отменяет собственную работу и закрывает нативные процессы адаптера.

Переменные окружения, авторизация и режимы описаны в [настройке](./configuration.md), текущие ограничения — в [обзоре](./index.md#проверки-и-ограничения).

## Проверки модуля

Из папки исходников модуля:

```sh
node scripts/build-native-auth.mjs --check
node --test tests/*.test.mjs
```

В тестах используются синтетические серверы и ответы аккаунта. Тестам ACL Windows нужен Windows PowerShell. Модуль распространяется по Apache-2.0; уведомление MIT для включённых исходников адаптера аккаунта сохранено в `NOTICE` и `LICENSES/`.
