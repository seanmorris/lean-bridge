/**
 * Reproducible ordinary/reviewed Fin and checked-record callback PHP-Wasm
 * packages, installed without author sources in every supported host context.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	callbackCheckedRecordReviewedIr
} from "./callback-checked-record-fixture.mjs";
import {
	callbackCheckedRecordPhpWasmCaller, callbackCheckedRecordPhpWasmConfiguration
	, callbackCheckedRecordPhpWasmFixture, callbackCheckedRecordPhpWasmRequest
	, callbackCheckedRecordPhpWasmSettings
	, checkCallbackCheckedRecordPhpWasmExecutions
	, checkCallbackCheckedRecordPhpWasmModel
} from "./callback-checked-record-php-wasm-fixture.mjs";
import {
	callbackFinPhpWasmCaller, callbackFinPhpWasmConfiguration
	, callbackFinPhpWasmFixture, callbackFinPhpWasmRequest
	, callbackFinPhpWasmReview, callbackFinPhpWasmSettings
	, checkCallbackFinPhpWasmExecutions, checkCallbackFinPhpWasmModel
} from "./callback-fin-php-wasm-fixture.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { installedPhpWasmCorpus } from "./type-corpus-php-wasm-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const flag = process.env.LEAN_BRIDGE_CALLBACK_REFINEMENTS_PHP_WASM_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag));

const specs = Object.freeze([
	{
		name: "fin", fixture: callbackFinPhpWasmFixture
		, source: "ReviewedCallbacks.lean"
		, settings: callbackFinPhpWasmSettings
		, configuration: callbackFinPhpWasmConfiguration
		, caller: callbackFinPhpWasmCaller
		, request: callbackFinPhpWasmRequest
		, initialReview: callbackFinPhpWasmReview
		, review: value => value
		, checkModel: checkCallbackFinPhpWasmModel
		, checkExecutions: checkCallbackFinPhpWasmExecutions
	}
	, {
		name: "checked-record", fixture: callbackCheckedRecordPhpWasmFixture
		, source: "CallbackCheckedRecords.lean"
		, settings: callbackCheckedRecordPhpWasmSettings
		, configuration: callbackCheckedRecordPhpWasmConfiguration
		, caller: callbackCheckedRecordPhpWasmCaller
		, request: callbackCheckedRecordPhpWasmRequest
		, initialReview: () => undefined
		, review: callbackCheckedRecordReviewedIr
		, checkModel: checkCallbackCheckedRecordPhpWasmModel
		, checkExecutions: checkCallbackCheckedRecordPhpWasmExecutions
	}
]);

test("installed callback refinements PHP-Wasm reproduce and relocate every author route", {
	skip: flag !== "1", timeout: 14_400_000
}, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_CALLBACK_REFINEMENTS_PHP_WASM_OUTPUT
		?? "build/callback-refinements-php-wasm");
	await assert.rejects(access(output), { code: "ENOENT" });
	await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-callback-refinements-php-wasm-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained callback refinements PHP-Wasm inputs: ${directory}`);
	});
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const environment = nativeFixtureEnvironment(["php-wasm"]);
	environment.LEAN_BRIDGE_PHP ??= "/usr/bin/php";
	environment.LEAN_BRIDGE_COMPOSER ??= "/usr/bin/composer";
	if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME)
		environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME
			= environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
	const clean = { ...copiedCleanEnvironment
		, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php"
		, LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler"
		, LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime" };
	const index = [];
	for(const spec of specs)
	{
		const profileOutput = join(output, spec.name);
		await mkdir(profileOutput, { recursive: true });
		const sources = Object.fromEntries(await Promise.all(["weak", "strict"]
			.map(async mode => [mode, await spec.caller(mode)])));
		for(const [mode, source] of Object.entries(sources))
			await saveLakeFile(profileOutput, `${mode}.php`, source);
		for(const arrangement of ["embedded", "composer"])
			await saveLakeFile(profileOutput, `request-${arrangement}.json`, spec.request(arrangement));
		let review = spec.initialReview();
		const reports = [];
		for(const route of ["ordinary", "reviewed"])
		{
			const routeOutput = join(profileOutput, route);
			const consumer = join(directory, spec.name, route, "consumer");
			await mkdir(routeOutput, { recursive: true });
			const configuration = spec.configuration(route);
			await saveLakeFile(routeOutput, "configuration.json", canonicalJson(configuration));
			const builds = [];
			let receipt, packageSet, handoff;
			for(const attempt of [0, 1])
			{
				const author = join(directory, spec.name, route, `author-${attempt}`);
				const projectRoot = join(author, "project"), outputRoot = join(author, "release");
				await cp(spec.fixture, projectRoot, { recursive: true });
				await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
				if(route === "reviewed")
				{
					assert.ok(review, "ordinary compiler evidence must precede reviewed admission");
					await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
				}
				t.diagnostic(`${spec.name} callback PHP-Wasm ${route}: author ${attempt}`);
				await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment })
					.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
				const modelBytes = await readFile(join(outputRoot, "php-wasm/component/model.json"));
				const model = JSON.parse(modelBytes);
				if(route === "ordinary")
				{
					const selected = spec.review(model.bindingIr);
					if(review === undefined)
					{
						review = selected;
						await saveLakeFile(profileOutput, "reviewed.binding-ir.json", canonicalJson(review));
					}
					else assert.equal(reviewedContractDifference(review, model.bindingIr), null);
				}
				spec.checkModel(model, review, route);
				const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json"));
				const currentReceipt = JSON.parse(receiptBytes);
				await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
				const packageBytes = await readFile(join(outputRoot
					, "packages/php-wasm/php-wasm-package-set.json"));
				const currentPackageSet = JSON.parse(packageBytes);
				const recordRoot = join(routeOutput, `build-${attempt}`);
				await saveLakeFile(recordRoot, "model.json", modelBytes);
				await saveLakeFile(recordRoot, "package-set-receipt.json", receiptBytes);
				await saveLakeFile(recordRoot, "php-wasm-package-set.json", packageBytes);
				await saveLakeFile(recordRoot, spec.source, await readFile(join(projectRoot, spec.source)));
				await saveLakeFile(recordRoot, "lean-bridge.exports.json"
					, await readFile(join(projectRoot, "lean-bridge.exports.json")));
				if(route === "reviewed") await saveLakeFile(recordRoot, "api.binding-ir.json"
					, await readFile(join(projectRoot, "api.binding-ir.json")));
				builds.push({ modelSha256: sha256(modelBytes)
					, receiptSha256: sha256(receiptBytes)
					, packageSetSha256: sha256(packageBytes)
					, archives: Object.fromEntries(currentReceipt.packages.flatMap(pkg => pkg.artifacts
						.map(item => [item.path, item.sha256]))) });
				if(attempt === 0)
				{
					receipt = currentReceipt; packageSet = currentPackageSet;
					handoff = join(consumer, "handoff");
					await copyPackageSetHandoff(outputRoot, handoff);
					await copyPackageSetHandoff(outputRoot, join(routeOutput, "handoff"));
				}
				await rm(author, { recursive: true });
				await assert.rejects(access(author), { code: "ENOENT" });
			}
			await saveLakeFile(routeOutput, "reviewed.binding-ir.json", canonicalJson(review));
			assert.deepEqual(builds[1], builds[0]);
			await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
			const installed = await installedPhpWasmCorpus({ t
				, library: { id: `callback-${spec.name}-${route}` }
				, consumer, handoff, receipt, packageSet, environment, clean
				, sourcePath: `${spec.name}-${route}-source`
				, fixture: { settings: spec.settings, source: mode => sources[mode]
					, request: spec.request, removeHandoff: true } })
				.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
			await assert.rejects(access(handoff), { code: "ENOENT" });
			await assert.rejects(access(join(consumer, "project")), { code: "ENOENT" });
			spec.checkExecutions(installed.phpWasm);
			const deployment = join(consumer, "relocated");
			const records = [
				"package.json", "package-lock.json", "composer.json", "composer.lock"
				, "vendor/composer/installed.json", "driver.mjs", "node.mjs", "browser.mjs"
				, "weak.php", "strict.php", "request-embedded.json", "request-composer.json"
			];
			for(const path of records)
				await saveLakeFile(routeOutput, "deployment/" + path, await readFile(join(deployment, path)));
			for(const [number, execution] of installed.phpWasm.executions.entries())
				await saveLakeFile(routeOutput, `executions/${number}.json`, canonicalJson(execution));
			const report = { schemaVersion: 1, profile: spec.name, route, producerCommit
				, configuration, reviewedBindingIrSha256: hashBindingIr(review)
				, builds, receipt
				, ...installed
				, reproducible: true, independentBuilds: 2
				, sourceRemovedBeforeInstallation: true, offlineInstall: true
				, compilerFreeReplay: true, relocatedInstallation: true
				, callbackBoundaries: { hostArguments: true, hostReplies: true
					, closureArguments: true, closureResults: true, mixed: true
					, nestedContainers: true, firstError: true, cleanup: true
					, recovery: true, proofFreeRecords: spec.name === "checked-record" } };
			await saveLakeFile(routeOutput, "report.json", canonicalJson(report));
			reports.push({ route, reportSha256: sha256(canonicalJson(report))
				, bindingIrSha256: installed.phpWasm.component.bindingIrSha256
				, executions: installed.phpWasm.executions.length });
		}
		index.push({ profile: spec.name, reports });
	}
	await saveLakeFile(output, "index.json", canonicalJson({ schemaVersion: 1
		, kind: "callback-refinements-php-wasm-installed-v1"
		, producerCommit, profiles: index }));
	complete = true;
});
