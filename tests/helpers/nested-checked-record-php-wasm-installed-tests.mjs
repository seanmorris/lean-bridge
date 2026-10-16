/**
 * Reproduce and execute all nested checked-record PHP-Wasm package selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	nestedCheckedRecordFixture
	, nestedCheckedRecordModule
} from "./nested-checked-record-fixture.mjs";
import {
	checkNestedCheckedRecordPhpWasmExecutions
	, checkNestedCheckedRecordPhpWasmModel
	, nestedCheckedRecordPhpWasmCaller
	, nestedCheckedRecordPhpWasmConfiguration
	, nestedCheckedRecordPhpWasmRequest
	, nestedCheckedRecordPhpWasmReview
	, nestedCheckedRecordPhpWasmSelection
	, nestedCheckedRecordPhpWasmSettings
} from "./nested-checked-record-php-wasm-fixture.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { installedPhpWasmCorpus } from "./type-corpus-php-wasm-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

const { enabled, routes, modes } = nestedCheckedRecordPhpWasmSelection(process.env);
const resourceMaxLoad = process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_WASM_MAX_LOAD === undefined
	? 8
	: Number(process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_WASM_MAX_LOAD);

for(const route of routes) for(const mode of modes) test(`installed nested checked-record PHP-Wasm packages reproduce and relocate ${route} ${mode}`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	for(const path of ["fixture.mjs", "installed-tests.mjs", "tests.mjs"])
		execFileSync("git", ["ls-files", "--error-unmatch", `tests/helpers/nested-checked-record-php-wasm-${path}`]);
	execFileSync("git", ["ls-files", "--error-unmatch", "tests/fixtures/nested-checked-record-consumers/php-native.php"]);
	execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
	const output = resolve(process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_WASM_OUTPUT
		?? "build/nested-checked-record-php-wasm", route, mode);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const resourceChecks = [];
	const resources = async () => {
		resourceChecks.push(await waitNominalSubtypeDotnetResources(output, {
			maxLoad: resourceMaxLoad
			, notify: message => t.diagnostic(message.replaceAll("C#", "nested PHP-Wasm"))
		}));
		await saveLakeFile(output, "resources.json", canonicalJson(resourceChecks));
	};
	await resources();
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-php-wasm-installed-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Retained failed nested checked-record PHP-Wasm inputs: ${root}`);
	});
	const expected = nestedCheckedRecordPhpWasmReview(mode);
	const configuration = nestedCheckedRecordPhpWasmConfiguration(route, mode);
	const environment = {
		...nativeFixtureEnvironment(["php-wasm"])
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
	};
	environment.LEAN_BRIDGE_PHP ??= "/usr/bin/php";
	environment.LEAN_BRIDGE_COMPOSER ??= "/usr/bin/composer";
	if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME)
		environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
	const consumer = join(root, "consumer"), handoff = join(consumer, "handoff");
	await saveLakeFile(output, "context.json", canonicalJson({ producerCommit, route, mode, root, consumer, handoff }));
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	const sources = {};
	for(const strictness of ["weak", "strict"])
	{
		sources[strictness] = await nestedCheckedRecordPhpWasmCaller(route, mode, strictness);
		await saveLakeFile(output, strictness + ".php", sources[strictness]);
	}
	for(const arrangement of ["embedded", "composer"])
		await saveLakeFile(output, `request-${arrangement}.json`, nestedCheckedRecordPhpWasmRequest(mode, arrangement));
	const builds = []; let packageSet;
	for(const attempt of [0, 1])
	{
		await resources();
		const author = join(root, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(nestedCheckedRecordFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		const sourceBefore = await lakeInputState(projectRoot);
		t.diagnostic(`PHP-Wasm ${route} ${mode}: author ${attempt}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, environment, targets: ["php-wasm"] })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), sourceBefore);
		const modelBytes = await readFile(join(outputRoot, "php-wasm/component/model.json")), model = JSON.parse(modelBytes);
		checkNestedCheckedRecordPhpWasmModel(model, route, mode);
		assert.equal(model.bindingIrSha256, built.bindingIrSha256);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json"));
		const receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.ecosystem, pkg.role]), [
			["php-wasm", "composer", "api"]
			, ["php-wasm", "npm", "runtime"]
			, ["php-wasm", "npm", "component"]
		]);
		const packageBytes = await readFile(join(outputRoot, "packages/php-wasm/php-wasm-package-set.json"));
		if(attempt === 0) packageSet = JSON.parse(packageBytes);
		for(const [path, bytes] of [
			["model.json", modelBytes]
			, ["package-set-receipt.json", receiptBytes]
			, ["php-wasm-package-set.json", packageBytes]
			, ["author-inputs.json", canonicalJson(sourceBefore)]
		]) await saveLakeFile(output, `build-${attempt}/${path}`, bytes);
		for(const path of [`${nestedCheckedRecordModule}.lean`, "lean-bridge.exports.json"])
			await saveLakeFile(output, `build-${attempt}/${path}`, await readFile(join(projectRoot, path)));
		if(route === "reviewed")
			await saveLakeFile(output, `build-${attempt}/api.binding-ir.json`, canonicalJson(expected));
		builds.push({
			bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, packageSetSha256: sha256(packageBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256])))
		});
		if(attempt === 0)
		{
			await copyPackageSetHandoff(outputRoot, handoff);
			await copyPackageSetHandoff(handoff, join(output, "handoff"));
		}
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "Both author roots reproduce all three package archives");
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await resources();
	const clean = {
		...copiedCleanEnvironment
		, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php"
		, LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler"
		, LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime"
	};
	const fixture = {
		settings: nestedCheckedRecordPhpWasmSettings
		, source: strictness => sources[strictness]
		, request: arrangement => nestedCheckedRecordPhpWasmRequest(mode, arrangement)
		, removeHandoff: true
	};
	const installed = await installedPhpWasmCorpus({
		t, library: { id: `nested-checked-records-${route}-${mode}` }
		, consumer, handoff, receipt, packageSet, environment, clean, fixture
	}).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	await assert.rejects(access(join(consumer, "project")), { code: "ENOENT" });
	checkNestedCheckedRecordPhpWasmExecutions(installed.phpWasm, mode);
	const deployment = join(consumer, "relocated");
	for(const path of [
		"package.json", "package-lock.json", "composer.json", "composer.lock"
		, "vendor/composer/installed.json", "driver.mjs", "node.mjs", "browser.mjs"
		, "weak.php", "strict.php", "request-embedded.json", "request-composer.json"
	]) await saveLakeFile(output, "deployment/" + path, await readFile(join(deployment, path)));
	for(const [index, execution] of installed.phpWasm.executions.entries())
		await saveLakeFile(output, `executions/${index}.json`, canonicalJson(execution));
	await verifyPackageSetReceipt({ receiptPath: join(output, "handoff/package-set-receipt.json") });
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, mode, producerCommit, configuration
		, expectedBindingIrSha256: hashBindingIr(expected), builds, receipt
		, ...installed
		, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
		, sourceRemovedBeforeInstallation: true, offlineInstall: true
		, compilerFreeReplay: true, relocatedInstallation: true
		, consumerSourceRequired: true
		, loadCeiling: resourceMaxLoad
		, dispatch: {
			observed: false
			, reason: "No constructor/source entry counters in this unmodified PHP-Wasm package"
		}
	}));
	complete = true;
});
