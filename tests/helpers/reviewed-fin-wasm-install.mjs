/**
 * Reproduce ordinary and independently reviewed Fin releases, then consume only archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference, validateReviewedSource } from "../../src/analyze/reviewed-source.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";
import { reviewedFinWasmIr, reviewedFinWasmSelections } from "./reviewed-fin-wasm-fixture.mjs";
import { reviewedFinWasmTypeScript } from "./reviewed-fin-wasm-typescript.mjs";
import { reviewedFinWasmMismatches } from "./reviewed-fin-wasm-mismatches.mjs";

const repository = resolve(import.meta.dirname, "../..");
const fixture = join(repository, "tests/fixtures/onboarding/reviewed-fin-wasm");
const json = async path => JSON.parse(await readFile(path, "utf8"));
const clean = {
	PATH: "/unavailable"
	, CC: "/unavailable/compiler"
	, CXX: "/unavailable/compiler"
	, LEAN_BRIDGE_LEAN: "/unavailable/lean"
	, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime"
	, NODE_PATH: "" };
const run = (command, args, cwd, env = clean) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });
/** Exact shared-consumer counts, including direct runtime calls and recovery. */
export const reviewedFinWasmExpected = Object.freeze({
	scalar: Object.freeze({ checks: 50, rejections: 126 })
	, structural: Object.freeze({ checks: 200, rejections: 270 })
});
const configuration = (selection, reviewed) => ({
	schemaVersion: 1
	, modules: ["ReviewedFin"]
	, ...reviewed ? {} : { exports: reviewedFinWasmIr(selection).declarations.map(item => item.source.declaration) }
	, targets: { npm: { name: "reviewed-fin", version: "1.0.0" } } });
const build = (projectRoot, outputRoot, runtimeRoot) => buildCanonicalProject({
	projectRoot, outputRoot, engineRoot: repository, targets: ["npm"]
	, environment: { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot }
	, runner: refinementEngineTransport()
});

/**
 * Validate only compiler-derived metadata, independent contracts and actual archive bytes.
 *
 * @param bundle - Compiled component output.
 * @param selection - Independent expected contract selection.
 * @param reviewed - Whether the contract was also a compiler input.
 */
export const reviewedFinWasmBuildFacts = async (bundle, selection, reviewed) => {
	const irBytes = await readFile(join(bundle, "binding/binding-ir.json")), ir = JSON.parse(irBytes);
	const metadataBytes = await readFile(join(bundle, "metadata/lake-entry-exports.json"));
	const metadata = JSON.parse(metadataBytes), expected = reviewedFinWasmIr(selection);
	assert.equal(reviewedContractDifference(expected, ir), null);
	const plan = await json(join(bundle, "locks/compiler-adapters.json"));
	assert.equal(plan.privateAbi.version, selection === "scalar" ? 2 : 6);
	const refinements = Object.fromEntries(expected.declarations.map(item => [item.source.declaration, item.source.extensions["lean-lang.org/refinements"]]));
	assert.deepEqual(Object.fromEntries(plan.exports.map(item => [item.sourceDeclaration, item.refinements])), refinements);
	if(reviewed)
	{
		assert.deepEqual(validateReviewedSource(metadata.reviewedBindingIr), expected);
		assert.equal(metadata.reviewedBindingIr.source, canonicalJson(expected));
		assert.equal(metadata.reviewedBindingIr.sourceSha256, sha256(canonicalJson(expected)));
	}
	else assert.equal(Object.hasOwn(metadata, "reviewedBindingIr"), false);
	const sourceSha256 = sha256(await readFile(join(fixture, "ReviewedFin.lean")));
	assert.equal(metadata.metadata.modules.find(item => item.name === "ReviewedFin")?.sourceSha256, sourceSha256);
	return {
		bindingIrSha256: hashBindingIr(ir)
		, metadataSha256: sha256(metadataBytes)
		, sourceSha256
		, compilerSha256: metadata.leanCompilerSha256
		, privateAbi: plan.privateAbi.version
		, refinements, ...reviewed ? { reviewedSourceSha256: metadata.reviewedBindingIr.sourceSha256 } : {} };
};

/**
 * Install under a compiler-free PATH, with an empty npm cache and no registry access.
 *
 * @param root - Fresh consumer root.
 * @param handoff - Prepared component and shared-runtime archives.
 * @param receipt - Verified package receipt.
 * @param selection - Scalar-only or structural corpus.
 */
export const installReviewedFinWasm = async (root, handoff, receipt, selection) => {
	const bin = join(root, "bin");
	await mkdir(bin, { recursive: true });
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(root, "package.json", canonicalJson({ private: true, type: "module" }));
	await saveLakeFile(root, "user.npmrc", "");
	await saveLakeFile(root, "global.npmrc", "");
	const npm = await realpath(join(process.execPath, "../../bin/npm"));
	await run(process.execPath, [
		npm, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"
		, "--userconfig"
		, join(root, "user.npmrc")
		, "--globalconfig"
		, join(root, "global.npmrc")
		, "--cache"
		, join(root, "empty-cache")
		, join(handoff, receipt.runtime.archive)
		, join(handoff, receipt.package.archive)], root, { ...clean, PATH: bin });
	const request = { module: "reviewed-fin", selection };
	await saveLakeFile(root, "request.json", canonicalJson(request));
	await saveLakeFile(root, "javascript.mjs", await readFile(join(repository, "tests/fixtures/reviewed-fin-wasm/javascript.mjs")));
	await saveLakeFile(root, "package.mjs", `export const request = ${JSON.stringify(request)};
export const loadApi = async () => {
  const [api, { runtime }] = await Promise.all([import("reviewed-fin"), import("./node_modules/reviewed-fin/internal/runtime.mjs")]);
  return { ...api, raw: (name, args) => runtime.call("lean:ReviewedFin." + name, args) };
};
`);
};

const installedNode = async (root, selection) => {
	await saveLakeFile(root, "index.mjs", 'import { executeCorpus } from "./javascript.mjs";\nimport { request, loadApi } from "./package.mjs";\nconsole.log(JSON.stringify(executeCorpus(request, await loadApi())));\n');
	const source = reviewedFinWasmTypeScript(selection);
	await saveLakeFile(root, "index.ts", source);
	await saveLakeFile(root, "tsconfig.json", canonicalJson({ compilerOptions: {
		target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext"
		, lib: ["ES2022", "DOM", "ESNext.Disposable"]
		, strict: true
		, skipLibCheck: false
		, noEmitOnError: true
		, allowJs: true
		, checkJs: false
		, types: []
		, outDir: "dist"
	}
	, include: ["index.ts", "javascript.mjs", "package.mjs"] }));
	const compiler = join(repository, "node_modules/typescript/lib/tsc.js");
	await run(process.execPath, [compiler, "--project", "tsconfig.json"], root);
	// Keep the real installed package at the same relative path for emitted JS.
	await symlink(join(root, "node_modules"), join(root, "dist/node_modules"));
	const declarations = await readFile(join(root, "node_modules/reviewed-fin/index.d.ts"));
	assert.doesNotMatch(declarations.toString(), /\bany\b/u);
	const executions = [];
	for(const [profile, entry] of [["node-javascript", "index.mjs"], ["node-typescript", "dist/index.js"]])
	{
		const result = JSON.parse((await run(process.execPath, [entry], root)).stdout);
		assert.deepEqual(result, { module: "reviewed-fin", selection, ...reviewedFinWasmExpected[selection] });
		executions.push({ profile, hostVersion: process.version, result });
	}
	return { executions
		, typescript: {
			strict: true, skipLibCheck: false, sourceSha256: sha256(source)
			, declarationsSha256: sha256(declarations)
			, compilerSha256: sha256(await readFile(join(repository, "node_modules/typescript/lib/_tsc.js"))) } };
};

const checkMismatches = async (t, producers, runtimeRoot) => {
	const observations = [];
	for(const [index, { label, ir }] of reviewedFinWasmMismatches().entries())
	{
		t.diagnostic(`fresh Lean reconciliation: ${label}`);
		const projectRoot = join(producers, `mismatch-${index}`), outputRoot = join(producers, `rejected-${index}`);
		await cp(fixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration("structural", true)));
		const source = canonicalJson(ir);
		await saveLakeFile(projectRoot, "api.binding-ir.json", source);
		await assert.rejects(build(projectRoot, outputRoot, runtimeRoot), error => {
			assert.equal(error.code, "reviewed-ir-source-mismatch", label);
			assert.equal(error.message, "Reviewed contract does not match the freshly compiled Lean API", label);
			// Local transport preserves the field; the locked process envelope intentionally omits it.
			if(error.details.field) assert.match(error.details.field, /source\.extensions\.lean-lang\.org\/refinements/u);
			else assert.equal(error.details.engine.code, "reviewed-ir-source-mismatch");
			return true;
		});
		await assert.rejects(lstat(outputRoot), { code: "ENOENT" });
		observations.push({ label, reviewedSourceSha256: sha256(source)
			, code: "reviewed-ir-source-mismatch", outputAbsent: true });
	}
	return observations;
};

/**
 * Compile in two roots, erase producers, verify the handoff and execute installed JS/TS.
 *
 * @param t - Test context responsible for temporary fixture cleanup.
 * @param selection - Scalar-only or structural corpus.
 * @param reviewed - Independent review rather than ordinary source selection.
 */
export const checkReviewedFinWasm = async (t, selection, reviewed) => {
	assert.ok(reviewedFinWasmSelections.includes(selection));
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-fin-wasm-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const producers = join(directory, "producers"), project = join(producers, "project"), relocated = join(producers, "relocated");
	await cp(fixture, project, { recursive: true });
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(configuration(selection, reviewed)));
	if(reviewed) await saveLakeFile(project, "api.binding-ir.json", canonicalJson(reviewedFinWasmIr(selection)));
	await cp(project, relocated, { recursive: true });
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const releases = [], facts = [];
	for(const [index, projectRoot] of [project, relocated].entries())
	{
		t.diagnostic(`${reviewed ? "reviewed" : "ordinary"} ${selection}: WASM and npm build ${index + 1}/2`);
		const before = await lakeInputState(projectRoot), outputRoot = join(producers, `build-${index}`);
		await build(projectRoot, outputRoot, runtimeRoot);
		const bundleRoot = join(outputRoot, "bundle");
		facts.push(await reviewedFinWasmBuildFacts(bundleRoot, selection, reviewed));
		const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(producers, `npm-${index}`) });
		await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		assert.equal(release.report.bindingIrSha256, facts[index].bindingIrSha256);
		assert.deepEqual(await lakeInputState(projectRoot), before);
		releases.push(release);
	}
	assert.deepEqual(facts[0], facts[1]);
	assert.deepEqual(releases[0].report, releases[1].report);
	for(const key of ["componentArchive", "runtimeArchive"])
		assert.deepEqual(await readFile(releases[0][key]), await readFile(releases[1][key]));
	const mismatches = reviewed && selection === "structural" ? await checkMismatches(t, producers, runtimeRoot) : [];
	const receipt = releases[0].report, handoff = join(directory, "handoff");
	await mkdir(handoff);
	for(const name of [receipt.package.archive, receipt.runtime.archive, "component-package-receipt.json", "verify-component-package-receipt.mjs"])
		await cp(join(releases[0].output, name), join(handoff, name));
	await rm(producers, { recursive: true, force: true });
	await assert.rejects(lstat(producers), { code: "ENOENT" });
	await run(process.execPath, [join(repository, "scripts/lean-bridge.mjs"), "verify", "--receipt", join(handoff, "component-package-receipt.json"), "--json"], directory);
	const consumer = join(directory, "consumer");
	await installReviewedFinWasm(consumer, handoff, receipt, selection);
	const node = await installedNode(consumer, selection);
	return {
		schemaVersion: 1
		, path: reviewed ? "reviewed-ir" : "ordinary-source"
		, selection
		, ...facts[0], independentBuilds: 2
		, reproducible: true, sourceRemovedBeforeInstallation: true
		, compilerFreePath: true, offlineInstall: true, receipt
		, mismatches
		, receiptSha256: sha256(await readFile(join(handoff, "component-package-receipt.json")))
		, consumerSha256: sha256(await readFile(join(consumer, "javascript.mjs"))), ...node };
};
