---
name: zcode-usage
description: Inspect Coding Plan and Start Plan quotas shown in BB's provider usage panel.
---

Open BB's usage panel and select the machine running ZCode. This plugin supplies
separate ZCode Coding Plan and ZCode Start Plan resources through the public
provider-usage.v1 source RPC contract. The panel's Refresh button requests fresh
quota for the selected rows. `bb settings usage --machine <id> --refresh --json`
also requests these rows through the normal panel API.

The plugin reuses saved Desktop sign-in on that machine. Coding Plan reports
only windows supplied by its quota service. Start reports available/total tokens,
consumption and grant expiry. Grant expiry is not a promise of quota renewal.
Missing or failed measurements are unavailable states, never zero usage.

The plugin never sends model prompts, claims promotions, switches plans or writes
Desktop credentials/settings. Reconnect in Desktop after expired authorization.
