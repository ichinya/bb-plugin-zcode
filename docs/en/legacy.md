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

The old GUI configuration form has been removed from the BB plugin. The original
provider ID remains available for existing GUI-backed chats. Advanced bridge
options can still be supplied explicitly to the legacy launcher through its
environment; they are separate from [ZCode CLI configuration](./configuration.md).

Project-list cleanup is disabled by default. The bridge only removes its
auto-created project entries when `ZCODE_ACP_REMOVE_PREFIXES` is explicitly set.
There is no preset folder from another application. Project files are not deleted.

`zcbridge doctor` checks the bridge. `zcbridge --help` lists commands for tasks, projects, models, usage and approvals. `zcbridge rewards --claim` explicitly requests a daily reward; it is not part of installing or checking the native ACP provider.

## Operational limits

GUI control needs an unlocked, awake Mac and depends on ZCode's interface. App updates can break it. Its task queue, Desktop project management and plan-routing options are separate from the native adapter's sessions. See the [upstream repository](https://github.com/VKirill/bb-plugin-zcode) for the original bridge's detailed command reference.
