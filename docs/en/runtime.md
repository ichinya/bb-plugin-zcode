# Standalone zcode-acp

[zcode-acp](https://github.com/ichinya/zcode-acp) is a standalone **Rust executable**. It serves ACP over stdin/stdout and can be used by any compatible ACP client, without BB.

The adapter launches the installed ZCode `resources/glm/zcode.cjs` through **ZCode's own Electron/Node runtime**. A separate Node.js installation is not needed for a recognized ZCode bundle. Windows session ACL protection uses Windows PowerShell 5.1.

## Build and install

Published [zcode-acp releases](https://github.com/ichinya/zcode-acp/releases) receive binary ZIPs automatically after the build matrix passes: Windows x64, Linux x64, macOS ARM64 and macOS Intel. Each ZIP has a `.sha256` checksum file. Extract the executable and add it to PATH, or select its full path in the plugin. Prebuilt executables need no Rust toolchain.

Install the stable Rust toolchain, then:

```sh
git clone https://github.com/ichinya/zcode-acp.git
cd zcode-acp
cargo build --release --locked
cargo install --path . --locked
```

`cargo install` places the command in Cargo's bin directory. Add that directory to PATH, or configure the full executable path in your client. A prebuilt binary needs no Rust installation. On Windows the local release build is `target/release/zcode-acp.exe`; on macOS it is `target/release/zcode-acp`.

## Commands

```sh
zcode-acp --help
zcode-acp --version
zcode-acp --doctor
zcode-acp --permission=accept-edits
zcode-acp inventory --json
zcode-acp account-scope --json
zcode-acp usage --plan coding --json
zcode-acp usage --plan start --json
zcode-acp runtime-info --json
```

The command without a subcommand serves ACP, not an interactive terminal chat. Default mode is `build`; `--permission=full` permits `yolo`. `--bb-permission` is a compatibility alias and takes precedence.

Doctor checks the account and model catalog, without inference. Inventory and account-scope are local-only and do not start the engine. Each usage command collects exactly one plan, without starting an ACP session, sending a model prompt or claiming rewards. Treat the opaque account scope as a private cache key.

## Custom paths

```sh
zcode-acp --native-entry "D:/Apps/ZCode/resources/glm/zcode.cjs" --node "C:/Program Files/nodejs/node.exe"
```

On macOS a custom ZCode path might be `/Volumes/Apps/ZCode.app/Contents/Resources/glm/zcode.cjs`. `--native-entry` overrides `ZCODE_NATIVE_ENTRY`; otherwise standard Windows/macOS locations are searched. A missing explicit file is an error.

Runtime selection, in priority order:

1. Explicit `--node`, then `ZCODE_NODE`. An invalid override fails without switching to another runtime.
2. The selected CLI's bundle, identified by `.node-bundle-meta.json` declaring `electron-node`: `ZCode.exe` on Windows, or the executable from the same app's `Contents/MacOS` on macOS.
3. `node` from PATH for a standalone CLI without a recognized bundled runtime. This fallback requires Node.js 24+.

`ELECTRON_RUN_AS_NODE=1` is set only for the bundled Electron child process. An inherited Electron flag is removed for external Node; the parent environment is unchanged. Runtime failures after launch are not retried with another executable, and prompts are never resent automatically.

`inventory --json` and `--doctor` include `nativeRuntime` with `kind`, `executable` and `source`, so the chosen executable can be inspected without guessing.

## Process contract

ACP uses protocol version 1 and newline-delimited JSON-RPC 2.0. Stdout contains protocol messages only. Inventory, account-scope and runtime-info return JSON with `schemaVersion: 1`. Usage returns the established quota object (`status`, `plan`, `accountEmail`, `planLabel`, and `windows` on success). No credentials are returned by these commands.

The BB plugin invokes this process contract and has no npm dependency on the adapter. The provider launches the Rust executable directly, from PATH or the configured path. The adapter then selects the runtime as described above. The old JavaScript implementation remains in the source tree as a regression reference; it is not used by the Rust binary or the plugin.

## Sessions and checks

Sessions retain `bb-native-*` IDs and version-1 `binding.json` files in `~/.zcode-bridge/native-acp`. They use separate databases and logs, require the same canonical workspace on resume, and never attach to Desktop-owned tasks. A missing native history after attempted input causes an error; prompts are never automatically resent.

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --locked
cargo build --release --locked
node --test tests/rust-wire.test.mjs
```

The wire tests use Node 24 and a synthetic engine, without account/model requests. CI is configured to build Windows x64, Linux x64 and macOS ARM64/x64 binaries. A configured CI matrix does not establish native ZCode compatibility on every OS; verify it on the target machine.

Apache-2.0, with the retained MIT account-flow attribution in `NOTICE` and `LICENSES/`.

## Publishing binaries

Set the version in `Cargo.toml`, run `cargo check` to update `Cargo.lock`, commit the source and workflow, then publish a GitHub Release with the matching tag (for example `v0.3.1`). The `release: published` event checks out that tag, runs the matrix checks and attaches the archives and SHA-256 files to the existing release. Stable releases and prereleases are supported; drafts do not trigger builds. Re-running the release workflow replaces its assets without creating another release. Push/PR/manual CI runs build artifacts but do not publish a release.
