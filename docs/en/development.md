# Development and releases

## Verify the plugin

From the repository root:

```sh
npm ci
npm run verify
```

This typechecks, checks generated auth files through the pinned module, builds BB bundles and runs focused CLI/ACP, quota and release-policy tests. Fixtures do not send model requests. `npm test` includes additional tests; the cross-platform CI contract is `npm run verify`.

The `CI` workflow runs on Linux, Windows and macOS with Node 24 and pinned BB CLI 0.49.0. The public module is checked out at the full revision in `package.json`, then npm resolves it from that verified local checkout. No module deploy key is required; fork pull requests can run the same checks.

## Automatic version tags

Update the plugin version and lockfile together:

```sh
npm version 0.1.1 --no-git-tag-version
```

Commit and push to `main`. After all three checks pass, Actions creates `v<version>` for that verified commit. Existing tags never move; reusing a version skips its tag. Stale runs skip tagging. A manual CI run on `main` uses the same rules. Tags do not publish to npm.

## Documentation

Both language trees live in this repository's `docs/en` and `docs/ru`. VitePress tooling has its own manifest and lockfile, so building the website does not install the ACP runtime.

```sh
cd docs
npm ci
npm run dev
```

For a production preview:

```sh
npm run build
npm run check
npm run preview
```

The default website base is `/bb-plugin-zcode/`. Set `DOCS_BASE` before building to host under a different repository path. The build rejects broken Markdown links; the site check verifies language parity, static page links and screenshot assets.

Only the generated `.vitepress/dist` is uploaded. Local verification receipts and old agent skill material are excluded from page discovery. Keep private files outside `docs/public`.

## GitHub Pages setup

The `Documentation` workflow builds on relevant pushes and pull requests. Deployment requires GitHub Pages to be enabled with **GitHub Actions** as its source, and repository variable `PAGES_ENABLED=true`.

This repository and `zcode-acp` are public. The website is published at [ichinya.github.io/bb-plugin-zcode](https://ichinya.github.io/bb-plugin-zcode/). See [GitHub's publishing-source guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) for host configuration.

To recreate Pages configuration in a compatible fork, adapt the repository name and run:

```sh
gh api repos/ichinya/bb-plugin-zcode/pages --method POST -f build_type=workflow
gh variable set PAGES_ENABLED --repo ichinya/bb-plugin-zcode --body true
gh workflow run docs.yml --repo ichinya/bb-plugin-zcode
```

Deployment is serialized through the `github-pages` environment with `pages: write` and `id-token: write`. It publishes the built documentation artifact only.

## Attribution

The plugin builds on [VKirill/bb-plugin-zcode](https://github.com/VKirill/bb-plugin-zcode) under Apache-2.0. The account adapter's MIT attribution and source notices live in the standalone `zcode-acp` module. The integrations are community maintained.
