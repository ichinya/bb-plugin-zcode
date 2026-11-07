# Local and QR connections

The primary adapter is the separate `zcode-acp` npm dependency. The
existing `zcode-acp.mjs` remains the separate macOS accessibility provider.
The module entry uses Node without npm dependencies, Python, Swift or Windows
UI Automation. QR is an additional route to the already running desktop window.

## Local native transport

```powershell
node bin/zcode-cli-acp.mjs
```

This starts an ACP agent over newline-delimited JSON on stdin/stdout. It is meant
for an ACP client, rather than an interactive terminal. You can also start
`bin/zcode-connect.mjs local` and `bin/zcode-native-acp.mjs` are aliases.

The old plugin CLI paths are thin compatibility imports, requiring the plugin's
installed `zcode-acp` dependency. For a readiness check, run
`node bin/zcode-cli-acp.mjs --doctor`.
It checks the saved account and discovers models without sending a model prompt.
The account service is contacted to obtain a temporary project token and confirm
the subscription. It does not run a model connectivity test.

Register this checkout in the running BB with:

```powershell
node .\scripts\register-cli-agent.mjs --register
```

The script adds **ZCode CLI** (`acp-zcode-cli`) through BB's existing ACP providers
plugin, preserving other custom agents. It does not install or rebuild the legacy
GUI plugin. Open a new BB thread and select **ZCode CLI**, then an actual model.
No generation test runs during registration. `--dry-run` prints the launch spec.
The registration records absolute paths to Node and this checkout and a runtime
fingerprint so BB can refresh its cached ACP capabilities after adapter updates.
Register again after updating or moving either. It does not change BB's default
provider for unrelated work.
Permission flags are inserted after the script path (`insertAfterArgs: 1`), so
Node receives `node <script> --bb-permission=full` rather than interpreting the
adapter's flags as Node options. Both BB permission launch modes are covered by
the executable fixture tests using the registration script's actual launch spec.

The adapter locates ZCode's installed `resources/glm/zcode.cjs` and starts its
`app-server --stdio`. Windows per-user / Program Files and macOS application
locations are supported in discovery. Set `ZCODE_NATIVE_ENTRY` for a different
installation. macOS execution has not been tested here.

Supported ACP operations: initialize, new/load/close, text prompt, cancel,
mode/model/reasoning selection. Native model deltas and tool events are translated
to ACP updates. Permission requests offer allow once and deny; permanent grants
are not forwarded. MCP declarations are passed to the native session through
stdio; the adapter does not create project MCP configuration files. Upstream
ZCode controls its own configuration and persistence.

The default standalone mode is `build` (ask before changes). BB's permission
arguments select `edit` for Accept edits and `yolo` for Full. An explicit
`ZCODE_NATIVE_MODE` can select build/plan/edit/yolo, but BB Accept edits cannot
be escalated to yolo. The legacy GUI provider's route/queue/model environment
settings are not interpreted. Models and low/high/max reasoning choices come
from each native model's actual capabilities. Changing reasoning keeps the model
ID stable. Legacy thought-level controls remain supported when offered.

Models are grouped by their native provider identity: Coding Plan, Start Plan,
other account plans and each personal API connection. For example,
`Coding Plan · Z.ai / GLM-5.3` and `B.AI / deepseek-v4-flash` identify the source
in every row. ACP select options also carry source groups. BB 0.49 flattens those
groups in its model picker, so the row prefixes keep the source visible there.
Models from one source stay adjacent; Coding Plan and Start Plan come first.
Identical model names from different sources retain distinct IDs and routing.
Only available native models appear. Start Plan is advertised only for model
balances verified through ZCode's official account service. Discovery does not
claim promotions, add subscriptions or change Desktop's selected connection.

This is a separate runtime. It creates IDs starting with `bb-native-` and only
resumes those IDs. It must not resume, stop or take over desktop-owned tasks.
Closing the ACP connection stops its own active turns and closes its app-server
processes. Session databases, bindings and logs live separately under
`~/.zcode-bridge/native-acp/<session-id>/`; override the base with
`ZCODE_ACP_STATE_DIR`. Windows session directories have an explicit current-user
ACL; POSIX uses 0700 directories / 0600 bindings. Desktop's sign-in/configuration
remain in their original location. Native artifacts and other native storage
still follow ZCode's own storage configuration.

Loading a persisted session replays its user and assistant text. ZCode does not
persist an empty session before its first input: the adapter recreates a known
empty session with the same ID and saved model/mode. A submission checkpoint is
written before session/send. If an input was attempted and native history is
missing, resume fails explicitly; it neither creates a replacement nor resends
the uncertain input. A different workspace cannot take over a saved session.

### Desktop authorization and current limits

The adapter reads Desktop's existing encrypted sign-in and implements the host
account overlay plus `interaction/requestProviderRuntimeHeaders`. Individual
Z.ai / BigModel Coding Plan uses the account service to obtain short-lived
project tokens in memory. There is no token copy in ACP settings or session
bindings and no `zcode login` call. Temporary tokens are refreshed automatically;
expired or rejected account sign-in still needs reconnection in Desktop. A change
of Desktop account invalidates the running account host. Official MCP account
headers are restricted to the official origin and bound workspace.

Start Plan uses the saved ZCode JWT, separately from Coding Plan project tokens.
The module's `lib/native-account.mjs` combines both account overlays without hiding either
because the other connection is selected in Desktop. The active OAuth family
(Z.ai or BigModel) remains bound to that Desktop sign-in. The Start balance GET
uses the official `zcode.z.ai` endpoint, installed app version and Desktop device
identity. Only positive, current token balances for native catalog models grant
access; future, expired, exhausted and unrecognized grants are excluded.
Balance reuse is bounded by 60 seconds and grant expiry. The next runtime auth
request rechecks stale balance. It never falls back to Coding Plan if Start is
unavailable. Start auth validates plan, family, model, session and workspace and
re-reads saved sign-in before returning its in-memory authorization. Coding Plan
failure does not block a verified Start Plan or personal API connections.
No claim, model connectivity test, login refresh or Desktop configuration write
runs during discovery. Official MCP auth currently still requires Coding Plan.

The account integration is adapted from dpolishuk/bb-zcode at commit
`6d38b9ef14d53bbce25a3cd8f5c99b6e5cc828de` under MIT; see
`LICENSES/bb-zcode-MIT.txt` and `NOTICE`. The implementation, source reference and
generator belong to `zcode-acp`; `node scripts/build-native-auth.mjs --check`
delegates to the module's generator for compatibility.

On Windows, Desktop 3.17.2 / CLI 0.17.1 / Node 24.13.0, account discovery confirmed
GLM Coding Pro and returned the actual GLM-5.3 and GLM-5.3-Flash catalog. BB 0.49.0
registered the ACP provider and read its catalog. Both GLM models were selected
through native session/setModel with their mandatory advertised reasoning level;
low/high/max options were returned. The safe account/catalog/configuration
local receipt is `docs/verification/cli-readiness-probe.json` (not committed).
No model prompt was sent.
The same plugin supplies separate Coding Plan and Start Plan rows in BB's
standard usage panel through `provider-usage.v1` RPC, implemented in `usage/`.
It reads saved Desktop sign-in on each target machine; no ACP session or model
request is needed. Coding reports only the quota windows actually returned by
the account service. Start reports available/total tokens, consumption and grant
expiry (not a promise of renewal). See [usage.md](usage.md) for installation.
The later local `docs/verification/plan-selection-probe.json` receipt confirms simultaneous
Coding Plan and Start Plan discovery, separate GLM-5.3-Flash selections and
runtime-auth host responses using the correct distinct credentials. The live
Start balance granted GLM-5.3-Flash, and both sources advertised low/high/max.
Desktop credentials and settings were unchanged during those selection checks.
Real generation, paid usage, real tool approvals and the macOS runtime remain
unverified. Prompt/cancel/permission behavior is covered by synthetic fixtures.

Team Plan, image/audio attachments, native interactive user questions,
browser control, custom subagent runtime profiles, fork/rewind and manual compact
are not implemented in this ACP adapter. Existing personal API providers appear
in the native catalog, but their generation has not been verified here. Native
memory is off by default to avoid background model requests; explicitly set
`ZCODE_NATIVE_MEMORY=1` to enable it for future sessions. Runtime configuration
uses the built-in subagent profile fallback; full subagent execution is not yet
qualified. Unsupported native interactions return explicit errors. The adapter
omits raw native error contents from ACP because those can include credentials.

## QR link to the running desktop

ZCode's official Mobile Remote Control client controls the existing desktop
window and its workspaces. This is the applicable route for tasks already running
in the desktop. The official web client handles account login, pairing, RPC,
approvals, sending and stopping tasks.

1. Open Mobile Remote Control in ZCode yourself and copy its link into a local
   UTF-8 file, for example `D:\Projects\zcode-bridge\remote-link.txt`.
2. Validate the link without connecting:

   ```powershell
   node .\bin\zcode-connect.mjs remote --link-file ..\remote-link.txt
   ```

3. To open the official client in the default browser, add `--open`. Complete the
   official account login / pairing in the browser. The launcher does not automate
   authentication or report that pairing succeeded.

Only official `https://zcode.z.ai/remote/v4` URLs with `sid`, `mid` and
`app_version` are accepted. The complete URL is preserved, including app_version;
the bare `/remote/v4` currently serves an older client with a different login
protocol. Old hash / `t` links and other origins are rejected. Pairing identifiers
are omitted from command output. Protect the link file as account connection data.

The remote mode is a launcher for the official web interface, **not a headless
remote ACP transport**. On 7 November 2026 a supplied 3.17.2 QR link opened the
official remote sign-in page. It required the same provider/account as Desktop;
selecting Z.ai led to its normal account login. After the user completed sign-in,
Playwright observed pairing, workspace synchronization and the actual project/task
list. Opening an existing idle task loaded its saved conversation, composer,
model picker and mode picker. No prompt, Stop, approval or configuration change
was submitted; these operations remain unverified. The observation receipt is
local `docs/verification/remote-live-probe.json`, without pairing IDs or
conversation contents. BB's desktop browser automation could not start on
win32-x64 (no DevBrowser runtime); the live check used Playwright instead.
A future headless relay adapter would need terminal login tokens,
the ws2 authentication flow, workspace bridges, fragmented RPC frames and recovery.
It cannot be implemented as a single unauthenticated request to the QR URL.

Official references: [remote control](https://zcode.z.ai/en/docs/remote-control),
[release notes](https://zcode.z.ai/en/changelog). The account-login behavior was
also checked against the installed 3.17.2 application and its versioned public
web client, because the prose documentation describes some older link behavior.

## Verification

```powershell
node --test tests/native-wire.test.mjs tests/remote-link.test.mjs tests/usage-cache.test.mjs tests/usage-source.test.mjs
# From the zcode-acp module directory:
node --test tests/*.test.mjs
```

These tests use a fake native server, with no model calls. The archived live
offline probe checked the actual ACP executable, installed native server,
session creation, build/plan mode changes, known-empty cold restoration and
shutdown in an isolated profile with network access blocked. Its retained
local receipt is `docs/verification/native-acp-probe.json` (not committed).
These observations do not prove model execution, QR pairing or nonempty live
history recovery after a real model turn. Temporary profiles and exploratory
scripts were removed from the workspace during cleanup; the private backup is
listed in the workspace README. The compact receipts in `docs/verification/`
record historical checks, not a new test run at cleanup time.
