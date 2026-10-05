/**
 * Reconstruct compiled lifetime contracts and require real installed execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedWitPackage } from "../../src/backends/wit/owned-package.mjs";
import { guardOwnedWitHostSource } from "../../src/backends/wit/owned-host-evidence.mjs";
import { ownedRustBorrowSource } from "./owned-rust-borrow-fixture.mjs";
import { ownedWitBorrowProbe, ownedWitBorrowNativeSource } from "./wit-owned-borrow-probe.mjs";
import { ownedWitBorrowMutations } from "./wit-owned-borrow-mutants.mjs";
import { assertOwnedWitBorrowCi } from "./wit-owned-borrow-ci.mjs";
import { ownedReceiverHistoricalBytes } from "./owned-receiver-history.mjs";

export const ownedWitBorrowCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-wit-borrows";
export const ownedWitBorrowScope = Object.freeze({
	profiles: ["wit-wasi"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, generatedComponent: true, installedCli: true
	, installedPackages: true, publicExports: 26, anchoredResults: 19
	, consumingExports: 4, pointerBits: 64, compiledModel: 9, ownedGraph: 4
	, originalOwnerAnchors: true, transitiveExpiration: true
	, independentRetains: true, canonicalIdentity: true, recursiveValues: true
	, emptyValues: true, borrowOnlyExecuted: true, callbackReentry: true
	, maximumBorrowDepth: 128
	, returnedClosures: true, allocationFaults: true
	, sanitizers: ["address", "undefined"], compiledNegativeVariants: 9
	, sourceFreeInstallation: true, offlineInstall: true, relocated: true
	, pkgConfig: true, cmake: true, loadedLibraryIsolation: true
	, documentationExecuted: true, combinedCRelease: true
	, deterministicReassembly: true, independentRebuild: true
	, receiverAnchors: false, callbackResultAnchors: false
	, callerOwnedStores: false, standaloneWasi: false
	, docker: false, installedSupportPromotions: 0
});
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };

/**
 * Verify generated sources, immutable artifact identities and execution reports.
 *
 * @param record - Complete source-bound enabled-gate receipt.
 */
export const assertOwnedWitBorrowExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedWitBorrowScope);
	assert.equal(record.run.command, ownedWitBorrowCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 8, pass: 8, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	for(const field of ["runtime", "borrowOnly", "packages"])
		assert.deepEqual(record[field].map(item => item.mode), ["ordinary", "reviewed"]);
	const base = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const checkInput = (input, mode, borrowOnly = false) => {
		flags(input, ["hostCallbacks", "anchoredResults"]);
		assert.equal(input.transferredInputs, !borrowOnly);
		assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
		assert.equal(input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(base + (borrowOnly ? "" : ownedRustBorrowSource)));
	};
	for(const item of [...record.runtime, ...record.borrowOnly])
	{
		const borrowOnly = record.borrowOnly.includes(item);
		assert.equal(item.schemaVersion, 1); assert.equal(item.borrowOnly, borrowOnly);
		checkInput(item.input, item.mode, borrowOnly);
		const component = Buffer.from(item.componentBase64, "base64");
		assert.equal(component.toString("base64"), item.componentBase64);
		assert.equal(sha256(component), item.componentSha256);
		const generated = generateOwnedWitPackage(item.input, component);
		assert.equal(item.sourceSha256, sha256(generated.source));
		assert.equal(item.probeSha256, sha256(await ownedWitBorrowProbe(generated, false, borrowOnly)));
		assert.deepEqual(item.manifest, generated.model.manifest);
		assert.equal(generated.layout.functions.length, borrowOnly ? 22 : 26);
		assert.equal(item.manifest.graph.schemaVersion, 2);
		assert.equal(item.manifest.graph.resultAnchors.length, borrowOnly ? 18 : 19);
		if(borrowOnly) assert.equal(item.manifest.graph.inputTransfers, undefined);
		else assert.equal(item.manifest.graph.inputTransfers.length, 4);
		assert.equal(item.counts.exports, borrowOnly ? 4 : 26);
		assert.ok(item.counts.componentCalls > 100);
		assert.equal(item.counts.nativeImports, item.counts.componentCalls);
		assert.ok(item.counts.leanCalls > 100 && item.counts.leanCalls <= item.counts.nativeImports);
		assert.ok(item.result.checks > 1000 && item.result.failures > 0);
		if(borrowOnly)
		{ assert.equal(item.result.emptyShapes, 4); assert.equal(item.result.maximumBorrowDepth, 128); }
		else assert.ok(item.result.beforeFailures > 0 && item.result.afterFailures > 0);
		assert.equal(item.result.live, 0); assert.equal(item.result.identities, 0);
		assert.equal(item.sanitizer, "address,undefined");
		assert.equal(typeof item.startupLeakBaseline, "string");
		assert.doesNotMatch(item.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:/u);
		const implementation = ownedWitBorrowNativeSource(generated);
		assert.deepEqual(item.mutations, borrowOnly ? [] : ownedWitBorrowMutations.map(([name, before, after]) => {
			assert.ok(implementation.includes(before));
			return { name, compiled: true, semanticRejection: true, sourceSha256: sha256(implementation.replaceAll(before, after)) };
		}));
	}
	const page = await readFile("docs/consume/wit-wasi.md", "utf8");
	const example = page.split("### Borrowed results\n")[1]?.split("```c\n")[1]?.split("```")[0];
	assert.ok(example);
	const loaderSource = await readFile("tests/fixtures/structured-types/wit-owned-package-loader.c");
	for(const item of record.packages)
	{
		assert.equal(item.schemaVersion, 1); checkInput(item.inputs, item.mode);
		flags(item, ["sourceRemovedBeforeInstall", "relocated", "deterministicReassembly", "independentRebuild", "pkgConfig", "cmake"]);
		assert.deepEqual(item.targets, item.mode === "ordinary" ? ["wit-wasi"] : ["wit-wasi", "c"]);
		assert.equal(item.cliRemovedBeforeConsumerInstall, true);
		flags(item.installedCli, ["offlineInstall", "packagingSourceRemoved"]);
		const { report } = item.installedCli;
		const { archive: cliArchive, inventorySha256, externalRegistryWrites, ...inventory } = report;
		assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "lean-bridge-cli-package");
		assert.equal(report.productionApproved, false); assert.equal(externalRegistryWrites, false);
		assert.equal(inventorySha256, sha256(canonicalJson(inventory)));
		digest(cliArchive.sha256); assert.ok(cliArchive.bytes > 0);
		assert.equal(item.installedCli.filesVerified, report.files.length);
		const cliConfig = JSON.parse(ownedReceiverHistoricalBytes("config/cli-package.v1.json", await readFile("config/cli-package.v1.json"), record.sources["config/cli-package.v1.json"]).toString());
		assert.deepEqual(report.package, { name: cliConfig.name, version: cliConfig.version });
		assert.equal(report.files.length, cliConfig.files.length + 2);
		assert.equal(new Set(report.files.map(file => file.path)).size, report.files.length);
		for(const path of cliConfig.files)
		{
			const file = report.files.find(entry => entry.path === path);
			assert.ok(file, path);
			const bytes = Buffer.from(ownedReceiverHistoricalBytes(path, await readFile(path), file.sha256));
			assert.ok(file, path); assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, sha256(bytes), path);
		}
		assert.equal(item.cliBuilds.length, 2);
		for(const build of item.cliBuilds)
		{ assert.equal(build.status, "ok"); assert.deepEqual(build.result.targets, [...item.targets].sort()); }
		assert.equal(item.cliVerification.status, "ok");
		assert.equal(item.cliVerification.result.verificationType, "local-package-set");
		assert.equal(item.model.schemaVersion, 9); assert.equal(item.model.pointerBits, 64);
		assert.equal(item.model.ownedGraph.schemaVersion, 4); assert.equal(item.model.exports.length, 26);
		assert.equal(item.receipt.ownedValues.schemaVersion, 3);
		assert.deepEqual(item.receipt.ownedValues.inputTransfers, item.model.ownedGraph.inputTransfers);
		assert.deepEqual(item.receipt.ownedValues.resultAnchors, item.model.ownedGraph.resultAnchors);
		assert.equal(item.model.ownedGraph.inputTransfers.exports.length, 4);
		assert.equal(item.model.ownedGraph.resultAnchors.exports.length, 19);
		assert.deepEqual(item.manifest.ownedValues, item.receipt.ownedValues);
		assert.equal(item.manifest.bindingIrSha256, item.model.bindingIrSha256);
		assert.equal(item.manifest.runtimeIdentity, item.receipt.runtimeIdentity);
		const component = Buffer.from(item.componentBase64, "base64");
		assert.equal(component.toString("base64"), item.componentBase64);
		assert.equal(sha256(component), item.manifest.componentSha256);
		const generated = generateOwnedWitPackage(item.inputs, component, item.receipt.settings);
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
		assert.equal(archive.archive, "owned-borrows-1.2.3-wit-wasi.tar.gz");
		assert.equal(archive.compilerAccess, false); digest(archive.sha256); assert.ok(archive.bytes > 0);
		if(item.mode === "reviewed") assert.ok(item.packages.some(archive => archive.archive.endsWith("-c.tar.gz")));
		flags(item.installed, ["compilerFreePath", "offlineInstall"]);
		assert.ok(item.installed.checks > 500); assert.equal(item.rejected, Object.keys(generated.files).length + 3 + 6);
		assert.ok(record.run.text.includes(`${item.mode}: ${item.installed.checks} installed checks, ${item.rejected} rejected mutations, pkg-config and relocated CMake passed`));
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), stdout: "42\nexpired\n42\n" });
		const macros = [
			["OPTION", "echoOption"], ["ARRAY", "echoArray"], ["LIST", "echoList"]
			, ["RESULT", "echoResult"], ["TUPLE", "echoTuple"]
			, ["ROW", "echoRow"], ["NESTED", "echoNested"]
		].map(([macro, name]) => {
			const id = generated.values.functions.find(fn => fn.name === name).parameters[0];
			return `#define COPY_${macro} ${generated.values.copies.find(fn => fn.id === id).cName}\n`;
		}).join("");
		assert.equal(item.probeSha256, sha256((await ownedWitBorrowProbe(generated, true)).replace('#include "borrow-copies.h"', macros)));
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
	assert.deepEqual(record.packages[0].installedCli.report, record.packages[1].installedCli.report);
	assertOwnedWitBorrowCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
