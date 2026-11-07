# Documentation tooling

English pages: [`en/`](en/index.md). Русские страницы: [`ru/`](ru/index.md).

Run from this directory: `npm ci`, `npm run dev`; production: `npm run build`,
`npm run check`, `npm run preview`. See the development guide in either language
for GitHub Pages configuration. Build tooling has an independent lockfile and
does not install the ACP runtime.

Only `.vitepress/dist` is published. `verification/`, `skill/`, this file and the
old compatibility documents are excluded from page discovery. `public/` is
copied verbatim: never place machine-local data there.

Screenshot provenance (7 November 2026):

- `model-picker.png`: a cropped capture of BB 0.49.0's real model picker, showing
  Coding Plan, Start Plan and API connection labels. No prompt was submitted.
- `plugin-installed.png`: a cropped capture of the installed local plugin's
  details, including version 0.1.0.
- `legacy-settings.png`: a cropped capture of the legacy GUI provider form;
  no settings were changed.
- `plan-quotas.png`: the user's supplied quota-panel screenshot, copied as-is.

Crops exclude conversation history, account identifiers and unrelated sidebar
content. The documented project folder in the plugin details is a local-path
installation example. Screenshot values are historical observations.
