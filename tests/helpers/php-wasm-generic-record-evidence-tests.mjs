/**
 * Bind ordinary generic-record PHP-Wasm observations to the original installed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { phpWasmExecutionTuples, phpWasmFinConsumer } from "./php-wasm-fin-fixtures.mjs";
import { phpWasmDriverHashes, phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";

const directory = "docs/evidence/php-wasm-generic-records-20261007";
const reportDigest = "dd842951dfd63c631cf04951dbe11c7540a17c307cb745895e1f2617e79aacd4";
const logDigest = "c1b8ceb08c17c321250b7e1d20359d2f7eaa1a749242ed2956333834e0aca161";
const failureDigest = "aec1e77a67dfa643c96048fac6232ffb23b7491640b8cdc47aa6347abadd749a";
const subset = (files, prefix) => Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith(prefix)).map(([path, value]) => [path.slice(prefix.length), value]));

const validateReport = (report, caller) => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.label, "generic-records");
	assert.equal(report.profile, "php-wasm"); assert.equal(report.path, "ordinary-source");
	assert.equal(report.dispatch, "not measured");
	assert.equal(report.reproducible, true); assert.equal(report.sourceRemovedBeforeInstallation, true);
	const evidence = report.phpWasm, set = evidence.packageSet, component = evidence.component, runtime = evidence.runtime;
	for(const flag of phpWasmIsolationFlags) assert.equal(evidence[flag], true, flag);
	assert.equal(component.pointerBits, 32); assert.equal(runtime.pointerBits, 32);
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
	const componentRoot = "node_modules/lean-bridge-genericrecords-wasm/compiled/";
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
		assert.equal(deployed[`request-${arrangement}.json`].sha256, evidence.requests[arrangement]);
	assert.deepEqual(evidence.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	const libraries = [basename(component.library), basename(runtime.library)].sort();
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, { checks: 1021, php: "8.4.1", word_bits: 32 });
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

test("PHP-Wasm generic-record archive preserves every installed loading and caller mode", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.revision, "d40fd3bbb25728fcacb4ca50b88ded8610aae19a");
	assert.equal(receipt.execution, "local"); assert.equal(receipt.scope.finiteFunctionSpecializations, false);
	assert.equal(receipt.scope.executions, 12); assert.equal(receipt.scope.dispatch, "not measured");
	assert.equal(receipt.report.sha256, reportDigest); assert.equal(receipt.log.sha256, logDigest);
	assert.equal(receipt.sourceFiles.length, 4);
	for(const source of receipt.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(source.path, await readFile(source.path), source.sha256)), source.sha256, source.path);
	const bytes = await readFile(receipt.report.path);
	assert.equal(sha256(bytes), reportDigest);
	const report = JSON.parse(bytes);
	assert.deepEqual(report.phpWasm.runtime.pins, receipt.producerEnvironment.pins);
	const caller = await readFile("tests/fixtures/generic-record-consumers/php-native.php", "utf8");
	validateReport(report, caller);
	const log = await readFile(receipt.log.path, "utf8");
	assert.equal(sha256(log), logDigest);
	for(const [key, count] of Object.entries({ tests: 2, pass: 2, fail: 0, skipped: 0 }))
		assert.match(log, new RegExp(`^# ${key} ${count}$`, "mu"));
	assert.match(log, /^exit=0$/mu); assert.doesNotMatch(log, /^not ok /mu);
});

test("PHP-Wasm archive rejects missing routes, fake dispatch and modified installed libraries", async () => {
	const original = JSON.parse(await readFile(`${directory}/ordinary.json`, "utf8"));
	const caller = await readFile("tests/fixtures/generic-record-consumers/php-native.php", "utf8");
	const mutations = [
		report => { report.phpWasm.executions.pop(); }
		, report => { report.phpWasm.executions[0].observation.checks = 0; }
		, report => { report.phpWasm.executions[0].phases[0].libraries = []; }
		, report => { report.phpWasm.executions[8].requests = []; }
		, report => { report.dispatch = "measured"; }
		, report => { report.reproducible = false; }
		, report => { report.phpWasm.offlineInstall = false; }
		, report => { report.sourceRemovedBeforeInstallation = false; }
		, report => { report.phpWasm.component.wasmLibrary.sha256 = "0".repeat(64); }
	];
	for(const mutate of mutations)
	{
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => validateReport(changed, caller));
	}
});

test("the failed PHP Fin attempt is retained without an installed acceptance claim", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.failedFinAttempt.reportProduced, false);
	assert.equal(receipt.failedFinAttempt.log.sha256, failureDigest);
	const log = await readFile(receipt.failedFinAttempt.log.path, "utf8");
	assert.equal(sha256(log), failureDigest);
	assert.match(log, /^# pass 7$/mu); assert.match(log, /^# fail 1$/mu); assert.match(log, /^exit=1$/mu);
	assert.match(log, /PHP function name is reserved or duplicated: never/u);
});
