# Publish the documentation and demos

The Pages workflow deploys `build/github-pages/`. That directory contains prerendered documentation, the algorithm workbenches, their Lean sources, compiled browser runtimes, and proof receipts. It does not contain a registry release candidate or registry credentials.

## Build for the deployment path

Use Node 22.23.2 to match the Pages workflow. The site scripts require Node 22.22.0 or newer. Run commands from the repository root.

```sh
npm ci --ignore-scripts
export LEAN_BRIDGE_SITE_BASE=/lean-bridge/
npm run site:typecheck
npm run site:test
npm run bootstrap
npm run test:docs
npm run test:docs:proof
npm run demos:verify
git diff --exit-code -- demos
npm run demos:site
```

The base path must match the deployed URL. `/lean-bridge/` is the checked-in project-site setting. Use `/` for a domain-root deployment, or the actual repository path for another project site. Set the value before building, then test that same artifact.

`test:docs:proof` checks the tutorial theorem with the pinned Lean compiler, confirms that it has no axioms, and rejects both a changed implementation and a `sorry` proof. It does not build a package or modify the tutorial fixture.

`demos:verify` rebuilds the Lean demos, runs their runtime tests and benchmark assertions, and assembles the site. The diff check catches generated demo files that no longer match the committed sources. Inspect and review those changes; do not discard them to make the check pass. The final `demos:site` command rebuilds the documentation and assembles the deployment directory without recompiling Lean.

Builds write generated directories and may download toolchains or dependencies. They do not deploy to Pages. The assembler stages a complete artifact before replacing the previous `build/github-pages/` directory.

## Preview the exact artifact

Serve the assembled directory with its recorded base path:

```sh
node --input-type=module <<'JS'
import { readFile } from 'node:fs/promises';
import { startSiteServer } from './site/serve.mjs';
const identity = JSON.parse(await readFile('build/github-pages/build-identity.json', 'utf8'));
const server = await startSiteServer({
  root: 'build/github-pages',
  base: identity.siteBase
});
console.log(server.url);
JS
```

Open the printed loopback URL. Stop the preview with Ctrl+C. This serves the built files with the correct JavaScript, Lean, and Wasm content types. It also serves the built 404 page for missing routes.

`npm run site:dev` starts the development server instead. Use it while editing; use the static preview and browser checks to verify the deployable artifact.

## Run the browser checks

Install the browsers and run both suites against the assembled output:

```sh
npx playwright install --with-deps chromium firefox webkit
DEMO_BROWSERS=chromium,firefox,webkit npm run demos:browser
SITE_BROWSERS=chromium,firefox,webkit npm run site:browser
```

The first suite checks the algorithm pages, live runtimes, proof controls, layouts, and benchmark lifecycle. The second checks the documentation shell, routes, search, links, mobile reading layouts, and React workbench lifecycle. Reports and screenshots go under `build/demo-browser-audit/`, `build/react-site-audit/`, and `build/documentation-site-audit/`.

Inspect `build/github-pages/build-identity.json` for the source revision, base path, route map, and recorded file hashes. Keep it with the workflow logs when investigating a deployment. It is an unsigned artifact inventory; the workflow run identifies who built and deployed it.

## Preserve the checked artifact

After reviewing and committing the source changes, rebuild and check that revision. Package the checked directory without rebuilding it again:

```sh
npm run demos:archive
```

The command requires a clean source identity matching `HEAD`. It checks every recorded file, rejects missing or extra files and symbolic links, and creates `build/pages-artifact/artifact.tar`. The companion `pages-artifact.json` records the revision, deployment base, file count, build-identity hash, and archive hash. Existing output directories are rejected. Use `-- --output build/another-pages-artifact` to retain a separate handoff.

The tar contains the exact inventory, including `.nojekyll` and React navigation-data files. The pinned `upload-pages-artifact@v4` action excludes hidden files, so this workflow uploads our checked tar with `upload-artifact@v4` instead. This uses the same single-tar transport as the [pinned Pages upload action](https://github.com/actions/upload-pages-artifact/blob/v4/action.yml).

## Review the deployment workflow

The [Pages workflow](../../.github/workflows/demos-pages.yml) runs on pull requests, pushes to `master`, and manual dispatches. Its build job installs dependencies, checks TypeScript and tests, rebuilds the demos, rejects stale generated files, assembles the site, and runs all three browser engines.

Pull requests run the checks, package the site locally, and upload audit reports, but do not upload or deploy a Pages artifact. Non-pull-request runs upload the checked tar as `github-pages`, then a separate job deploys it to the `github-pages` environment. A manual dispatch can select a ref, so review that ref before starting a deployment.

Configure the repository's Pages publishing source as GitHub Actions and apply the intended protection rules to the `github-pages` environment, following [GitHub's custom-workflow setup](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). The deployment job requests `pages: write` and `id-token: write`; the build job has read-only repository contents access. The workflow reports the deployed page URL after completion.

If a check fails, inspect the uploaded audit artifacts and fix the source or generated output. Do not publish a different locally assembled directory to bypass the failed run.

## Retain a rollback

The workflow retains `github-pages` and `demo-browser-audit` for 30 days. Before replacing a live site, download the previous successful run's artifacts and record its run ID, source revision, archive hash, and deployed build identity. Keep that backup separately from the new candidate. A rebuild of an old commit is a new artifact and needs its own checks.

For an approved rollback within the retained run's lifetime, re-run only its `deploy` job, which consumes that run's existing `github-pages` artifact. Do not re-run its build job. Confirm the restored site's `build-identity.json` and runtime hashes against the retained record. GitHub documents [re-running a specific job](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs#re-running-a-specific-job); expired artifacts require a separately reviewed restore or rebuild.

For a first deployment, record that no previous live artifact exists. A locally tested fallback can be retained, but it must not be described as the previously deployed site. Deployment and rollback both require operator approval.

## Keep website and package authority separate

The Pages workflow publishes documentation and runnable examples. It does not execute the npm publisher, obtain `NPM_TOKEN`, or satisfy the [production package-release approvals](../publish/production-release.md).

Changes to routes and Markdown require a site rebuild. Changes to Lean sources require the proof-checking demo build before assembly. The assembler checks the copied source hashes against each demo's proof receipt and rejects a mismatch.
