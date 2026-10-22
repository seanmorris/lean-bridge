/**
 * Hosted producer for separately instrumented synchronous callback and leased
 * closure PHP-Wasm entries. Production packages remain uninstrumented.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { buildPhpWasmCallbackEntryProbe } from "./php-wasm-callback-entry-build.mjs";
import {
	phpWasmCallbackEntryCaller, phpWasmCallbackEntryExpected
	, phpWasmCallbackEntryFixture, phpWasmCallbackEntryRequest
} from "./php-wasm-callback-entry-fixtures.mjs";
import { phpWasmCallbackEntryPlan } from "./php-wasm-callback-entry-plan.mjs";
import { phpWasmCallbackEntrySelection } from "./php-wasm-callback-entry-selection.mjs";
import {
	phpWasmCallbackEntryHostedSelection, phpWasmCallbackEntrySourceFixture
} from "./php-wasm-callback-entry-source-fixtures.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { installedPhpWasmCorpus } from "./type-corpus-php-wasm-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const prefix = "LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_";
const hosted = phpWasmCallbackEntryHostedSelection(process.env);

test("instrumented PHP-Wasm callbacks close and execute every selected entry", {
	skip: !hosted.enabled, timeout: 14_400_000
}, async t => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
	const output = resolve(process.env[prefix + "OUTPUT"] ?? "build/php-wasm-callback-entry");
	await assert.rejects(access(output), { code: "ENOENT" });
	await mkdir(output, { recursive: true });
	const environment = nativeFixtureEnvironment(["php-wasm"]);
	environment.LEAN_BRIDGE_PHP ??= "/usr/bin/php";
	environment.LEAN_BRIDGE_COMPOSER ??= "/usr/bin/composer";
	if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME)
		environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME
			= environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
	const runtimeRoot = resolve(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME
		?? environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME
		?? "build/type-corpus/php-wasm-current-runtime");
	const emsdkRoot = resolve(environment.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const phpSource = resolve(environment.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const clean = { ...copiedCleanEnvironment
		, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php"
		, LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler"
		, LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime" };
	const roots = [], reports = []; let complete = false;
	t.after(async () => {
		if(complete) await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
		else t.diagnostic("Retained failed callback-entry roots: " + JSON.stringify(roots));
	});
	for(const family of hosted.families)
	{
		const sourceProbe = await phpWasmCallbackEntrySourceFixture(family);
		let ordinaryIr = null;
		if(family === "callback-checked-record" && hosted.routes.includes("reviewed"))
			assert.equal(hosted.routes[0], "ordinary"
				, "checked-record reviewed entry probes require ordinary extraction first");
		for(const route of hosted.routes)
		{
			const fixture = phpWasmCallbackEntryFixture(family, route, ordinaryIr);
			assert.equal(basename(sourceProbe.path), fixture.leanModule + ".lean");
			const routeOutput = join(output, family, route);
			await mkdir(routeOutput, { recursive: true });
			await saveLakeFile(routeOutput, "configuration.json", canonicalJson(fixture.configuration));
			if(route === "reviewed")
			{
				assert.ok(fixture.review, "reviewed callback route requires independent Binding IR");
				await saveLakeFile(routeOutput, "api.binding-ir.json", canonicalJson(fixture.review));
			}
			const builds = [], consumer = await mkdtemp(join(tmpdir()
				, `lean-bridge-${family}-${route}-entry-consumer-`));
			roots.push(consumer);
			const handoff = join(consumer, "handoff");
			for(const attempt of [0, 1])
			{
				const author = await mkdtemp(join(tmpdir()
					, `lean-bridge-${family}-${route}-entry-author-`));
				roots.push(author);
				const projectRoot = join(author, "project"), outputRoot = join(author, "release");
				await cp(fixture.root, projectRoot, { recursive: true });
				await saveLakeFile(projectRoot, fixture.leanModule + ".lean", sourceProbe.source);
				await saveLakeFile(projectRoot, "lean-bridge.exports.json"
					, canonicalJson(fixture.configuration));
				if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json"
					, canonicalJson(fixture.review));
				t.diagnostic(`${family} callback-entry ${route}: author ${attempt}`);
				const built = await buildPhpWasmCallbackEntryProbe({
					projectRoot, outputRoot, recordRoot: join(routeOutput, `build-${attempt}`)
					, sourceProbe, settings: fixture.settings, checkModel: fixture.verify
					, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
					, runtimeRoot, emsdkRoot, phpSource
				});
				await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
				builds.push(built);
				if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
				await rm(author, { recursive: true });
			}
			assert.deepEqual(builds[1].receipt, builds[0].receipt
				, "independent callback-entry packages reproduce");
			assert.deepEqual(builds[1].packageSet, builds[0].packageSet);
			assert.deepEqual(builds[1].observation.library, builds[0].observation.library);
			assert.deepEqual(builds[1].observation.selected, builds[0].observation.selected);
			assert.deepEqual(builds[1].observation.definitionCounts
				, builds[0].observation.definitionCounts);
			if(route === "ordinary")
			{
				if(ordinaryIr === null) ordinaryIr = structuredClone(builds[0].model.bindingIr);
				assert.equal(reviewedContractDifference(ordinaryIr, builds[1].model.bindingIr), null);
			}
			const selection = phpWasmCallbackEntrySelection(builds[0].model, sourceProbe.entries);
			assert.deepEqual(selection.selected, builds[0].observation.selected);
			const entryPlan = phpWasmCallbackEntryPlan(family, selection.selected);
			const sources = Object.fromEntries(await Promise.all(["weak", "strict"].map(async mode => [
				mode, await phpWasmCallbackEntryCaller(family, mode)
			])));
			const installed = await installedPhpWasmCorpus({
				t, library: { id: `${family}-${route}-callback-entry-probe` }
				, consumer, handoff, receipt: builds[0].receipt
				, packageSet: builds[0].packageSet, environment, clean
				, sourcePath: `${family}-${route}-callback-entry-source`
				, fixture: {
					settings: fixture.settings, source: mode => sources[mode]
					, request: arrangement => phpWasmCallbackEntryRequest(family, arrangement, entryPlan)
					, removeHandoff: true
					, entryProbe: {
						driver: "tests/fixtures/php-wasm-callback-entry/driver.mjs"
						, support: [{
							source: "tests/helpers/php-wasm-callback-entry-trace.mjs"
							, destination: "callback-entry-trace.mjs"
						}]
					}
				}
			});
			assert.deepEqual(installed.phpWasm.executions.map(item =>
				`${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort()
			, phpWasmExecutionTuples);
			const expected = phpWasmCallbackEntryExpected(entryPlan.cases);
			for(const execution of installed.phpWasm.executions)
			{
				assert.deepEqual(execution.observation, expected);
				assert.equal(execution.entryProbe.scope, entryPlan.scope);
				assert.equal(execution.entryProbe.family, family);
				assert.deepEqual(execution.entryProbe.controls
					, entryPlan.cases.map(item => item.control));
				assert.deepEqual(execution.entryProbe.cases.map(item => ({
					control: item.control, outcome: item.outcome, calls: item.calls
				})), entryPlan.cases);
			}
			const report = {
				schemaVersion: 1, scope: "separate-instrumented-probe"
				, producerCommit, family, route
				, configuration: fixture.configuration, entryPlan
				, source: { originalSha256: sourceProbe.originalSha256
					, probeSha256: sourceProbe.probeSha256 }
				, observations: builds.map(item => item.observation)
				, receipt: builds[0].receipt
				, ...installed
				, reproducible: true, independentBuilds: 2
				, sourceRemovedBeforeInstallation: true, compilerFreeReplay: true
				, offlineInstall: true, relocatedInstallation: true };
			await saveLakeFile(routeOutput, "report.json", canonicalJson(report));
			reports.push({ family, route, reportSha256: sha256(canonicalJson(report))
				, executions: installed.phpWasm.executions.length });
		}
	}
	await saveLakeFile(output, "index.json", canonicalJson({ schemaVersion: 1
		, kind: "php-wasm-callback-entry-installed-v1", producerCommit, reports }));
	complete = true;
});
