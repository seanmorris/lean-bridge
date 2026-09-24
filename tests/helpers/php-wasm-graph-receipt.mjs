/**
 * Retain compiler-authenticated graph sources and installed wasm32 observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmGraph } from "../../src/build/php-wasm-graph-component.mjs";
import { phpWasmCopiedPins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { assertAdministrativeSourceUpdate } from "./test-registration-history.mjs";

export const phpWasmGraphPackageEvidenceSources = [
	"src/build/php-wasm-graph-model.mjs"
	, "src/build/php-wasm-graph-component.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/build/php-wasm-project.mjs", "src/build/elaborated-component.mjs"
	, "src/build/native-allocation-guard.mjs"
	, "src/build/native-model.mjs", "src/build/component-recursive-lean.mjs"
	, "src/backends/c/copied-graph-layout.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/native/runtime-broker.mjs"
	, "src/backends/php/copied-graph-zend.mjs"
	, "src/backends/php/copied-graph-zend-runtime.mjs"
	, "src/backends/php/copied-graph-wire.mjs"
	, "src/backends/php/copied-graph-values.mjs"
	, "src/backends/php/copied-graph-scalars.mjs"
	, "src/backends/php/copied-graph-walk.mjs"
	, "src/backends/php/copied-zend-conversions.mjs"
	, "src/backends/php/copied-zend-support.mjs"
	, "src/backends/php/php-wasm-copied-host.mjs"
	, "src/backends/php/php-wasm-copied-loader.mjs"
	, "src/backends/php/brick-math.mjs"
	, "src/backends/php/brick-math.source.json"
	, "src/release/php-wasm-copied-package.mjs"
	, "src/release/deterministic-archive.mjs"
	, "src/release/deterministic-zip.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/native-metadata.mjs", "src/analyze/semantic-model.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "tests/php-wasm-graph-package.test.mjs"
	, "tests/helpers/php-wasm-graph-packages.mjs"
	, "tests/helpers/php-wasm-graph-browser.mjs"
	, "tests/helpers/php-wasm-graph-receipt.mjs"
	, "tests/helpers/type-corpus-php-wasm-browser.mjs"
	, "tests/helpers/type-corpus-php-wasm-install.mjs"
	, "tests/helpers/native-recursive-transport.mjs"
	, "tests/helpers/native-recursive-reviewed.mjs"
	, "tests/helpers/recursive-fixture.mjs"
	, "tests/helpers/brick-math.mjs"
	, "tests/fixtures/onboarding/npm-recursive/Recursive.lean"
	, "tests/fixtures/structured-types/recursive-php-wasm-installed.php"
	, "package.json", "config/cli-package.v1.json"
	, "config/checked-javascript.json", "nix/perl-engine-source-boundary.json"
	, "src/adoption/test-profiles.mjs", ".github/workflows/consumer-matrix.yml"
].sort();

const preimages = {
	"src/build/php-wasm-copied-component.mjs": "d7a1b118717e7c5988d02696ad66fe53fec8a7697833e57dd311407fd599a5cc"
	, "src/build/php-wasm-copied-artifacts.mjs": "0fd9d83967e52bfa25da901dc0a6acfedfb861707ad154639128334b3fe273f2"
	, "src/release/php-wasm-copied-package.mjs": "17e8964ef26a90fffc334cf970206f74f6f222367fba3ffc0157c2b5c3e79abc"
	, "src/backends/php/php-wasm-copied-host.mjs": "bf82d936b654e17662aece07bb5f332c589a3c82e1d0fd1ffbf14f4fcc448b36"
};
const identity = source => ({ bytes: Buffer.byteLength(source), sha256: sha256(source) });
const observed = value => {
	assert.deepEqual(value, { actualPhpBits: 32, checks: 1448, compiledLean: true, exports: 18, hostVersion: "8.4.1", installedPackage: true, rejections: 35 });
};

/**
 * Reconstruct the actual installed graph API without promoting final acceptance.
 *
 * @param record - Frozen build observations, source hashes and passing test log.
 */
export const assertPhpWasmGraphPackageEvidence = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "recursive-php-wasm-installed-packages");
	assert.equal(record.installedPackage, true); assert.equal(record.finalAcceptance, false);
	assert.deepEqual(record.remaining, ["independent-build-reproduction", "shared-loading", "shared-source-regressions", "cross-language-acceptance"]);
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), phpWasmGraphPackageEvidenceSources);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	assert.deepEqual(Object.keys(record.preAdmissionSources).sort(), Object.keys(preimages).sort());
	for(const [path, hash] of Object.entries(preimages))
	{
		assert.equal(record.preAdmissionSources[path].sha256, hash);
		assert.equal(sha256(record.preAdmissionSources[path].source), hash);
	}
	const report = record.report;
	assert.equal(record.reportSha256, sha256(canonicalJson(report)));
	assert.equal(report.schemaVersion, 1); assert.equal(report.installedPackage, true); assert.equal(report.compiledLean, true);
	assert.equal(report.runtimeIdentity, sha256(canonicalJson(report.runtimeManifest)));
	assert.deepEqual(report.runtimeManifest.pins, phpWasmCopiedPins); assert.equal(report.runtimeManifest.pointerBits, 32);
	assert.deepEqual(report.allocationGuard.map(item => item.accepted), [true, true, true, false, false, false, false, false, false]);
	for(const item of report.allocationGuard)
	{
		const source = `#include "allocation-guard.h"\nlean_object *probe(unsigned count) { (void)count; return lean_alloc_ctor(0, ${item.objects}, ${item.scalars}); }\n`;
		assert.equal(item.sourceSha256, sha256(source));
		if(item.expected) assert.ok(item.diagnostic.includes(item.expected)); else assert.equal(item.diagnostic, "");
	}
	assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	for(const run of report.observations)
	{
		const { model, metadata, receipt } = run;
		assert.deepEqual(model, createCompiledPhpWasmModel({ metadata, component: model.component, sourceIdentity: receipt.sourceIdentity }));
		assert.equal(model.schemaVersion, run.reviewed ? 5 : 4); assert.equal(model.pointerBits, 32);
		assert.equal(model.exports.length, 18); assert.equal(receipt.runtimeIdentity, report.runtimeIdentity);
		assert.equal(receipt.modelSha256, sha256(canonicalJson(model))); assert.equal(receipt.metadataSha256, sha256(canonicalJson(metadata)));
		assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
		const adapters = generateCompiledPhpWasmLeanAdapters(model), graph = generateCompiledPhpWasmGraph(model, adapters);
		assert.deepEqual(receipt.copiedGraph, graph.receipt); assert.deepEqual(run.generatedManifest, graph.manifest);
		assert.equal(receipt.headerSha256, sha256(adapters.header)); assert.equal(receipt.adaptersSha256, sha256(adapters.leanSource));
		assert.equal(receipt.zendSha256, sha256(graph.files[graph.zendManifestPath]));
		assert.deepEqual(run.archives.map(item => [item.ecosystem, item.role]), [["npm", "runtime"], ["npm", "component"], ["composer", "api"]]);
		for(const archive of run.archives)
		{ assert.ok(archive.bytes > 1000); assert.match(archive.sha256, /^[0-9a-f]{64}$/); }
		const npm = `node_modules/${run.archives[1].name}`, composer = `vendor/${run.archives[2].name}`;
		for(const [path, source] of Object.entries({ ...graph.files, "component.h": adapters.header, "generated.lean": adapters.leanSource }))
		{
			assert.deepEqual(run.installedFiles[npm][`compiled/${path}`], identity(source));
			if(path.startsWith("src/") && path.endsWith(".php")) assert.deepEqual(run.installedFiles[composer][path], identity(source));
		}
		assert.deepEqual(run.installedFiles[npm][`compiled/${receipt.library}`], receipt.wasmLibrary);
		assert.equal(run.npmLock.packages[npm].version, run.archives[1].version);
		assert.equal(run.npmLock.packages["node_modules/php-wasm"].version, "0.1.0");
		assert.equal(run.host.manifest.version, "0.1.0"); assert.match(run.host.archiveSha256, /^[0-9a-f]{64}$/);
		assert.deepEqual(run.composer.lock.packages.map(item => item.name), ["brick/math", run.archives[2].name]);
		assert.deepEqual(run.executions.map(item => [item.arrangement, item.loading, item.mode]), ["embedded", "composer", "bundled"].flatMap(arrangement => ["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => [arrangement, loading, mode]))));
		for(const item of run.executions)
		{
			observed(item.observed); assert.equal(item.repeatedRequests, 20); assert.equal(item.invalidStayedCold, true);
			assert.deepEqual([...item.libraries].sort(), [basename(report.runtimeManifest.library), basename(receipt.library)].sort());
		}
		assert.deepEqual(run.browser.executions.map(item => [item.loading, item.mode]), ["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => [loading, mode])));
		for(const item of run.browser.executions)
		{
			observed(item.observed); assert.equal(item.realm, "chromium"); assert.equal(item.arrangement, "bundled"); assert.equal(item.repeatedRequests, 20);
			assert.deepEqual(item.phases.map(phase => phase.libraries.length), item.loading === "lazy" ? [0, 0, 0, 2] : [2, 2, 2, 2]);
			const requested = new Set(item.requests.map(request => request.sha256));
			for(const source of Object.entries(graph.files).filter(([path]) => path.startsWith("src/") && path.endsWith(".php")).map(([, source]) => source)) assert.ok(requested.has(sha256(source)), "Browser did not fetch an installed PHP graph source");
			assert.ok(requested.has(receipt.wasmLibrary.sha256)); assert.ok(requested.has(report.runtimeManifest.files[report.runtimeManifest.library].sha256));
		}
		assert.deepEqual(run.rejectedArtifacts, ["graph-receipt", "graph-receipt", "graph-receipt", "src/Api.php", "src/Internal/Native.php", "src/Internal/Values.php", "src/Internal/GraphTypes.php", "src/Internal/Wire.php", "graph/transport.c", "graph/runtime.c", "graph/allocation-guard.h", "include/recursive-graph-types.h", "include/recursive-graph.h"]);
		assert.equal(run.sourceUnchanged, true); assert.equal(run.authorRemoved, true); assert.equal(run.compilerFreeReassembly, true);
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/structured-types/recursive-php-wasm-installed.php")));
	}
	assert.deepEqual(report.observations[0].archives[0], report.observations[1].archives[0]);
	assert.equal(sha256(record.executionLog.text), record.executionLog.sha256);
	assert.match(record.executionLog.text, /ok \d+ - ordinary and reviewed recursive PHP-Wasm packages execute after offline installation\n/);
	assert.match(record.executionLog.text, /# fail 0\n# cancelled 0\n# skipped 0/);
};
