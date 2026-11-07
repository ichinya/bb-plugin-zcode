# Configuration

## Select ZCode CLI

Open the model picker in a new BB thread and select **ZCode CLI**. The provider ID is `acp-zcode-cli`.

![ZCode CLI models grouped by their source prefixes](/screenshots/model-picker.png)

## Choose the source before the model

| Source | Authorization and routing |
| --- | --- |
| Coding Plan · Z.ai / BigModel | Reuses the active Desktop account family and obtains temporary project tokens. |
| Start Plan · Z.ai / BigModel | Uses the Desktop sign-in and a verified, positive, unexpired model balance. It does not fall back to Coding Plan when unavailable. |
| Personal API connection, such as B.AI | Uses the connection already configured in ZCode. Each source retains its own identity. |

BB 0.49 displays a flat model list, so source names are included in row labels. Coding Plan and Start Plan appear first. Model availability comes from the native catalog and account service; an example screenshot is not a promise that the same models are available for every account.

Reasoning choices, such as **Low**, **High** and **Max**, come from the selected model. Changing reasoning keeps its model ID stable.

## Permissions and modes

| Choice | Native mode |
| --- | --- |
| Standalone default | `build`: ask before changes. |
| BB Accept edits | `edit`. It cannot be escalated to `yolo` by an environment override. |
| BB Full | `yolo`. |
| Explicit planning | `plan`, when selected through the adapter's configuration. |

ACP tool permissions offer **allow once** and **deny**. Permanent grants are not forwarded.

## Plugin page

The plugin page has one optional setting: **ZCode CLI path** (`nativeEntry`).
Enter the full path to `resources/glm/zcode.cjs` on the machine running the agent,
for example `D:\Apps\ZCode\resources\glm\zcode.cjs`. Use the file path, without
shell quotes. Leave it empty for automatic discovery.

The plugin forwards it to **ZCode CLI** as `ZCODE_NATIVE_ENTRY`, including model
discovery. Quota inventory and collection use the same path. It is read for each
new command; re-registration is unnecessary. Restart an already running ACP
session and refresh the model/usage panel after changing installations.

Model, plan, reasoning and permissions remain chat options. Coding Plan and
Start Plan quotas are in **Provider usage**.

<figure class="screenshot">

![ZCode plugin page with an optional CLI path and chat guidance](/screenshots/provider-settings.png)

<figcaption>Model and permission controls live in the chat, not in a second plugin form.</figcaption>
</figure>

## Sign-in

Sign in through ZCode Desktop. The adapter reads its saved sign-in and refreshes short-lived project tokens in memory. Normal restarts do not require signing in through a browser again. If the saved account expires or is rejected, reconnect it in Desktop.

Do not run `zcode login` as an installation step. Do not copy account tokens into the plugin settings or commit account files.

## Optional environment overrides

Other advanced overrides belong to the **ACP agent's environment** in BB's ACP provider configuration. The plugin exposes only the installation-path override. `--dry-run` shows the registration object:

```sh
node scripts/register-cli-agent.mjs --dry-run
```

| Variable | Purpose |
| --- | --- |
| `ZCODE_NATIVE_ENTRY` | Absolute path to the installed `resources/glm/zcode.cjs` when automatic discovery fails. |
| `ZCODE_STORAGE_DIR` | Explicit Desktop storage directory; otherwise `.zcode` under the configured data base/home is used. |
| `ZCODE_DATA_BASE_DIR` | Base directory for the default `.zcode` storage location. |
| `ZCODE_ACP_STATE_DIR` | Adapter session root; default `~/.zcode-bridge/native-acp`. |
| `ZCODE_NATIVE_MODE` | `build`, `plan`, `edit` or `yolo`, within BB's permission limit. |
| `ZCODE_NATIVE_MEMORY` | `1` enables native memory for future sessions. Off by default to avoid background model requests. |

Re-registering replaces this agent's launch object, including its environment. Reapply custom overrides afterward. Windows session folders use a current-user ACL; POSIX folders use mode 0700. ACP sessions use `bb-native-*` IDs and never resume Desktop-owned tasks.
