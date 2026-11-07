# Legacy macOS GUI bridge

The original provider **ZCode** (`zcode`) drives the Desktop window through macOS Accessibility and reads results from the local database. **ZCode CLI** (`acp-zcode-cli`) uses the separate native ACP runtime. Choose the CLI route for the current setup guide.

## Requirements and installation

The GUI bridge requires macOS, a signed-in ZCode Desktop app, Python 3, Node.js and Xcode Command Line Tools for `swiftc`. From a checkout of this repository:

```sh
scripts/install.sh --default-mode full
```

The script builds `zcax`, installs `zcbridge` and the legacy `zcode-acp` launcher in the user's bridge directory and installs the BB plugin. Check the proposed operations with `scripts/install.sh --dry-run` first. For the current native provider, follow [installation](./installation.md) instead.

Grant macOS Accessibility to the terminal or Node process that runs `zcax`. Keep ZCode open and signed in. The Windows UI helper supports read-only inspection, not this GUI task-control flow.

## Settings

<figure class="screenshot">

![Legacy ZCode GUI settings in BB](/screenshots/legacy-settings.png)

<figcaption>This form configures the legacy GUI provider. It does not select the source or permissions for ZCode CLI.</figcaption>
</figure>

The form includes default mode, whether BB permissions take precedence, the scope of automatic once-only approvals, model override, billing-plan route, task concurrency, automatic projects and instruction forwarding. These are settings of the original GUI implementation.

`zcbridge doctor` checks the bridge. `zcbridge --help` lists commands for tasks, projects, models, usage and approvals. `zcbridge rewards --claim` explicitly requests a daily reward; it is not part of installing or checking the native ACP provider.

## Operational limits

GUI control needs an unlocked, awake Mac and depends on ZCode's interface. App updates can break it. Its task queue, Desktop project management and plan-routing options are separate from the native adapter's sessions. See the [upstream repository](https://github.com/VKirill/bb-plugin-zcode) for the original bridge's detailed command reference.
