# Installation

## Requirements

| Requirement | Version / condition |
| --- | --- |
| BB | 0.49 or newer; plugin SDK compatibility 0.6.132 or newer. |
| Node.js | 24 or newer. CI uses Node 24. |
| ZCode Desktop | Installed and signed in. Windows and macOS installation discovery is implemented. |
| Git | Available on PATH to clone the plugin and its pinned public module dependency. |
| Windows | Windows PowerShell 5.1 for protecting local session directories. |

The CLI path does not require Python, Swift or Accessibility permission. Those belong to the [legacy macOS bridge](./legacy.md).

## 1. Clone and build

Run the following in PowerShell on Windows or a terminal on macOS:

```sh
git clone https://github.com/ichinya/bb-plugin-zcode.git
cd bb-plugin-zcode
npm ci
npm run build:cli
npm run build
```

The module revision is pinned in `package.json` and `package-lock.json`. npm downloads it automatically.

## 2. Install in BB

Start BB, then run from the plugin folder:

```sh
bb plugin install . --yes
node scripts/register-cli-agent.mjs --register
```

Installation adds the single `zcode` plugin, including quota reporting. Registration adds **ZCode CLI** through BB's built-in ACP provider while preserving other custom agents. It does not start a model turn or change the provider of existing threads.

<figure class="screenshot">

![Installed ZCode plugin in BB with version 0.1.0](/screenshots/plugin-installed.png)

<figcaption>The plugin is installed once. The ACP provider is selected separately when starting a chat.</figcaption>
</figure>

## 3. Select a model

Open a new BB thread, open the model picker and select **ZCode CLI**. Choose the required **Coding Plan**, **Start Plan** or API source, then the model and reasoning level. See [configuration](./configuration.md).

## Check readiness

```sh
node bin/zcode-cli-acp.mjs --doctor
```

Doctor checks account access and discovers models. It contacts the account service but sends no model prompt. Do not publish its output without checking it for account information.

## Update an existing installation

```sh
git pull --ff-only
npm ci
npm run build:cli
npm run build
bb plugin reload zcode
node scripts/register-cli-agent.mjs --register
```

Registration stores absolute paths to Node and the module. Run it again after an update or moving the checkout. Keep the checkout available while BB uses this local-path installation.
