/**
 * Bind ordinary PHP-Wasm Fin observations to their original packages and complete fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { phpWasmExecutionTuples, phpWasmFinCaller, phpWasmFinConsumer, phpWasmFinFixtures } from "./php-wasm-fin-fixtures.mjs";
import { phpWasmDriverHashes, phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";

const directory = "docs/evidence/php-wasm-fin-20261008";
const reportDigest = "67dafe06c7c826269c3fb678117b9bf14da12b261f5c9484e695cfe1a1f87046";
const logDigest = "b91f61f8e39c4507fcfeb3aebd651af0bf64c4bfe01c79e0fc4cbd062fe5e20e";
const subset = (files, prefix) => Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith(prefix)).map(([path, value]) => [path.slice(prefix.length), value]));

const validateReport = (report, fixture, caller, requests, checks) => {
	assert.equal(phpWasmFinFixtures[report.fixture], fixture);
	assert.equal(report.label, `fin-${report.fixture}`);
	assert.deepEqual(report.refinements, fixture.refinements);
	assert.equal(report.profile, "php-wasm"); assert.equal(report.path, "ordinary-source");
	assert.equal(report.dispatch, "not measured");
	assert.equal(report.reproducible, true); assert.equal(report.sourceRemovedBeforeInstallation, true);
	const evidence = report.phpWasm, set = evidence.packageSet, component = evidence.component, runtime = evidence.runtime;
	for(const flag of phpWasmIsolationFlags) assert.equal(evidence[flag], true, flag);
	assert.equal(component.pointerBits, 32); assert.equal(runtime.pointerBits, 32);
	assert.deepEqual(component.exports.map(item => item.declaration).sort(),
		Object.keys(fixture.refinements).map(name => `lean:${name}`).sort());
	const configuration = JSON.parse(component.sourceIdentity.exportConfigurationSource);
	assert.deepEqual([...configuration.exports].sort(), Object.keys(fixture.refinements).sort());
	assert.deepEqual(configuration.modules, [fixture.module]);
	assert.equal(runtime.pins.phpVersion, "8.4.1"); assert.equal(runtime.pins.emscriptenVersion, "3.1.68");
	assert.equal(component.bindingIrSha256, report.bindingIrSha256); assert.equal(component.modelSha256, report.modelSha256);
	assert.equal(component.runtimeIdentity, sha256(canonicalJson(runtime)));
	assert.equal(set.runtimeIdentity, component.runtimeIdentity);
	assert.equal(report.packages.length, 3); assert.equal(set.archives.length, 3);
	assert.equal(Object.keys(report.archives).length, 3);
	const deployed = evidence.deployment;
	for(const pkg of report.packages)
	{
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.runtimeIdentity, component.runtimeIdentity);
		const artifact = pkg.artifacts[0], packed = set.archives.find(item => item.role === pkg.role);
		assert.ok(packed); assert.equal(packed.name, pkg.name); assert.equal(packed.version, pkg.version);
		assert.equal(packed.ecosystem, pkg.ecosystem);
		assert.equal(packed.archive, basename(artifact.path));
		assert.equal(packed.sha256, artifact.sha256); assert.equal(packed.bytes, artifact.bytes);
		assert.equal(report.archives[artifact.path], artifact.sha256);
		assert.deepEqual(set.files[`archives/${packed.archive}`], { sha256: artifact.sha256, bytes: artifact.bytes });
		const destination = `${pkg.ecosystem === "composer" ? "vendor" : "node_modules"}/${pkg.name}/`;
		assert.deepEqual(subset(deployed, destination), subset(set.files, `${packed.directory}/`));
	}
	const componentRoot = `node_modules/${fixture.settings.npm.name}/compiled/`;
	const runtimeRoot = "node_modules/@lean-bridge/php-wasm-copied-runtime/compiled/";
	assert.equal(deployed[componentRoot + "php-wasm-component.json"].sha256, sha256(canonicalJson(component)));
	assert.equal(deployed[componentRoot + "model.json"].sha256, report.modelSha256);
	assert.equal(deployed[runtimeRoot + "runtime.json"].sha256, component.runtimeIdentity);
	const libraryPaths = [componentRoot + component.library, runtimeRoot + runtime.library];
	assert.deepEqual(deployed[libraryPaths[0]], component.wasmLibrary);
	assert.deepEqual(deployed[libraryPaths[1]], runtime.files[runtime.library]);
	assert.deepEqual(subset(deployed, "node_modules/php-wasm/"), evidence.host.files);
	assert.equal(evidence.host.version, "0.1.0");
	for(const [path, hash] of Object.entries(phpWasmDriverHashes)) assert.equal(deployed[path].sha256, hash);
	for(const mode of ["weak", "strict"])
	{
		assert.equal(evidence.consumerSources[mode], sha256(phpWasmFinConsumer(caller, mode)));
		assert.equal(deployed[`${mode}.php`].sha256, evidence.consumerSources[mode]);
	}
	for(const arrangement of ["embedded", "composer"])
	{
		assert.equal(evidence.requests[arrangement], sha256(requests(arrangement)));
		assert.equal(deployed[`request-${arrangement}.json`].sha256, evidence.requests[arrangement]);
	}
	assert.deepEqual(evidence.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	const libraries = [basename(component.library), basename(runtime.library)].sort();
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, { checks, php: "8.4.1", word_bits: 32 });
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() })),
			["ready", "autoload", "invalid", "complete"].map(stage => ({ stage, libraries: execution.loading === "startup" || stage === "complete" ? libraries : [] })));
		if(execution.realm !== "chromium") continue;
		for(const request of execution.requests) assert.deepEqual({ bytes: request.bytes, sha256: request.sha256 }, deployed[request.path]);
		for(const path of libraryPaths)
			assert.equal(execution.requests.filter(request => request.sha256 === deployed[path].sha256).length, 1);
		for(const path of ["bundled/consumer.mjs", "node_modules/php-wasm/PhpWeb.mjs", `${execution.mode}.php`])
			assert.ok(execution.requests.some(request => request.path === path), path);
	}
	assert.deepEqual(report.observation, evidence.executions[0].observation);
};

const counts = { products: 2039, records: 2053 };

test("PHP-Wasm Fin archive authenticates both complete fixtures and every installed route", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.revision, "c391e58a1fcfa9a3c137f1ca4b4fb8a49fc77dda");
	assert.equal(receipt.execution, "local");
	assert.equal(receipt.scope.sourcePath, "ordinary-source");
	assert.equal(receipt.scope.dispatch, "not measured");
	assert.equal(receipt.scope.reviewedContracts, false);
	assert.equal(receipt.scope.subtype, false);
	assert.deepEqual(receipt.scope.fixtures, [
		{ name: "products", exports: 11, executions: 12, checksPerExecution: 2039 }
		, { name: "records", exports: 13, executions: 12, checksPerExecution: 2053 }
	]);
	assert.equal(receipt.report.sha256, reportDigest); assert.equal(receipt.log.sha256, logDigest);
	assert.equal(receipt.sourceFiles.length, 8);
	for(const source of receipt.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(source.path, await readFile(source.path), source.sha256)), source.sha256, source.path);
	const bytes = await readFile(receipt.report.path);
	assert.equal(sha256(bytes), reportDigest);
	const archive = JSON.parse(bytes);
	assert.equal(archive.schemaVersion, 1);
	assert.deepEqual(archive.reports.map(report => report.fixture), ["products", "records"]);
	for(const report of archive.reports)
	{
		const fixture = phpWasmFinFixtures[report.fixture];
		const caller = await readFile(fixture.consumer, "utf8"), { request } = await phpWasmFinCaller(fixture);
		assert.deepEqual(report.phpWasm.runtime.pins, receipt.producerEnvironment.pins);
		assert.equal(report.phpWasm.nodeVersion, receipt.producerEnvironment.nodeVersion);
		assert.equal(report.phpWasm.browserVersion, receipt.producerEnvironment.browserVersion);
		validateReport(report, fixture, caller, request, counts[report.fixture]);
		const module = report.phpWasm.component.sourceIdentity.modules.find(item => item.module === fixture.module);
		const expected = receipt.sourceFiles.find(item => item.path === `${fixture.root}/${fixture.module}.lean`);
		assert.equal(module.source.sha256, expected.sha256);
	}
	const log = await readFile(receipt.log.path, "utf8");
	assert.equal(sha256(log), logDigest);
	for(const [key, count] of Object.entries({ tests: 9, pass: 9, fail: 0, skipped: 0 }))
		assert.match(log, new RegExp(`^# ${key} ${count}$`, "mu"));
	assert.match(log, /^exit=0$/mu); assert.doesNotMatch(log, /^not ok /mu);
	const queue = await readFile(receipt.queue.path, "utf8");
	assert.equal(sha256(queue), receipt.queue.sha256);
	assert.match(queue, /php-wasm-fin exit=0 # pass 9 # fail 0 # skipped 0/u);
});

test("PHP-Wasm Fin archive rejects missing cases, altered constraints and unobserved claims", async () => {
	const archive = JSON.parse(await readFile(`${directory}/ordinary.json`, "utf8"));
	for(const original of archive.reports)
	{
		const fixture = phpWasmFinFixtures[original.fixture];
		const caller = await readFile(fixture.consumer, "utf8"), { request } = await phpWasmFinCaller(fixture);
		const mutations = [
			report => { report.phpWasm.executions.pop(); }
			, report => { report.phpWasm.executions[0].observation.checks = 0; }
			, report => { report.phpWasm.executions[0].observation.word_bits = 64; }
			, report => { report.phpWasm.executions[0].phases[0].libraries = []; }
			, report => { report.phpWasm.executions[8].requests = []; }
			, report => { report.dispatch = "measured"; }
			, report => { report.path = "reviewed-ir"; }
			, report => { report.reproducible = false; }
			, report => { report.phpWasm.offlineInstall = false; }
			, report => { report.sourceRemovedBeforeInstallation = false; }
			, report => { report.phpWasm.component.wasmLibrary.sha256 = "0".repeat(64); }
			, report => { report.phpWasm.consumerSources.strict = report.phpWasm.consumerSources.weak; }
			, report => { report.phpWasm.component.exports.pop(); }
			, report => { delete report.refinements[Object.keys(report.refinements)[0]]; }
		];
		for(const mutate of mutations)
		{
			const changed = structuredClone(original); mutate(changed);
			assert.throws(() => validateReport(changed, fixture, caller, request, counts[original.fixture]));
		}
	}
});

test("the successful PHP-safe Fin fixture does not rewrite its failed predecessor", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	const previous = JSON.parse(await readFile(receipt.previousFailedAttempt.receipt, "utf8"));
	assert.equal(previous.failedFinAttempt.reportProduced, false);
	assert.equal(previous.failedFinAttempt.log.sha256, receipt.previousFailedAttempt.logSha256);
	const log = await readFile(previous.failedFinAttempt.log.path);
	assert.equal(sha256(log), receipt.previousFailedAttempt.logSha256);
	assert.match(log.toString("utf8"), /PHP function name is reserved or duplicated: never/u);
	const archive = JSON.parse(await readFile(`${directory}/ordinary.json`, "utf8"));
	const products = archive.reports.find(report => report.fixture === "products");
	assert.ok(products.refinements["FinProducts.absentOnly"]);
	assert.equal(products.refinements["FinProducts.never"], undefined);
	assert.match(JSON.stringify(products.refinements["FinProducts.absentOnly"]), /"bound":"0"/u);
});
