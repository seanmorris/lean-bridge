/**
 * Hosted producer for separately instrumented owned refinement packages.
 * This proves exact constructor/source dispatch and transfer ordering after install.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { buildPhpWasmOwnedRefinementEntryProbe } from "./php-wasm-owned-refinement-entry-build.mjs";
import {
	phpWasmOwnedRefinementEntryCaller, phpWasmOwnedRefinementEntryExpected
	, phpWasmOwnedRefinementEntryFixture, phpWasmOwnedRefinementEntryHostedSelection
	, phpWasmOwnedRefinementEntryRequest
} from "./php-wasm-owned-refinement-entry-fixtures.mjs";
import { phpWasmOwnedRefinementEntryPlan } from "./php-wasm-owned-refinement-entry-plan.mjs";
import { phpWasmOwnedRefinementEntrySelection } from "./php-wasm-owned-refinement-entry-selection.mjs";
import { phpWasmOwnedRefinementEntrySourceFixture } from "./php-wasm-owned-refinement-entry-source-fixtures.mjs";
import { installedPhpWasmCorpus } from "./type-corpus-php-wasm-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const prefix = "LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_";
const hosted = phpWasmOwnedRefinementEntryHostedSelection(process.env);

for(const family of hosted.families) for(const route of hosted.routes)
test(`instrumented owned PHP-Wasm package closes ${family} ${route} dispatch and transfer order`, {
	skip: !hosted.enabled, timeout: 3_600_000
}, async t => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
	const output = resolve(process.env[prefix + "OUTPUT"] ?? "build/php-wasm-owned-refinement-entry"
		, route, family);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const fixture = await phpWasmOwnedRefinementEntryFixture(family, route);
	const sourceProbe = await phpWasmOwnedRefinementEntrySourceFixture(family);
	const environment = nativeFixtureEnvironment(["php-wasm"]);
	const runtimeRoot = resolve(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME
		?? environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME ?? "build/type-corpus/php-wasm-current-runtime");
	const emsdkRoot = resolve(environment.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const phpSource = resolve(environment.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const consumer = await mkdtemp(join(tmpdir(), `lean-bridge-${family}-${route}-entry-consumer-`));
	const handoff = join(consumer, "handoff"), roots = [consumer], builds = []; let complete = false;
	t.after(async () => {
		if(complete) await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
		else t.diagnostic("Retained failed owned-entry roots: " + JSON.stringify(roots));
	});
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), `lean-bridge-${family}-${route}-entry-`));
		roots.push(author);
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(fixture.root, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, `${fixture.leanModule}.lean`, sourceProbe.source);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(fixture.configuration));
		if(route === "reviewed")
			await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(fixture.review));
		const built = await buildPhpWasmOwnedRefinementEntryProbe({
			projectRoot, outputRoot, recordRoot: join(output, `build-${attempt}`)
			, sourceProbe, settings: fixture.settings, checkModel: fixture.verify
			, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, runtimeRoot, emsdkRoot, phpSource
		});
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		assert.equal(built.model.schemaVersion, 8);
		assert.ok(built.model.ownedGraph.inputTransfers);
		assert.equal(built.model.ownedGraph.hostCallbacks, undefined);
		builds.push(built);
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		await rm(author, { recursive: true });
	}
	assert.deepEqual(builds[1].receipt, builds[0].receipt, "independent owned probe packages reproduce");
	assert.deepEqual(builds[1].observation.library, builds[0].observation.library);
	assert.deepEqual(builds[1].observation.selected, builds[0].observation.selected);
	assert.deepEqual(builds[1].observation.definitionCounts, builds[0].observation.definitionCounts);
	const selection = phpWasmOwnedRefinementEntrySelection(builds[0].model, sourceProbe.entries);
	assert.deepEqual(selection.selected, builds[0].observation.selected);
	const entryPlan = phpWasmOwnedRefinementEntryPlan(family, selection.selected, selection.adapters.leanSource);
	const sources = Object.fromEntries(await Promise.all(["weak", "strict"].map(async mode => [
		mode, await phpWasmOwnedRefinementEntryCaller(family, mode)
	])));
	const clean = {
		...copiedCleanEnvironment
		, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php"
		, LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler"
		, LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime"
	};
	const installed = await installedPhpWasmCorpus({
		t, library: { id: `${family}-${route}-owned-entry-probe` }
		, consumer, handoff, receipt: builds[0].receipt
		, packageSet: builds[0].packageSet, environment, clean
		, fixture: {
			settings: fixture.settings, source: mode => sources[mode]
			, request: arrangement => phpWasmOwnedRefinementEntryRequest(family, arrangement, entryPlan)
			, removeHandoff: true
			, entryProbe: {
				driver: "tests/fixtures/php-wasm-refinement-entry/driver.mjs"
				, support: [{ source: "tests/helpers/php-wasm-subtype-entry-trace.mjs"
					, destination: "entry-trace.mjs" }]
			}
		}
	});
	assert.deepEqual(installed.phpWasm.executions.map(item =>
		`${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	const expected = phpWasmOwnedRefinementEntryExpected(family, entryPlan.cases);
	for(const execution of installed.phpWasm.executions)
	{
		assert.deepEqual(execution.observation, expected);
		assert.equal(execution.entryProbe.scope, entryPlan.scope);
		assert.equal(execution.entryProbe.family, family);
		assert.equal(execution.entryProbe.calls, entryPlan.cases.length);
		assert.deepEqual(execution.entryProbe.controls, entryPlan.cases.map(item => item.control));
	}
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, scope: "separate-instrumented-probe"
		, producerCommit, family, route, entryPlan
		, ...installed
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true, compilerFreeReplay: true
		, offlineInstall: true, relocatedInstallation: true
	}));
	await saveLakeFile(output, "summary.json", canonicalJson({
		schemaVersion: 1, scope: "separate-instrumented-probe"
		, producerCommit, family, route
		, source: { originalSha256: sourceProbe.originalSha256, probeSha256: sourceProbe.probeSha256 }
		, receipt: builds[0].receipt
		, observations: builds.map(item => item.observation)
	}));
	complete = true;
});
