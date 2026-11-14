# ZCode for BB

Use the models available in your ZCode account from BB. The plugin registers **ZCode CLI**, exposes separate model sources and adds Coding Plan / Start Plan quota rows to BB's standard usage panel.

[Install the plugin →](./installation.md)

## One plugin, separate runtime

| Component | Role |
| --- | --- |
| [`bb-plugin-zcode`](https://github.com/ichinya/bb-plugin-zcode) | BB integration, registration, UI and quota presentation. Package: `bb-plugin-zcode-acp`; installed plugin ID: `zcode-acp`. |
| [`zcode-acp`](https://github.com/ichinya/zcode-acp) | Standalone Rust executable: ACP, Desktop authorization, sessions, models and quotas. Install/update in plugin settings, or select PATH/a custom path. |
| **ZCode CLI** (`acp-zcode-cli`) | The ACP provider to select in a new BB thread. |

The runtime is a separate executable, not a second BB plugin or npm dependency. The adapter automatically uses ZCode's embedded Electron/Node runtime, with no separate Node.js installation required for a recognized bundle.

## Plans stay separate

The model picker identifies the source in each row: **Coding Plan · Z.ai**, **Start Plan · Z.ai**, or the name of a personal API connection. Identical model names from different sources keep distinct IDs and routes.

<figure class="screenshot narrow">

![Real BB model picker showing separate Coding Plan, Start Plan and API sources](/screenshots/model-picker.png)

<figcaption>BB 0.49.0 on Windows. Catalog and reasoning choices depend on the connected account.</figcaption>
</figure>

## What is available

- Text prompts, streamed responses, tool events and permission requests through ACP.
- New, load and close sessions; cancel a running turn.
- Model, mode and reasoning selection from the native catalog.
- Coding Plan and Start Plan quota collection without sending a model prompt.
- A launcher for ZCode's official QR remote-control client.

## Verification and limits

The Rust build and fixture checks have been run locally on Windows. Cross-platform builds are configured in CI; remote results for this rewrite have not yet been established. Native discovery supports Windows and macOS; Linux CI checks the plugin and synthetic runtime only. Windows account/catalog, source selection and quota collection were checked with ZCode Desktop 3.17.2, bundled CLI 0.17.1 and BB 0.49.0. Real inference and macOS native execution have not been qualified here.

Image/audio input, Team Plan, native interactive questions, browser control, custom subagent profiles, fork/rewind and manual compaction are currently unsupported.
