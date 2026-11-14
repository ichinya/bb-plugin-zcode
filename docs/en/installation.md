# Installation

Running the plugin requires BB 0.49+, signed-in ZCode Desktop and the Rust `zcode-acp` executable. ZCode's bundled runtime is selected automatically; a separate Node.js installation is optional. Windows also needs Windows PowerShell 5.1 for session ACLs. Building the plugin from source below uses Node.js 24+/npm; building the executable requires Rust.

## 1. Install the plugin

Install the ZCode plugin, then open **Settings → ZCode CLI**. In its **zcode-acp · Rust** section, choose the computer running the agent. The panel shows the version currently in use, the latest stable release and the executable path.

Click **Install** to download the binary for that computer. Later use **Check for updates → Update**. The plugin verifies SHA-256 and the executable's Rust/version response before activating it. Windows x64, Linux x64 and macOS Intel/Apple Silicon are supported. It writes only to the plugin's persistent data directory; the installed ZCode application is untouched.

Leave **ACP executable** empty to use the downloaded version automatically. An existing custom path keeps priority; after installing, **Use installed ACP** clears that override for all computers. Running chats keep their old executable until their next ACP launch; updates do not overwrite an executable held by Windows.

If the release was just published, wait for its binary workflow to finish and check again. If there is no published release, the panel says so and disables installation. A failed download or verification keeps the previously installed version.

## Optional: install ACP yourself

Build from the separate repository:

```sh
git clone https://github.com/ichinya/zcode-acp.git
cd zcode-acp
cargo install --path . --locked
zcode-acp --version
cd ..
```

Ensure Cargo's bin directory is on the PATH visible to BB; restart BB after changing PATH. Alternatively, keep a release build anywhere and set its full path in the plugin's **ACP executable** field. See [standalone runtime](./runtime.md).

## Build the plugin from source

```sh
git clone https://github.com/ichinya/bb-plugin-zcode.git
cd bb-plugin-zcode
npm ci
npm run build
bb plugin install . --yes
```

The plugin registers **ZCode CLI** itself, with provider ID `acp-zcode-cli`, and launches the Rust executable directly. There is no runtime npm dependency or intermediate JS launcher.

If using your own executable outside PATH, set **ACP executable**, for example `D:\Tools\zcode-acp.exe`. Otherwise leave it empty: the plugin uses its installed binary first, then PATH. **ZCode CLI path** is a different setting: it points to the installed `resources/glm/zcode.cjs` and is normally empty. Both paths refer to the host running the agent.

## 3. Check and select a model

```sh
zcode-acp --doctor
```

Use the full executable path if it is outside PATH. Doctor contacts the account service but sends no model prompt. In a new BB chat select **ZCode CLI**, then choose a Coding Plan, Start Plan or personal API model. See [configuration](./configuration.md).

## Update

For a plugin-managed executable, use **Check for updates → Update** in the plugin settings. Updating the plugin itself remains separate. For an executable installed manually, update/build it yourself. Then:

On Windows an open chat may hold the old executable. Build into a versioned directory, for example `cargo build --release --locked --target-dir target/versions/0.3.1`, and select that directory's `release/zcode-acp.exe` in **ACP executable**. This avoids replacing a binary used by an active session.

```sh
git pull --ff-only
npm ci
npm run build
bb plugin reload zcode-acp
node scripts/register-cli-agent.mjs --register
```

The provider reads updated plugin settings for launches and model discovery. Restart existing sessions and refresh models/quotas after changing **ACP executable**. This local-path plugin installation needs its checkout to remain available.

### Migrate an existing Custom agent

Before loading this version, remove only the obsolete ZCode custom-agent entry:

```sh
node scripts/register-cli-agent.mjs --register
bb plugin reload zcode-acp
```

This migration helper preserves other custom agents. It does not register another agent: the plugin now owns the same provider ID. New installations do not need the helper.

Chats opened before the upgrade can retain a runtime with the old JS launch command even after reloading the plugin. For an affected chat, run:

```sh
bb thread stop <thread-id>
```

This releases the runtime while preserving history and the workspace. Then click **Retry** in that chat. Its next launch uses the current Rust executable. This migration does not require `thread clear`.
