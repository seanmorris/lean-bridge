/**
 * Bind independent rebuilds and shared-host execution to original installed files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmGraph } from "../../src/build/php-wasm-graph-component.mjs";
import { generateCopiedPhpZendAdapter } from "../../src/backends/php/copied-zend.mjs";
import { assertAdministrativeSourceUpdate } from "./test-registration-history.mjs";
import { assertPhpWasmGraphPackageEvidence, phpWasmGraphPackageEvidenceSources } from "./php-wasm-graph-receipt.mjs";
import { comparePhpWasmGraphBuilds } from "./php-wasm-graph-reproduction.mjs";
import { assertPhpWasmGraphComposition } from "./php-wasm-graph-loading.mjs";
import { phpWasmGraphLoadingSpecifications } from "./php-wasm-graph-loading-install.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";

export const phpWasmGraphLoadingEvidenceSources = [...new Set([
	...phpWasmGraphPackageEvidenceSources
	, "src/backends/php/copied-zend.mjs", "src/backends/php/copied-model.mjs"
	, "tests/helpers/php-wasm-graph-reproduction.mjs"
	, "tests/helpers/php-wasm-graph-loading-install.mjs"
	, "tests/helpers/php-wasm-graph-loading.mjs"
	, "tests/helpers/php-wasm-graph-loading-receipt.mjs"
	, "tests/php-wasm-graph-reproduction.test.mjs"
	, "tests/php-wasm-graph-loading.test.mjs"
	, "tests/fixtures/structured-types/recursive-php-wasm-composition.php"
	, "tests/fixtures/structured-types/recursive-php-wasm-loading.mjs"
	, "tests/helpers/source-registration-flags.mjs"
	, "tests/helpers/source-registration-history.mjs"
	, "tests/helpers/native-asset-tamper-history.mjs"
	, "tests/source-registration-history.test.mjs"
])].sort();

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const completeLog = (record, name) => {
	assert.equal(record.sha256, sha256(record.text));
	assert.ok(record.text.includes(` - ${name}\n`));
	assert.match(record.text, /# fail 0\n# cancelled 0\n# skipped 0/);
};

const assertInstalledLoading = report => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.producersRemoved, true); assert.equal(report.unchangedDeployment, true);
	assert.equal(report.runtimeIdentity, sha256(canonicalJson(report.runtimeManifest)));
	assert.equal(report.runtimeManifest.pointerBits, 32);
	assert.deepEqual(report.packages.map(({ name, module, artifact, graph, value }) => ({ name, module, artifact, graph, value })), phpWasmGraphLoadingSpecifications);
	for(const pkg of report.packages)
	{
		assert.equal(pkg.sourceSha256, sha256(pkg.source)); assert.equal(pkg.sourceUnchanged, true);
		const { model, receipt, metadata } = pkg;
		assert.deepEqual(receipt.sourceIdentity.modules.map(item => [item.module, item.source.bytes, item.source.sha256]), [[pkg.module, Buffer.byteLength(pkg.source), pkg.sourceSha256]]);
		assert.deepEqual(model, createCompiledPhpWasmModel({ metadata, component: model.component, sourceIdentity: receipt.sourceIdentity }));
		assert.equal(Boolean(model.copiedGraph), pkg.graph); assert.equal(model.pointerBits, 32);
		assert.equal(model.exports.length, pkg.graph ? 2 : 1);
		assert.equal(receipt.runtimeIdentity, report.runtimeIdentity);
		assert.equal(receipt.modelSha256, sha256(canonicalJson(model)));
		assert.equal(receipt.metadataSha256, sha256(canonicalJson(metadata)));
		assert.equal(pkg.report.componentIdentity, sha256(canonicalJson(receipt)));
		assert.deepEqual(pkg.report.component, model.component);
		assert.equal(pkg.report.runtimeIdentity, report.runtimeIdentity);
		assert.deepEqual(pkg.report.archives[0], report.packages[0].report.archives[0]);
		const adapters = generateCompiledPhpWasmLeanAdapters(model);
		const graph = pkg.graph ? generateCompiledPhpWasmGraph(model, adapters) : null;
		const files = graph?.files ?? generateCopiedPhpZendAdapter(model.bindingIr);
		if(graph) assert.deepEqual(receipt.copiedGraph, graph.receipt);
		else assert.equal(receipt.copiedGraph, undefined);
		for(const [path, source] of Object.entries(files))
		{
			assert.deepEqual(pkg.componentFiles[`compiled/${path}`], identity(source));
			if(path.startsWith("src/") && path.endsWith(".php")) assert.deepEqual(pkg.composerFiles[path], identity(source));
		}
		assert.deepEqual(pkg.componentFiles["compiled/generated.lean"], identity(adapters.leanSource));
		assert.deepEqual(pkg.componentFiles["compiled/component.h"], identity(adapters.header));
		assert.deepEqual(pkg.componentFiles[`compiled/${receipt.library}`], receipt.wasmLibrary);
		for(const [prefix, inventory] of [["component/package/", pkg.componentFiles], ["runtime/package/", pkg.runtimeFiles], ["composer/", pkg.composerFiles]])
			for(const [path, hash] of Object.entries(inventory)) assert.deepEqual(pkg.report.files[prefix + path], hash);
		for(const item of pkg.report.archives)
		{
			assert.match(item.sha256, /^[a-f0-9]{64}$/); assert.ok(item.bytes > 1000);
			assert.deepEqual(pkg.report.files[`archives/${item.archive}`], { bytes: item.bytes, sha256: item.sha256 });
		}
		const npm = `node_modules/${pkg.report.npmSettings.name}`;
		assert.deepEqual(report.installation.installedFiles[npm], pkg.componentFiles);
		assert.equal(report.installation.npmLock.packages[npm].version, pkg.report.npmSettings.version);
		assert.deepEqual(report.installation.installedFiles["node_modules/@lean-bridge/php-wasm-copied-runtime"], pkg.runtimeFiles);
		if(pkg.artifact !== "cedar-conflict") assert.deepEqual(report.installation.installedFiles[`vendor/${pkg.composer.name}`], pkg.composerFiles);
	}
	const [first, , , conflicting] = report.packages;
	assert.equal(first.model.component.id, conflicting.model.component.id);
	assert.notEqual(first.receipt.wasmLibrary.sha256, conflicting.receipt.wasmLibrary.sha256);
	assert.notEqual(first.report.componentIdentity, conflicting.report.componentIdentity);
	for(const key of ["offline", "emptyCaches", "relocated", "originalArchives"]) assert.equal(report.installation[key], true);
	validateBrickMathInstall(report.installation.composer, report.deploymentFiles);
	assert.equal(report.installation.host.manifest.version, "0.1.0");
	for(const [prefix, inventory] of Object.entries({ ...report.installation.installedFiles, "node_modules/php-wasm": report.installation.host.files }))
		for(const [path, hash] of Object.entries(inventory)) assert.deepEqual(report.deploymentFiles[`${prefix}/${path}`], hash);
	assert.equal(report.probe.sourceSha256, sha256(report.probe.source));
	assert.deepEqual(report.deploymentFiles["probe.so"], { bytes: report.probe.bytes, sha256: report.probe.sha256 });
	assert.equal(report.runnerSha256, report.deploymentFiles["host.mjs"].sha256);
	assert.equal(report.browserRunnerSha256, report.deploymentFiles["browser.mjs"].sha256);
	assert.deepEqual(report.composition.map(({ arrangement, loading, mode, order }) => [arrangement, loading, mode, order]), ["embedded", "composer", "bundled"].flatMap(arrangement => ["startup", "lazy", "mixed"].flatMap(loading => ["weak", "strict"].flatMap(mode => ["graph-first", "peer-first"].map(order => [arrangement, loading, mode, order])))));
	for(const run of report.composition) assertPhpWasmGraphComposition(run, report.packages, report.runtimeManifest);
	assert.deepEqual(report.conflicts.map(run => [run.loading, run.first]), ["startup", "lazy"].flatMap(loading => [0, 3].map(first => [loading, first])));
	for(const run of report.conflicts)
	{
		assert.equal(run.code, "php-wasm-component-conflict"); assert.equal(run.rejectedBeforeFetch, true); assert.equal(run.isolatedBuildUsable, true);
		assert.equal(run.value, run.first === 0 ? "41" : "99");
		assert.deepEqual(run.libraries, [basename(report.runtimeManifest.library), basename(report.packages[run.first].receipt.library)].sort());
	}
	assert.deepEqual(report.failures.map(run => [run.failure, run.mode]), ["disabled", "unregistered", "missing-component", "missing-runtime"].flatMap(failure => ["weak", "strict"].map(mode => [failure, mode])));
	for(const run of report.failures)
	{
		assert.equal(run.noRetry, true); assert.equal(run.handlerRestored, true); assert.equal(run.interpreterSurvived, true);
		assert.equal(run.messages.length, 4); assert.equal(run.libraries.length, run.afterFirst);
		if(run.failure.startsWith("missing-"))
		{
			assert.ok(run.afterFirst > 0); assert.equal(new Set(run.messages).size, 1);
			assert.match(run.messages[0], /create a new PHP instance/);
		}
		else
		{
			assert.equal(run.afterFirst, 0);
			for(const message of run.messages) assert.match(message, run.failure === "disabled" ? /enable_dl=1/ : /Register this package lazy descriptor/);
		}
	}
	assert.deepEqual(report.browser.executions.map(run => [run.loading, run.mode]), ["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => [loading, mode])));
	for(const configuration of report.browser.executions)
	{
		assert.equal(configuration.realm, "chromium"); assert.equal(configuration.arrangement, "bundled");
		assert.deepEqual(configuration.executions.map(run => run.order), ["graph-first", "peer-first"]);
		for(const run of configuration.executions)
		{
			assert.equal(run.loading, configuration.loading); assert.equal(run.mode, configuration.mode);
			assertPhpWasmGraphComposition(run, report.packages, report.runtimeManifest);
		}
		const hashes = new Set(configuration.requests.map(item => item.sha256));
		for(const pkg of report.packages.slice(0, 3))
		{
			assert.ok(hashes.has(pkg.receipt.wasmLibrary.sha256));
			for(const [path, hash] of Object.entries(pkg.componentFiles).filter(([path]) => path.startsWith("compiled/src/") && path.endsWith(".php"))) assert.ok(hashes.has(hash.sha256), path);
		}
		assert.ok(hashes.has(report.probe.sha256));
		assert.ok(hashes.has(report.runtimeManifest.files[report.runtimeManifest.library].sha256));
	}
};

/**
 * Preserve the earlier receipt and require new compiled and installed observations.
 *
 * @param record - Retained reproduction/loading reports, source identities and logs.
 */
export const assertPhpWasmGraphLoadingEvidence = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "recursive-php-wasm-reproduction-and-loading");
	assert.equal(record.finalAcceptance, false);
	assert.deepEqual(record.remaining, ["shared-source-regressions", "cross-language-acceptance"]);
	const bytes = await readFile("docs/evidence/php-wasm-recursive-packages-20260924.json"), original = JSON.parse(bytes);
	assert.equal(record.originalPackageRecordSha256, sha256(bytes));
	await assertPhpWasmGraphPackageEvidence(original);
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), phpWasmGraphLoadingEvidenceSources);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	assert.equal(record.reproductionSha256, sha256(canonicalJson(record.reproduction)));
	assert.equal(record.loadingSha256, sha256(canonicalJson(record.loading)));
	const reproduction = record.reproduction;
	assert.equal(reproduction.schemaVersion, 1); assert.equal(reproduction.originalReportSha256, original.reportSha256);
	for(const key of ["freshRuntime", "freshProjects", "freshCompilation", "originalArchivesReproduced"]) assert.equal(reproduction[key], true);
	assert.deepEqual(reproduction.comparisons, comparePhpWasmGraphBuilds(original.report, reproduction.rebuilt));
	for(const run of reproduction.rebuilt.observations)
	{
		assert.equal(run.authorRemoved, true); assert.equal(run.sourceUnchanged, true);
		for(const configuration of run.browser.executions)
		{
			const hashes = new Set(configuration.requests.map(item => item.sha256));
			const npm = `node_modules/${run.archives[1].name}`;
			for(const [path, hash] of Object.entries(run.installedFiles[npm]).filter(([path]) => path.startsWith("compiled/src/") && path.endsWith(".php"))) assert.ok(hashes.has(hash.sha256), path);
			assert.ok(hashes.has(run.receipt.wasmLibrary.sha256));
			assert.ok(hashes.has(reproduction.rebuilt.runtimeManifest.files[reproduction.rebuilt.runtimeManifest.library].sha256));
		}
	}
	assertInstalledLoading(record.loading);
	for(const [path, hash] of Object.entries(record.loading.files)) assert.equal(hash, sha256(await readFile(`tests/fixtures/structured-types/${path}`)));
	completeLog(record.logs.reproduction, "independent recursive PHP-Wasm builds reproduce the installed npm and Composer archives");
	completeLog(record.logs.loading, "installed recursive and acyclic PHP-Wasm packages share initialization, loading and retirement");
	completeLog(record.logs.registration, "numeric test flags preserve the original verifier hashes and reject unrelated edits");
};
