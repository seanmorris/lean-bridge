/**
 * Run installed npm refinement checks in real browser pages, React effects and workers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { startSiteServer } from "../../site/serve.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { browserFrameworkArchives } from "./type-corpus-browser.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";

const repository = resolve(import.meta.dirname, "../..");
const fixtures = join(repository, "tests/fixtures/browser-refinements");
const base = "/corpus/nested/";
const json = async path => JSON.parse(await readFile(path, "utf8"));
/** The browser profiles and the number of result commits each page produces. */
export const browserRefinementProfiles = Object.freeze(["browser-javascript", "browser-react", "browser-worker"]);
/** Checks and rejections every context must report; the counts are pinned so a silent skip is visible. */
export const browserRefinementExpected = Object.freeze({ checks: 130, rejections: 131 });

const source = `namespace OnboardingSmall
abbrev Digit := Fin 10
def mirror (value : Digit) : Digit := ⟨9 - value.val, by omega⟩
def rows (value : Array (Array Digit)) : Array (Array Digit) := value.reverse
def empty (value : Array (Fin 0)) : Array (Fin 0) := value
def huge (value : Array (Fin 184467440737095516170)) : Array (Fin 184467440737095516170) := value
def nested (value : List (Option ((Fin 3) × Except (Fin 2) (Fin 5)))) : List (Option ((Fin 3) × Except (Fin 2) (Fin 5))) := value.reverse
abbrev Small := { value : UInt32 // value < 10 }
def checkedSmall (value : UInt32) : Option Small :=
  if valid : value < 10 then some ⟨value, valid⟩ else none
abbrev Text := { value : String // value != "" }
def checkedText (value : String) : Option Text :=
  if valid : value != "" then some ⟨value, valid⟩ else none
def echo (value : Text) : Text := value
def use (text : Text) (small : Small) (suffix : String) : String := text.val ++ toString small.val ++ suffix
end OnboardingSmall
`;

const ready = async page => {
	await page.locator('#result[data-status="ready"], #result[data-status="error"]').waitFor();
	assert.equal(await page.locator("#result").getAttribute("data-status"), "ready", await page.locator("#result").textContent());
};
const openPage = async (browser, url) => {
	const context = await browser.newContext({ serviceWorkers: "block" });
	const errors = [], foreignRequests = [], assets = [];
	// Nothing outside the static deployment may be fetched.
	await context.route("**/*", async route => {
		if(!route.request().url().startsWith(url))
		{ foreignRequests.push(route.request().url()); await route.abort(); return; }
		await route.continue();
	});
	context.on("response", response => {
		if(response.url().endsWith(".wasm") && response.status() === 200) assets.push(new URL(response.url()).pathname);
	});
	const page = await context.newPage();
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => { if(message.type() === "error") errors.push(message.text()); });
	return { context, page, errors, foreignRequests, assets };
};
const result = page => page.evaluate(() => globalThis.corpusResult);

/**
 * Build, install offline, bundle and run the refinement checks in every browser context.
 *
 * @param t - Node test context.
 * @param options - Shared unlocked author-project build harness.
 * @param options.fixture - Create an isolated author project.
 * @param options.build - Build using compiler-owned metadata.
 * @param options.runtimeRoot - Prepared shared runtime root.
 */
export const checkBrowserRefinementPackages = async (t, { fixture, build, runtimeRoot }) => {
	const requestedEngines = corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS);
	const { directory, root } = await fixture(t);
	await saveLakeFile(root, "OnboardingSmall.lean", source);
	const copy = { ownership: "copy", lifetime: null };
	const refined = constructor => ({ ...copy, refinement: { constructor: `OnboardingSmall.${constructor}` } });
	const exports = ["mirror", "rows", "empty", "huge", "nested", "echo", "use"].map(name => `OnboardingSmall.${name}`);
	const contracts = {
		"OnboardingSmall.echo": { parameters: [refined("checkedText")], result: refined("checkedText") }
		, "OnboardingSmall.use": { parameters: [refined("checkedText"), refined("checkedSmall"), copy] } };
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports, contracts }));
	const moved = join(directory, "moved"), releases = [];
	await cp(root, moved, { recursive: true });
	for(const [index, projectRoot] of [root, moved].entries())
	{
		const before = await lakeInputState(projectRoot), outputRoot = join(directory, `build-${index}`);
		await build(projectRoot, outputRoot).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		const plan = await json(join(outputRoot, "bundle/locks/compiler-adapters.json"));
		assert.equal(plan.exports.find(item => item.sourceDeclaration === "OnboardingSmall.nested").refinements.parameters[0].kind, "list");
		assert.equal(plan.exports.find(item => item.sourceDeclaration === "OnboardingSmall.echo").refinements.parameters[0].kind, "subtype");
		releases.push(await buildComponentNpmPackages({ bundleRoot: join(outputRoot, "bundle"), runtimeRoot, outputRoot: join(directory, `npm-${index}`) }));
		await verifyComponentPackageReceipt({ receiptPath: join(releases[index].output, "component-package-receipt.json") });
		assert.deepEqual(await lakeInputState(projectRoot), before);
	}
	assert.deepEqual(releases[0].report, releases[1].report);
	const archiveSha256 = sha256(await readFile(releases[0].componentArchive));
	assert.equal(archiveSha256, sha256(await readFile(releases[1].componentArchive)));
	const archives = Object.fromEntries(await Promise.all([releases[0].componentArchive, releases[0].runtimeArchive]
		.map(async archive => [archive.split("/").at(-1), sha256(await readFile(archive))])));
	await rename(root, join(directory, "source-unavailable"));
	await rename(moved, join(directory, "moved-unavailable"));
	const executions = [];
	const engines = await import("playwright");
	for(const profile of browserRefinementProfiles)
	{
		const consumer = join(directory, profile); await mkdir(consumer);
		await saveLakeFile(consumer, "package.json", '{"private":true,"type":"module"}');
		const framework = profile === "browser-react" ? await browserFrameworkArchives(consumer) : [];
		const archives = [releases[0].runtimeArchive, releases[0].componentArchive, ...framework.map(item => join(consumer, item.archive))];
		const flags = ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(directory, "npm-cache")];
		await processBuildRunner.capture({ command: "npm", args: [...flags, ...archives], cwd: consumer, timeoutMs: 300_000 });
		for(const name of await readdir(fixtures)) await saveLakeFile(consumer, name, await readFile(join(fixtures, name)));
		await saveLakeFile(consumer, "request.json", canonicalJson({ module: "onboarding-small", profile }));
		await saveLakeFile(consumer, "package.mjs", 'import request from "./request.json";\nexport { request };\n// The public API and the package-internal runtime, which skips the generated JavaScript validation.\nexport const loadApi = async () => {\n\tconst [api, { runtime }] = await Promise.all([import("onboarding-small"), import("./node_modules/onboarding-small/internal/runtime.mjs")]);\n\treturn { ...api, raw: (name, args) => runtime.call("lean:OnboardingSmall." + name, args) };\n};\n');
		const entry = { "browser-javascript": "plain", "browser-react": "react", "browser-worker": "worker-main" }[profile];
		await saveLakeFile(consumer, "index.html", `<!doctype html><meta charset="utf-8"><title>Installed refinements</title><div id="root"><button id="rerun">Run again</button><button id="stop">Stop worker</button><pre id="result" data-status="loading"></pre></div><script type="module" src="./${entry}.mjs"></script>\n`);
		const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
		const deployments = [];
		for(const variant of variants)
		{
			const output = await processBuildRunner.capture({ command: process.execPath, args: [join(repository, "tests/helpers/type-corpus-browser-build.mjs"), consumer, variant], cwd: consumer, timeoutMs: 120_000 });
			deployments.push(JSON.parse(output.stdout));
		}
		// Only the static deployments survive: no sources, unpacked installation or bundler remain.
		for(const name of await readdir(consumer)) if(!variants.some(variant => name === `dist-${variant}`)) await rm(join(consumer, name), { recursive: true, force: true });
		for(const engine of requestedEngines)
		{
			const browser = await engines[engine].launch({ headless: true, ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}) });
			try
			{
				for(const variant of variants)
				{
					const server = await startSiteServer({ root: join(consumer, `dist-${variant}`), base });
					const state = await openPage(browser, server.url);
					try
					{
						await state.page.goto(server.url);
						await ready(state.page);
						const first = await result(state.page);
						assert.deepEqual({ checks: first.results.checks, rejections: first.results.rejections }, browserRefinementExpected, `${profile} ${engine} ${variant}`);
						assert.equal(first.results.module, "onboarding-small");
						assert.equal(first.module, "onboarding-small");
						assert.equal(first.realm, profile === "browser-worker" ? "dedicated-worker" : "window");
						let lifecycle;
						if(profile === "browser-react")
						{
							// Unmount and remount twice; retired effects must never commit a stale result.
							for(let index = 0; index < 2; index++)
							{
								await state.page.locator("#toggle").click();
								assert.equal(await state.page.locator("#result").count(), 0);
								await state.page.locator("#toggle").click();
								await ready(state.page);
								assert.deepEqual(await result(state.page), first);
							}
							lifecycle = await state.page.evaluate(() => globalThis.corpusLifecycle);
							assert.deepEqual(lifecycle, variant === "strict" ? { effects: 6, cleanups: 5, ignored: 3, commits: 3 } : { effects: 3, cleanups: 2, ignored: 0, commits: 3 });
						}
						else
						{
							const before = await state.page.locator("#result").textContent();
							await state.page.locator("#rerun").click();
							await state.page.waitForFunction(previous => globalThis.document.querySelector("#result").textContent !== previous, before);
							await ready(state.page);
							assert.deepEqual(await result(state.page), first);
						}
						assert.deepEqual(state.errors, []);
						assert.deepEqual(state.foreignRequests, []);
						assert.ok(state.assets.some(path => path.endsWith(".wasm")), "the component WebAssembly was served from the deployment");
						executions.push({ profile, engine, hostVersion: browser.version(), variant, result: first, ...(lifecycle ? { lifecycle } : {}), wasmAssets: [...new Set(state.assets)].sort() });
					}
					finally
					{ await state.context.close(); await server.close(); }
				}
			}
			finally
			{ await browser.close(); }
		}
		executions.push({ profile, deployments: deployments.map(item => ({ variant: item.variant, viteVersion: item.viteVersion, sha256: item.sha256 })) });
	}
	t.diagnostic(`Browser refinement archive SHA-256: ${archiveSha256}`);
	return { archiveSha256, archives, requestedEngines, executions, expected: browserRefinementExpected, installedSourcesRemoved: true, externalNetworkBlocked: true };
};
