# ZCode for BB

Use the models available in your ZCode account from BB. The plugin registers **ZCode CLI**, exposes separate model sources and adds Coding Plan / Start Plan quota rows to BB's standard usage panel.

[Install the plugin →](./installation.md)

## One plugin, separate runtime

| Component | Role |
| --- | --- |
| `bb-plugin-zcode` | BB integration, registration, UI and quota presentation. Installed plugin ID: `zcode`. |
| [`zcode-acp`](https://github.com/ichinya/zcode-acp) | Standalone Node.js adapter: ACP transport, Desktop authorization, native sessions, model catalog and quota collection. Installed as a pinned dependency. |
| **ZCode CLI** (`acp-zcode-cli`) | The ACP provider to select in a new BB thread. |

A sibling checkout of `zcode-acp` is unnecessary. The module is an npm dependency, not a second BB plugin.

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

Build and fixture checks pass on Windows, Linux and macOS. Native discovery supports Windows and macOS; Linux CI checks the plugin and synthetic runtime only. Windows account/catalog, source selection and quota collection were checked with ZCode Desktop 3.17.2, bundled CLI 0.17.1 and BB 0.49.0. Real inference and macOS native execution have not been qualified here.

Image/audio input, Team Plan, native interactive questions, browser control, custom subagent profiles, fork/rewind and manual compaction are currently unsupported.
