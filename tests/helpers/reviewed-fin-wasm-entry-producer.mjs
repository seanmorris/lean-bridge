/**
 * Installed adapter and Lean source entry of the ordinary and reviewed Fin npm corpus (VO #1438). An original
 * package is the unmodified build, observed only at its adapter frames; a probe package is the separately built
 * instrumented source, observed at its adapter frames, including the unrefined control, and at its Lean source.
 * Each mode builds twice, erases its producers, verifies its receipt, installs offline without compilers and runs
 * the measured corpus in Node JavaScript, strict TypeScript and, on request, every browser context and engine.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";
import { installReviewedFinWasm } from "./reviewed-fin-wasm-install.mjs";
import { reviewedFinBrowserProfiles } from "./reviewed-fin-wasm-browser.mjs";
import { reviewedFinWasmTypeScript } from "./reviewed-fin-wasm-typescript.mjs";
import { installedBrowserCorpus, browserFrameworkArchives } from "./type-corpus-browser.mjs";
import { accountReviewedFinWasmEntry, expectReviewedFinWasmEntry, reviewedFinWasmEntryIr, reviewedFinWasmEntrySelection } from "./reviewed-fin-wasm-entry.mjs";
import { instrumentReviewedFinWasmLean, reviewedFinWasmSourceControls, reviewedFinWasmSourceInstrumentation } from "./reviewed-fin-wasm-source-entry.mjs";

const repository = resolve(import.meta.dirname, "../..");
const fixture = join(repository, "tests/fixtures/onboarding/reviewed-fin-wasm");
const clean = { PATH: "/unavailable", CC: "/unavailable/compiler", CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN: "/unavailable/lean", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: "" };
const run = (command, args, cwd, env = clean) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });
// Consumer files, each the exact repository bytes: the unchanged corpus, the measured recorder and the observer.
const corpusFiles = Object.freeze({
	"corpus/javascript.mjs": "tests/fixtures/reviewed-fin-wasm/javascript.mjs"
	, "corpus/javascript-entry.mjs": "tests/fixtures/reviewed-fin-wasm/javascript-entry.mjs"
	, "corpus/entry-observation.mjs": "tests/fixtures/reviewed-fin-wasm/entry-observation.mjs"
	, "corpus/wasm-frame-entry-observer.mjs": "tests/helpers/wasm-frame-entry-observer.mjs"
});
const measuredCorpus = "import { measuredRun } from \"./corpus/entry-observation.mjs\";\nexport const executeCorpus = measuredRun;\n";
const loadPackage = `const [api, { runtime }] = await Promise.all([import("reviewed-fin"), import("./node_modules/reviewed-fin/internal/runtime.mjs")]);
    await finishEntryObservation();
    return { ...api, raw: (name, args) => runtime.call("lean:ReviewedFin." + name, args) };`;
/**
 * The package loader of one context. Node starts observing in a preload, before any module evaluates; a page or
 * worker starts once per realm in its first load, after authenticating the side-module bytes it fetches.
 *
 * @param request - The run request, with its mode and controls.
 * @param node - Whether the consumer runs in Node.
 */
const packageModule = (request, node) => (node ? `import { finishEntryObservation } from "./corpus/entry-observation.mjs";
export const request = ${JSON.stringify(request)};
let loading = null;
export const loadApi = () => loading ??= (async () => {
    ${loadPackage}
})();
` : `import { finishEntryObservation, startEntryObservation } from "./corpus/entry-observation.mjs";
import descriptor from "./node_modules/reviewed-fin/internal/descriptor.mjs";
import selection from "./selection.json";
export const request = ${JSON.stringify(request)};
const hex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
let loading = null;
export const loadApi = () => loading ??= (async () => {
    const moduleBytes = new Uint8Array(await (await fetch(descriptor.sideModule)).arrayBuffer());
    if (hex(await crypto.subtle.digest("SHA-256", moduleBytes)) !== selection.integrity) throw new Error("side-module bytes are not the selected component");
    startEntryObservation({ mode: selection.mode, moduleBytes, symbols: selection.symbols });
    ${loadPackage}
})();
`);
const preload = `import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { startEntryObservation } from "./corpus/entry-observation.mjs";
const selection = JSON.parse(await readFile(new URL("./selection.json", import.meta.url), "utf8"));
const moduleBytes = await readFile(new URL(selection.sideModule, import.meta.url));
if (createHash("sha256").update(moduleBytes).digest("hex") !== selection.integrity) throw new Error("side-module bytes are not the selected component");
startEntryObservation({ mode: selection.mode, moduleBytes, symbols: selection.symbols });
`;

/**
 * Authenticate an installed package against its mode before any observation, and bind the expectation to its
 * shipped public code: the generated wrappers and validators are exactly those of the expected contract.
 *
 * @param root - Consumer root with the package installed.
 * @param selection - Scalar-only or structural corpus.
 * @param mode - Mode: original or probe.
 */
export const authenticateReviewedFinWasmEntryPackage = async (root, selection, mode) => {
	const installed = join(root, "node_modules/reviewed-fin");
	const { default: descriptor } = await import(pathToFileURL(join(installed, "internal/descriptor.mjs")));
	const sideModule = fileURLToPath(descriptor.sideModule);
	assert.ok(sideModule.startsWith(`${installed}/internal/wasm/`), "the side module belongs to the installed package");
	const bytes = await readFile(sideModule);
	const { symbols } = reviewedFinWasmEntrySelection({ descriptor, bytes, selection, mode });
	for(const generated of [generateJavaScriptPackage(descriptor.bindingIr), generateJavaScriptPackage(reviewedFinWasmEntryIr(selection, mode))])
		for(const path of ["index.mjs", "internal/validators.mjs"])
			assert.equal(await readFile(join(installed, path), "utf8"), generated[path], `${mode} ${path} is the generated public code`);
	return { integrity: descriptor.integrity, symbols, sideModule: `./${sideModule.slice(root.length + 1)}` };
};

export const reviewedFinWasmEntryNodeIndex = "import { executeCorpus } from \"./javascript.mjs\";\nimport { request, loadApi } from \"./package.mjs\";\nconsole.log(JSON.stringify(executeCorpus(request, await loadApi())));\n";

/**
 * Run one prepared Node consumer. The preload observes before any consumer or package module evaluates, so a
 * static package import, as in the strict TypeScript consumer, is observed too.
 *
 * @param root - Prepared consumer root.
 * @param entry - Consumer entry relative to the root.
 */
export const runReviewedFinWasmEntryNode = async (root, entry) => JSON.parse((await run(process.execPath, ["--import", "./entry-preload.mjs", entry], root)).stdout);

/**
 * Replace the consumer-owned corpus files with the measured run, after authentication. Nothing in the installed
 * package changes.
 *
 * @param root - Consumer root with the package installed and authenticated.
 * @param options - Run request and authenticated selection.
 * @param options.request - Package, selection, mode and the probe's control values.
 * @param options.selection - Authenticated integrity, symbols and side-module path.
 * @param options.node - Whether the consumer runs in Node.
 */
export const prepareReviewedFinWasmEntryConsumer = async (root, { request, selection, node }) => {
	const files = {};
	for(const [path, source] of Object.entries(corpusFiles))
	{
		const bytes = await readFile(join(repository, source));
		await saveLakeFile(root, path, bytes);
		files[path] = sha256(bytes);
	}
	for(const [path, text] of [["javascript.mjs", measuredCorpus], ["package.mjs", packageModule(request, node)], ["selection.json", canonicalJson({ mode: request.mode, ...selection })], ...node ? [["entry-preload.mjs", preload]] : []])
	{
		await writeFile(join(root, path), text);
		files[path] = sha256(text);
	}
	return files;
};

const configuration = (selection, reviewed, mode) => ({
	schemaVersion: 1
	, modules: ["ReviewedFin"]
	, ...reviewed ? {} : { exports: reviewedFinWasmEntryIr(selection, mode).declarations.map(item => item.source.declaration) }
	, targets: { npm: { name: "reviewed-fin", version: "1.0.0" } } });

/**
 * Two independent builds of one route and mode, compared byte for byte, then a verified source-free handoff.
 *
 * @param t - Test context.
 * @param directory - Disposable root.
 * @param selection - Scalar-only or structural corpus.
 * @param reviewed - Independent review rather than ordinary source selection.
 * @param mode - Mode: original or probe.
 */
const handoff = async (t, directory, selection, reviewed, mode) => {
	const producers = join(directory, "producers"), project = join(producers, "project"), relocated = join(producers, "relocated");
	await cp(fixture, project, { recursive: true });
	if(mode === "probe") await writeFile(join(project, "ReviewedFin.lean"), instrumentReviewedFinWasmLean(await readFile(join(fixture, "ReviewedFin.lean"), "utf8")));
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(configuration(selection, reviewed, mode)));
	if(reviewed) await saveLakeFile(project, "api.binding-ir.json", canonicalJson(reviewedFinWasmEntryIr(selection, mode)));
	await cp(project, relocated, { recursive: true });
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const releases = [];
	for(const [index, projectRoot] of [project, relocated].entries())
	{
		t.diagnostic(`${mode} ${reviewed ? "reviewed" : "ordinary"} ${selection}: WASM and npm build ${index + 1}/2`);
		const before = await lakeInputState(projectRoot), outputRoot = join(producers, `build-${index}`);
		await buildCanonicalProject({ projectRoot, outputRoot, engineRoot: repository, targets: ["npm"], environment: { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix" }, runner: refinementEngineTransport() });
		const bundleRoot = join(outputRoot, "bundle");
		assert.equal(reviewedContractDifference(reviewedFinWasmEntryIr(selection, mode), JSON.parse(await readFile(join(bundleRoot, "binding/binding-ir.json")))), null, "the compiled contract is the mode's");
		const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(producers, `npm-${index}`) });
		await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		releases.push(release);
	}
	assert.deepEqual(releases[0].report, releases[1].report);
	for(const key of ["componentArchive", "runtimeArchive"]) assert.deepEqual(await readFile(releases[0][key]), await readFile(releases[1][key]));
	const receipt = releases[0].report, output = join(directory, "handoff");
	await mkdir(output);
	for(const name of [receipt.package.archive, receipt.runtime.archive, "component-package-receipt.json", "verify-component-package-receipt.mjs"]) await cp(join(releases[0].output, name), join(output, name));
	await rm(producers, { recursive: true, force: true });
	await assert.rejects(lstat(producers), { code: "ENOENT" });
	await run(process.execPath, [join(repository, "scripts/lean-bridge.mjs"), "verify", "--receipt", join(output, "component-package-receipt.json"), "--json"], directory);
	return { handoff: output, receipt, receiptSha256: sha256(await readFile(join(output, "component-package-receipt.json"))) };
};

/**
 * Account one context's report against the exact expectation, requiring the mode's complete result.
 * Only a report carrying its own mode, calls and, for a probe, its own source lines is accepted.
 *
 * @param expected - Expectation of the selection and mode.
 * @param report - The consumer's measured run.
 */
export const accountReviewedFinWasmEntryReport = (expected, report) => {
	const { entry, ...result } = report;
	const accounted = accountReviewedFinWasmEntry(expected, { mode: entry.mode, result, calls: entry.calls }, entry.lines);
	assert.deepEqual([accounted.mode, accounted.source, accounted.calls], [expected.mode, expected.mode === "probe", expected.calls.length]);
	return accounted;
};

/**
 * Build, install and measure one selection, route and mode.
 *
 * @param t - Test context responsible for cleanup.
 * @param selection - Scalar-only or structural corpus.
 * @param reviewed - Independent review rather than ordinary source selection.
 * @param mode - Mode: original or probe.
 * @param options - Browser contexts and engines in addition to Node.
 * @param options.browsers - Run every browser context.
 */
export const checkReviewedFinWasmEntry = async (t, selection, reviewed, mode, { browsers = false } = {}) => {
	const expected = await expectReviewedFinWasmEntry(selection, mode);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-fin-wasm-entry-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const built = await handoff(t, directory, selection, reviewed, mode);
	const request = { module: "reviewed-fin", selection, mode, ...mode === "probe" ? { controls: reviewedFinWasmSourceControls.map(([name, values]) => [name, values.map(String)]) } : {} };
	const contexts = [];
	const consumer = join(directory, "consumer");
	await installReviewedFinWasm(consumer, built.handoff, built.receipt, selection);
	const authenticated = await authenticateReviewedFinWasmEntryPackage(consumer, selection, mode);
	const consumerFiles = await prepareReviewedFinWasmEntryConsumer(consumer, { request, selection: authenticated, node: true });
	await saveLakeFile(consumer, "index.mjs", reviewedFinWasmEntryNodeIndex);
	const source = reviewedFinWasmTypeScript(selection);
	await saveLakeFile(consumer, "index.ts", source);
	await saveLakeFile(consumer, "tsconfig.json", canonicalJson({ compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", lib: ["ES2022", "DOM", "ESNext.Disposable"], strict: true, skipLibCheck: false, noEmitOnError: true, allowJs: true, checkJs: false, types: [], outDir: "dist" }, include: ["index.ts", "javascript.mjs", "package.mjs"] }));
	await run(process.execPath, [join(repository, "node_modules/typescript/lib/tsc.js"), "--project", "tsconfig.json"], consumer);
	await symlink(join(consumer, "node_modules"), join(consumer, "dist/node_modules"));
	for(const [profile, entry] of [["node-javascript", "index.mjs"], ["node-typescript", "dist/index.js"]])
	{
		const report = await runReviewedFinWasmEntryNode(consumer, entry);
		contexts.push({ profile, hostVersion: process.version, ...accountReviewedFinWasmEntryReport(expected, report) });
	}
	if(browsers) for(const profile of reviewedFinBrowserProfiles)
	{
		const root = join(directory, profile), framework = profile === "browser-react" ? await browserFrameworkArchives(root) : [];
		await installReviewedFinWasm(root, built.handoff, built.receipt, selection, { profile, framework });
		const selected = await authenticateReviewedFinWasmEntryPackage(root, selection, mode);
		const realm = profile === "browser-worker" ? "dedicated-worker" : "window";
		await prepareReviewedFinWasmEntryConsumer(root, { request: { ...request, profile }, selection: selected, node: false });
		const accounted = [];
		// Every page or worker observation, including reruns and React remounts, is accounted in full.
		const validateObservation = observation => {
			assert.deepEqual([observation.schemaVersion, observation.profile, observation.module, observation.realm], [1, profile, "reviewed-fin", realm]);
			accounted.push(accountReviewedFinWasmEntryReport(expected, observation.results));
		};
		const packageSource = await readFile(join(root, "package.mjs"), "utf8");
		const result = await installedBrowserCorpus({
			library: { npmModule: "reviewed-fin" }
			, profile
			, root
			, framework
			, environment: { ...clean, PATH: join(root, "bin") }
			, consumer: { packageSource, validateObservation }
		});
		assert.ok(accounted.length > 0, `${profile} measured at least one run`);
		contexts.push({ profile, runs: accounted.length, engines: result.browser.requestedEngines, ...accounted[0] });
	}
	return {
		schemaVersion: 1
		, path: reviewed ? "reviewed-ir" : "ordinary-source"
		, selection
		, mode
		, ...mode === "probe" ? { instrumentation: reviewedFinWasmSourceInstrumentation } : {}
		, receiptSha256: built.receiptSha256
		, independentBuilds: 2
		, reproducible: true
		, sourceRemovedBeforeInstallation: true
		, compilerFreePath: true
		, offlineInstall: true
		, componentIntegrity: authenticated.integrity
		, symbols: authenticated.symbols
		, consumerFiles
		, typescriptSha256: sha256(source)
		, calls: expected.calls.length
		, contexts
	};
};
