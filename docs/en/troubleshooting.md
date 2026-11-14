# Troubleshooting

## npm cannot download zcode-acp

Both repositories are public. Check network access to GitHub, Git on PATH and local Git URL rewrites. An SSH error such as `Permission denied (publickey)` can indicate a local rewrite; the manifest uses a public HTTPS dependency. Keep the pinned module revision; do not replace it with an unrelated package of the same name.

## ZCode CLI does not appear in BB

Ensure BB is running and registration succeeded:

```sh
node scripts/register-cli-agent.mjs --register
```

Open a new thread and look for **ZCode CLI**, not just **ZCode**. If the script cannot locate BB, set `BB_CLI` to the official BB JavaScript CLI entry or executable, then retry. After moving the checkout or Node installation, register again.

## Node exits with “bad option: --bb-permission=full”

An old launch spec put adapter arguments before Node's script. Current registration uses `insertAfterArgs: 1`, producing `node <script> --bb-permission=full`. Run the registration command again.

## The bundled CLI was not found

Install ZCode Desktop on the machine running the agent. For a custom location, fill **ZCode CLI path** in the plugin settings with its full `resources/glm/zcode.cjs` path. Standalone ACP also accepts `--native-entry PATH` or `ZCODE_NATIVE_ENTRY`. Keep the complete Desktop installation available.

## A plan or model is missing

ZCode 3.18.2 stores Desktop sign-in as `enc:v2`. Use Rust ACP **0.3.2 or newer**; older adapters can mistake that format for a signed-out account and hide both Coding Plan and Start Plan while personal API connections remain visible. The adapter reads the existing OS keyring (Windows Credential Manager, macOS Keychain or Linux Secret Service), or the same configured secret/secret file as Desktop. It does not change Desktop files or create OS credentials. If the OS store is locked or unavailable, unlock it and retry; do not replace or export the account files.

Reconnect the correct account in Desktop and run doctor. Start Plan appears only with a verified positive balance for a recognized catalog model. An expired, future or exhausted grant is excluded. API sources must already be configured in ZCode. Available source/model combinations can differ between accounts.

## Quotas fail or remain stale

ACP 0.3.2 uses the operating system's trusted CA certificates for account HTTPS requests. This also fixes installations where the older adapter intermittently rejected a service certificate that Windows trusted. Transport errors distinguish TLS validation, DNS and connection failures without exposing tokens or key-bearing URLs.

Select the correct machine and an individual ZCode source in **Provider usage**, then reload. A combined-panel warning may originate from another provider. Reconnect expired authorization in Desktop. Old visible values retain their previous timestamp and are not a fresh balance.

## Windows cannot protect the session directory

The runtime uses `powershell.exe` and Windows ACLs. Ensure Windows PowerShell 5.1 and its built-in security module are available. A PowerShell 7 parent can pass an incompatible `PSModulePath` to its child; retry from Windows PowerShell 5.1. CI runs ACP checks with that shell. Do not bypass directory protection or grant broad access to session state.

## QR asks for sign-in again

Use the same non-private browser profile and preserve cookies. Get a current, complete Mobile Remote Control link from Desktop. Use the same account provider as Desktop. For independent BB sessions, the local CLI route reuses Desktop sign-in without browser pairing.

## A saved session will not resume

Only adapter-owned `bb-native-*` sessions bound to the same workspace can resume. If a previously submitted input has no native history, the adapter fails rather than resending an uncertain prompt. Keep the original state and workspace; do not rename a Desktop task to force a match.

## Report a problem

Include OS, Node/BB/ZCode versions, the failing command and a sanitized error. Omit tokens, QR links, account files, session databases and private conversation contents. Report issues in the [plugin repository](https://github.com/ichinya/bb-plugin-zcode/issues).
