---
name: zcode-usage
description: Inspect Coding Plan and Start Plan quotas shown in BB's provider usage panel.
---

Open BB's usage panel and select the machine running ZCode. This plugin supplies
separate ZCode Coding Plan and ZCode Start Plan resources through the public
provider-usage.v1 source RPC contract. The panel's Refresh button requests fresh
quota for the selected rows. `bb settings usage --machine <id> --refresh --json`
also requests these rows through the normal panel API.

To install or update Rust zcode-acp, open the ZCode plugin settings, choose the
computer in `zcode-acp · Rust`, then Install or Check for updates / Update.
The panel shows the current and latest stable version. Downloads come from
ichinya/zcode-acp GitHub Releases, with SHA-256 and executable-version checks.
With `acpCommand` empty, chat/model/quota launches use that host's managed
installation, then PATH. A custom `acpCommand` has priority; Use installed ACP
clears that global override. `nativeEntry` separately points to the installed
resources/glm/zcode.cjs. Updating ACP never modifies the ZCode application or
replaces binaries used by active chats.

The plugin reuses saved Desktop sign-in on that machine. Coding Plan reports
only windows supplied by its quota service. Start reports available/total tokens,
consumption and grant expiry. Grant expiry is not a promise of quota renewal.
Missing or failed measurements are unavailable states, never zero usage.

The plugin never sends model prompts, claims promotions, switches plans or writes
Desktop credentials/settings. Reconnect in Desktop after expired authorization.
