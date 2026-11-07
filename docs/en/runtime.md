# Standalone zcode-acp

[`zcode-acp`](https://github.com/ichinya/zcode-acp) can run without BB. It is a separate Node.js module with no BB SDK or runtime npm dependencies. It uses the native `app-server --stdio` bundled with installed ZCode Desktop.

## Run from a checkout

Requires Node 24+, Git and signed-in ZCode Desktop on Windows or macOS:

```sh
git clone https://github.com/ichinya/zcode-acp.git
cd zcode-acp
node bin/zcode-acp.mjs --help
node bin/zcode-acp.mjs --doctor
```

Doctor contacts account/catalog services, with no model prompt. To start the ACP transport:

```sh
node bin/zcode-acp.mjs --permission=accept-edits
```

Configure that command in your ACP client. The process exchanges newline-delimited ACP JSON-RPC over stdin/stdout; it is not an interactive terminal chat. The default standalone mode asks before changes. Explicit `--permission=full` permits the full native mode; the `--bb-permission` alias is retained for BB compatibility.

## JavaScript API

When installed as a dependency:

```js
import {
  collectPlanUsage,
  getAccountFingerprint,
  getRuntimeInfo,
} from 'zcode-acp';

const runtime = getRuntimeInfo();
const usage = await collectPlanUsage('start'); // 'coding' is also supported
const accountScope = await getAccountFingerprint();
```

Importing the package root has no process, stdio or network side effects. Calling the collectors does contact account services. `getRuntimeInfo()` returns the version, CLI path and revision. The account fingerprint is an opaque in-memory cache scope, not a credential or public account ID. Quota responses can contain account information; handle them accordingly.

Other public exports include `NativeAcpAgent`, `findNativeEntry`, `nativeDoctor`, `codingQuotaUsage` and `startQuotaUsage`. Types are declared in the module's `index.d.ts`. Importing the explicit `zcode-acp/cli` or `zcode-acp/stdio` entry starts I/O.

## Storage and lifecycle

The adapter owns `bb-native-*` sessions in `~/.zcode-bridge/native-acp`. Session bindings, isolated databases and logs are separate from Desktop-owned tasks. Reusing an existing session requires the same workspace. Closing the connection cancels its own work and closes its native processes.

See [configuration](./configuration.md) for environment variables, authentication and modes, and [overview](./index.md#verification-and-limits) for current limits.

## Module checks

From the module checkout:

```sh
node scripts/build-native-auth.mjs --check
node --test tests/*.test.mjs
```

Tests use synthetic servers and account responses. Windows ACL tests require Windows PowerShell. Apache-2.0 covers this module; the included account-adapter source has its MIT notice in `NOTICE` and `LICENSES/`.
