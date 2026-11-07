# Coding Plan and Start Plan quotas

Quota presentation is part of `bb-plugin-zcode`. The collector, authorization
and ACP runtime come from the separate `zcode-acp` module. The plugin consumes
its public JavaScript API, without its own native runtime copy. One BB plugin,
`zcode`, is installed; `zcode-acp` is an npm dependency, not another BB plugin.
The registered ACP agent ID stays `acp-zcode-cli`, preserving existing chats and
model IDs. The original GUI provider's agent ID is `zcode`.

```powershell
npm install
bb plugin build
bb plugin install . --yes
```

For a new machine, register the CLI launch spec with
`node scripts/register-cli-agent.mjs --register`. The standalone CLI does not
need npm dependencies. After quota-source edits, rebuild and run
`bb plugin reload zcode`.

The npm dependency is pinned to a specific commit in
[`ichinya/zcode-acp`](https://github.com/ichinya/zcode-acp), so a sibling checkout
is not required. Both repositories are private: Git must have read access to
the module repository before `npm install` or `npm ci`. GitHub CLI users can
configure their normal Git credential helper with `gh auth setup-git`.
No npm-registry publication is performed by building or registering this plugin.

Open BB's usage panel, choose the ZCode machine and All. The source contributes
**ZCode Coding Plan** and **ZCode Start Plan** rows without additional chat agents.
Coding shows quota windows actually returned by the official service (five-hour,
weekly, MCP/tools). Start shows available/total tokens, percentage used and grant
expiry. Expiry does not promise renewal.

Inventory reads local metadata only. Fetching one resource contacts only that
plan. Normal reads permit a 60-second in-memory cache; Refresh forces a fresh
attempt. Saved account changes invalidate the cache. Failed refreshes retain
the previous successful observation time so BB can mark stale results. Unknown
account identity (`accountKey: null`) never merges separate accounts/machines.

Credentials stay on the target machine, reused from Desktop sign-in. No model
prompts, promotion claims, plan switches, login refresh or Desktop settings writes
run during collection. Expired authorization is reconnected in Desktop.

```powershell
node node_modules/typescript/bin/tsc --noEmit
bb plugin build
node --test tests/usage-cache.test.mjs tests/usage-source.test.mjs
```

Migration from the former `zcode-usage` plugin only changes the quota source's
plugin ID. Resources and account state are rediscovered. Remove the separate
plugin/folder after both new rows are verified.
