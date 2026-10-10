/**
 * Separate instrumented ordinary/reviewed PHP-Wasm packages through real installed hosts.
 * No unmodified-release entry measurement is inferred from these probe packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { buildSubtypeEntryProbe, subtypeEntryProbeReview, subtypeEntryProbeSelection, subtypeEntryProbeSource } from "./php-wasm-subtype-entry-build.mjs";
import { phpWasmSubtypeFixture, phpWasmSubtypeReview } from "./php-wasm-subtype-fixture.mjs";
import { phpWasmExecutionTuples, phpWasmFinCaller } from "./php-wasm-fin-fixtures.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { installedPhpWasmCorpus } from "./type-corpus-php-wasm-install.mjs";
import { parseSubtypeEntryTrace } from "./php-wasm-subtype-entry-trace.mjs";
import { subtypeEntryCall, subtypeEntryCorpusCalls } from "./php-wasm-subtype-entry-cases.mjs";
import "./php-wasm-subtype-entry-driver-tests.mjs";
import "./php-wasm-subtype-entry-report-tests.mjs";
import "./php-wasm-subtype-entry-ci-tests.mjs";
import "./php-wasm-entry-ci-history-tests.mjs";

test("portable PHP-Wasm probe setup reproduces the executed source and explicit selection", async t => {
	const fixture = await phpWasmSubtypeFixture(t), source = await readFile(join(fixture.root, "Subtypes.lean"), "utf8");
	const probe = subtypeEntryProbeSource(source), archive = "docs/evidence/php-wasm-subtype-entry-probe-20261010/r4";
	assert.equal(probe.source, await readFile(join(archive, "project/Subtypes.lean"), "utf8"));
	const model = JSON.parse(await readFile(join(archive, "model.json")));
	assert.deepEqual(subtypeEntryProbeSelection(model, probe.entries), JSON.parse(await readFile(join(archive, "selected.json"))));
	const review = subtypeEntryProbeReview(); validateBindingIr(review);
	assert.deepEqual(review.declarations.slice(0, -1), phpWasmSubtypeReview().declarations);
	assert.equal(review.declarations.at(-1).source.declaration, "Subtypes.unrestricted");
	assert.equal(review.declarations.length, 13);
	assert.throws(() => subtypeEntryProbeSource(probe.source));
	assert.throws(() => subtypeEntryProbeSource(source.replace("def checkedEven", "def renamedEven")));
	assert.throws(() => subtypeEntryProbeSelection({ ...model, pointerBits: 64 }, probe.entries));
});

for(const reviewed of [false, true]) test(`${reviewed ? "reviewed" : "ordinary"} installed PHP-Wasm Subtype entry probes record constructor and source calls`, {
	skip: process.env.LEAN_BRIDGE_PHP_WASM_SUBTYPE_ENTRY_TEST !== "1"
	, timeout: 3600000
}, async t => {
	const route = reviewed ? "reviewed" : "ordinary";
	const output = resolve(process.env.LEAN_BRIDGE_PHP_WASM_SUBTYPE_ENTRY_OUTPUT ?? "build/php-wasm-subtype-entry", route);
	await mkdir(output, { recursive: true });
	await assert.rejects(access(join(output, "report.json")), { code: "ENOENT" });
	const fixture = await phpWasmSubtypeFixture(t), original = await readFile(join(fixture.root, "Subtypes.lean"), "utf8");
	const sourceProbe = subtypeEntryProbeSource(original);
	const environment = nativeFixtureEnvironment(["php-wasm"]);
	const runtimeRoot = resolve(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME ?? environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME ?? "build/type-corpus/php-wasm-current-runtime");
	const emsdkRoot = resolve(environment.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const phpSource = resolve(environment.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const consumer = await mkdtemp(join(tmpdir(), `lean-bridge-subtype-entry-${route}-consumer-`));
	const roots = [consumer], builds = [];
	let complete = false;
	t.after(async () => {
		if(complete) await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
		else t.diagnostic("Retained failed probe roots: " + JSON.stringify(roots));
	});
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), `lean-bridge-subtype-entry-${route}-author-`)); roots.push(author);
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), recordRoot = join(output, `build-${attempt}`);
		await cp(fixture.root, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Subtypes.lean", sourceProbe.source);
		const configuration = { schemaVersion: 1, modules: [fixture.module]
			, targets: { "php-wasm": fixture.settings }
			, ...reviewed ? {} : { exports: [...fixture.exports, "Subtypes.unrestricted"], contracts: fixture.contracts, specializations: fixture.specializations } };
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(subtypeEntryProbeReview()));
		t.diagnostic(`${route}: build instrumented package ${attempt}`);
		const built = await buildSubtypeEntryProbe({
			projectRoot, outputRoot, recordRoot, sourceProbe, settings: fixture.settings
			, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, runtimeRoot, emsdkRoot, phpSource });
		assert.equal(built.model.schemaVersion, reviewed ? 3 : 2);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		builds.push(built);
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, join(consumer, "handoff"));
		await rm(author, { recursive: true });
		await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1].receipt, builds[0].receipt, "two author roots must produce identical probe archives");
	assert.deepEqual(builds[1].observation.library, builds[0].observation.library);
	const [{ receipt, packageSet, observation }] = builds;
	const caller = await phpWasmFinCaller(fixture);
	const clean = { ...copiedCleanEnvironment, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php", LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler", LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime" };
	const installed = await installedPhpWasmCorpus({
		t, library: { id: `${route}-subtype-entry-probe` }
		, consumer, handoff: join(consumer, "handoff")
		, receipt, packageSet, environment, clean
		, sourcePath: reviewed ? "reviewed-source" : "ordinary-source"
		, fixture: { settings: fixture.settings, source: caller.source, request: caller.request, removeHandoff: true, entryProbe: true } });
	const report = { schemaVersion: 1, scope: "separate-instrumented-probe", route
		, source: { originalSha256: sha256(original), probeSha256: sourceProbe.probeSha256 }
		, reproducible: true, sourceRemovedBeforeInstallation: true, receipt
		, builds: builds.map(item => item.observation), ...installed };
	await saveLakeFile(output, "report.json", canonicalJson(report));
	assert.deepEqual(installed.phpWasm.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	assert.deepEqual(installed.phpWasm.component.wasmLibrary, observation.library);
	const expected = subtypeEntryCorpusCalls();
	for(const execution of installed.phpWasm.executions)
	{
		assert.deepEqual(execution.observation, { checks: 2024, word_bits: 32, php: "8.4.1" });
		assert.equal(execution.entryProbe.scope, "separate-instrumented-probe");
		assert.equal(execution.entryProbe.calls, 2030);
		assert.deepEqual(parseSubtypeEntryTrace(execution.entryProbe.trace, observation.selected), expected);
		assert.deepEqual(parseSubtypeEntryTrace(execution.entryProbe.controlTrace, observation.selected), [subtypeEntryCall("unrestricted")]);
	}
	complete = true;
});
