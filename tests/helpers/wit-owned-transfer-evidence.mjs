/**
 * Authenticate compiled moves and source-free installed WIT transfer evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedWitPackage } from "../../src/backends/wit/owned-package.mjs";
import { guardOwnedWitHostSource } from "../../src/backends/wit/owned-host-evidence.mjs";
import { ownedRustTransferSource } from "./owned-rust-transfer-fixture.mjs";
import { assertOwnedWitTransferCi } from "./wit-owned-transfer-ci.mjs";
import { ownedWitTransferProbe } from "./wit-owned-transfer-probe.mjs";

export const ownedWitTransferCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-wit-transfers";
export const ownedWitTransferScope = Object.freeze({
	profiles: ["wit-wasi"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedPackages: true, generatedComponent: true
	, publicExports: 26, consumingExports: 20, pointerBits: 64
	, wholeOwners: true, independentRetains: true, callbackReentry: true
	, recursiveValues: true, mixedValues: true, multipleInputHandoffs: true
	, allocationFaults: true, sanitizers: ["address", "undefined"]
	, malformedResults: true, missingTransferFrames: true, mutationChecks: true
	, sourceFreeInstallation: true, offline: true, relocated: true
	, pkgConfig: true, cmake: true, loadedLibraryIsolation: true
	, documentationExecuted: true, combinedCRelease: true
	, deterministicReassembly: true, independentRebuild: false
	, transferredInputs: true, anchoredBorrowedResults: false
	, callerOwnedStores: false, standaloneWasi: false
	, docker: false, installedSupportPromotions: 0
});
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };

/**
 * Regenerate the recorded adapters and check every claimed execution path.
 *
 * @param record - Source-bound runtime and installed execution receipt.
 */
export const assertOwnedWitTransferExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedWitTransferScope);
	assert.equal(record.run.command, ownedWitTransferCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 5, pass: 5, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.packages.map(item => item.mode), ["ordinary", "reviewed"]);
	const diagnostics = record.run.text.split("\n").filter(line => line.startsWith("# {")).map(line => JSON.parse(line.slice(2)));
	assert.deepEqual(diagnostics, record.runtime.map(item => ({ mode: item.mode, ...item.report, ...item.counts })));
	const source = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + ownedRustTransferSource;
	const checkInputs = (input, mode) => {
		flags(input, ["hostCallbacks", "transferredInputs"]);
		assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
		assert.equal(input.sourceIdentity.modules.find(item => item.module === "Owned").source.sha256, sha256(source));
	};
	for(const item of record.runtime)
	{
		assert.equal(item.schemaVersion, 1); checkInputs(item.input, item.mode);
		const component = Buffer.from(item.componentBase64, "base64");
		assert.equal(component.toString("base64"), item.componentBase64);
		assert.equal(sha256(component), item.componentSha256);
		const generated = generateOwnedWitPackage(item.input, component);
		assert.equal(item.sourceSha256, sha256(generated.source));
		assert.equal(item.probeSha256, sha256(await ownedWitTransferProbe(generated)));
		assert.deepEqual(item.manifest, generated.model.manifest);
		assert.equal(generated.layout.functions.length, 26);
		assert.equal(item.manifest.graph.inputTransfers.length, 20);
		assert.equal(item.counts.exports, 26);
		assert.ok(item.counts.componentCalls > 100);
		assert.equal(item.counts.nativeImports, item.counts.componentCalls);
		assert.ok(item.counts.leanCalls > 100 && item.counts.leanCalls <= item.counts.nativeImports);
		assert.ok(item.report.checks > 1000);
		assert.ok(item.report.beforeFailures > 0 && item.report.afterFailures > 0);
		assert.equal(item.report.live, 0); assert.equal(item.report.identities, 0);
		assert.equal(item.sanitizer, "address,undefined");
		assert.equal(typeof item.startupLeakBaseline, "string");
		assert.doesNotMatch(item.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:/u);
		flags(item, ["missingTransferFramePreservesOwner", "malformedResultConsumesInputs"]);
		assert.deepEqual(item.rejectedMutations, item.mode === "ordinary" ? [
			"missing-moved-slot", "wrong-owner-membership"
			, "leaked-source-payload", "missing-store-lease-cleanup"
		] : []);
		for(const mutation of item.rejectedMutations) assert.ok(record.run.text.includes("rejected mutation: " + mutation));
	}
	const page = await readFile("docs/consume/wit-wasi.md", "utf8");
	const example = page.split("### Consuming inputs\n")[1]?.split("```c\n")[1]?.split("```")[0];
	assert.ok(example);
	const loaderSource = await readFile("tests/fixtures/structured-types/wit-owned-package-loader.c");
	for(const item of record.packages)
	{
		assert.equal(item.schemaVersion, 1); checkInputs(item.inputs, item.mode);
		flags(item, ["sourceRemovedBeforeInstall", "relocated", "deterministicReassembly", "pkgConfig", "cmake"]);
		assert.deepEqual(item.targets, item.mode === "ordinary" ? ["wit-wasi"] : ["wit-wasi", "c"]);
		assert.equal(item.model.schemaVersion, 8); assert.equal(item.model.pointerBits, 64);
		assert.equal(item.model.exports.length, 26);
		assert.equal(item.receipt.ownedValues.schemaVersion, 2);
		assert.deepEqual(item.receipt.ownedValues.inputTransfers, item.model.ownedGraph.inputTransfers);
		assert.equal(item.model.ownedGraph.inputTransfers.exports.length, 20);
		assert.deepEqual(item.manifest.ownedValues, item.receipt.ownedValues);
		assert.equal(item.manifest.bindingIrSha256, item.model.bindingIrSha256);
		assert.equal(item.manifest.runtimeIdentity, item.receipt.runtimeIdentity);
		const component = Buffer.from(item.componentBase64, "base64");
		assert.equal(component.toString("base64"), item.componentBase64);
		assert.equal(sha256(component), item.manifest.componentSha256);
		const generated = generateOwnedWitPackage(item.inputs, component, item.receipt.settings);
		assert.equal(generated.layout.model.bindingIrSha256, item.model.bindingIrSha256);
		assert.deepEqual(generated.layout.model.bindingIr, item.model.bindingIr);
		assert.deepEqual(item.inputs.sourceIdentity, item.model.sourceIdentity);
		assert.equal(sha256(generated.publicHeader), item.receipt.ownedValues.headerSha256);
		assert.equal(sha256(guardOwnedWitHostSource(generated, item.receipt.dependencies)), item.receipt.ownedValues.sourceSha256);
		assert.ok(Object.keys(item.manifest.files).length > 30);
		for(const file of Object.values(item.manifest.files))
		{ digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
		assert.equal(item.manifest.files[`include/${generated.values.prefix}.h`].sha256, item.receipt.ownedValues.headerSha256);
		const archives = item.packages.filter(archive => archive.archive.endsWith("-wit-wasi.tar.gz"));
		assert.equal(archives.length, 1); const archive = archives[0];
		assert.equal(archive.archive, "owned-transfers-1.2.3-wit-wasi.tar.gz");
		assert.equal(archive.compilerAccess, false); digest(archive.sha256); assert.ok(archive.bytes > 0);
		if(item.mode === "reviewed") assert.ok(item.packages.some(archive => archive.archive.endsWith("-c.tar.gz")));
		flags(item.installed, ["compilerFreePath", "offlineInstall"]);
		assert.equal(item.installed.checks, 522); assert.equal(item.rejected, 11);
		assert.ok(record.run.text.includes(`${item.mode}: 522 installed checks, 11 rejected mutations, pkg-config and relocated CMake passed`));
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), stdout: "42\n" });
		assert.deepEqual(item.manifest.dependencies, item.receipt.dependencies);
		const names = item.receipt.dependencies.map(dependency => dependency.name);
		assert.equal(names.length, 5); assert.equal(new Set(names).size, 5);
		assert.equal(names.filter(name => /^libcomponent_[a-f0-9]{20}\.so$/u.test(name)).length, 1);
		for(const name of ["libgmp.so.10", "liblean_bridge_native.so", "libleanshared.so", "libwasmtime.so"])
			assert.ok(names.includes(name));
		for(const dependency of item.receipt.dependencies)
			assert.deepEqual(item.manifest.files["lib/" + dependency.name], { bytes: dependency.bytes, sha256: dependency.sha256 });
		assert.equal(item.loader.sourceSha256, sha256(loaderSource)); digest(item.loader.executableSha256);
		assert.equal(item.loader.reports.length, 12);
		for(const visibility of ["local", "global"])
		{
			const compatible = item.loader.reports.filter(entry => entry.visibility === visibility && entry.compatibleAndFork);
			assert.equal(compatible.length, 1); assert.equal(compatible[0].conflict, false); assert.ok(compatible[0].checks > 10);
			for(const name of names)
			{
				const failed = item.loader.reports.filter(entry => entry.visibility === visibility && entry.tamperedDependency === name);
				assert.equal(failed.length, 1); assert.equal(failed[0].conflict, true); assert.ok(failed[0].checks > 10);
			}
		}
	}
	assertOwnedWitTransferCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
