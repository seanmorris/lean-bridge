/**
 * Reconstruct receiver contracts and require compiled, installed execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedWitPackage } from "../../src/backends/wit/owned-package.mjs";
import { guardOwnedWitHostSource } from "../../src/backends/wit/owned-host-evidence.mjs";
import { ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";
import { ownedJvmPlainReceiverSource } from "./owned-jvm-receiver-fixture.mjs";
import { ownedReceiverMutants } from "./owned-receiver-mutants.mjs";
import { ownedWitBorrowNativeSource } from "./wit-owned-borrow-probe.mjs";
import { ownedWitBorrowMutations } from "./wit-owned-borrow-mutants.mjs";
import { ownedWitReceiverProbe } from "./wit-owned-receiver-probe.mjs";
import { ownedWitReceiverResourceProbe } from "./wit-owned-receiver-resource-probe.mjs";
import { assertOwnedWitReceiverCi } from "./wit-owned-receiver-ci.mjs";

export const ownedWitReceiverCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-wit-receivers";
export const ownedWitReceiverScope = Object.freeze({
	profiles: ["wit-wasi"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, generatedComponent: true, installedCli: true
	, installedPackages: true, publicExports: 27, members: 16, anchoredResults: 20
	, consumingExports: 4, pointerBits: 64, compiledModel: 10, ownedGraph: 5
	, originalReceiverOwners: true, remainingParameterOwners: true
	, transitiveExpiration: true, independentRetains: true, canonicalIdentity: true
	, recursiveValues: true, emptyValues: true, unitProperties: true
	, resourceOnlyConfigurations: ["plain", "consuming"]
	, unanchoredCallbacks: true, callbackReentry: true, returnedClosures: true
	, allocationFaults: true, sanitizers: ["address", "undefined"]
	, compiledNegativeVariants: 10, sourceFreeInstallation: true
	, offlineInstall: true, relocated: true, pkgConfig: true, cmake: true
	, loadedLibraryIsolation: true, documentationExecuted: true
	, combinedCRelease: true, deterministicReassembly: true
	, independentRebuild: true
	, callbackResultAnchors: false, callerOwnedStores: false, standaloneWasi: false
	, docker: false, installedSupportPromotions: 0
});
const digest = value => { assert.match(value, /^[a-f0-9]{64}$/u); assert.notEqual(value, "0".repeat(64)); };
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const optionalOrder = ["ordinary", "reviewed"].flatMap(mode => ["plain", "consuming", "unanchored"].map(kind => [mode, kind]));
const inputModel = (input, mode, kind, base, installed = false) => {
	assert.equal(input.receiverExports, true); assert.equal(input.anchoredResults, kind === "full");
	assert.equal(input.hostCallbacks, installed || ["full", "unanchored"].includes(kind));
	assert.equal(input.transferredInputs, kind !== "plain");
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const suffix = ["plain", "consuming"].includes(kind) ? ownedJvmPlainReceiverSource : ownedRustReceiverSource;
	assert.equal(input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(base + suffix));
	const model = createCompiledNativeModel(input, { ownedGraphs: true
		, ownedHostCallbacks: input.hostCallbacks
		, ownedInputTransfers: input.transferredInputs
		, ownedAnchoredResults: input.anchoredResults, ownedReceiverExports: true });
	assert.equal(model.schemaVersion, 10); assert.equal(model.pointerBits, 64);
	assert.equal(model.ownedGraph.schemaVersion, 5);
	assert.equal(model.exports.length, kind === "plain" ? 4 : kind === "consuming" ? 5 : 27);
	assert.equal(model.ownedGraph.receiverExports.exports.length, kind === "plain" ? 3 : kind === "consuming" ? 4 : 16);
	if(kind === "full") assert.equal(model.ownedGraph.resultAnchors.exports.length, 20);
	else assert.equal(model.ownedGraph.resultAnchors, undefined);
	if(kind === "plain") assert.equal(model.ownedGraph.inputTransfers, undefined);
	else assert.equal(model.ownedGraph.inputTransfers.exports.length, kind === "consuming" ? 1 : 4);
	return model;
};
const componentBytes = item => {
	const bytes = Buffer.from(item.componentBase64, "base64");
	assert.equal(bytes.toString("base64"), item.componentBase64);
	assert.equal(sha256(bytes), item.componentSha256 ?? item.manifest.componentSha256);
	return bytes;
};
const checkCli = async item => {
	flags(item.installedCli, ["offlineInstall", "packagingSourceRemoved"]);
	assert.equal(item.cliRemovedBeforeConsumerInstall, true);
	const { report } = item.installedCli;
	const { archive, inventorySha256, externalRegistryWrites, ...inventory } = report;
	assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "lean-bridge-cli-package");
	assert.equal(report.productionApproved, false); assert.equal(externalRegistryWrites, false);
	assert.equal(inventorySha256, sha256(canonicalJson(inventory)));
	digest(archive.sha256); assert.ok(archive.bytes > 0);
	assert.equal(item.installedCli.filesVerified, report.files.length);
	const config = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	assert.deepEqual(report.package, { name: config.name, version: config.version });
	assert.equal(report.files.length, config.files.length + 2);
	assert.equal(new Set(report.files.map(file => file.path)).size, report.files.length);
	for(const path of config.files)
	{
		const file = report.files.find(entry => entry.path === path), bytes = await readFile(path);
		assert.ok(file, path); assert.equal(file.bytes, bytes.length, path); assert.equal(file.sha256, sha256(bytes), path);
	}
	assert.deepEqual(item.targets, item.mode === "ordinary" ? ["wit-wasi"] : ["wit-wasi", "c"]);
	assert.equal(item.cliBuilds.length, 2);
	for(const build of item.cliBuilds)
	{ assert.equal(build.status, "ok"); assert.deepEqual(build.result.targets, [...item.targets].sort()); }
	assert.equal(item.cliVerification.status, "ok");
	assert.equal(item.cliVerification.result.verificationType, "local-package-set");
};
const checkLoader = (item, source) => {
	assert.deepEqual(item.manifest.dependencies, item.receipt.dependencies);
	const names = item.receipt.dependencies.map(dependency => dependency.name);
	assert.equal(names.length, 5); assert.equal(new Set(names).size, 5);
	assert.equal(names.filter(name => /^libcomponent_[a-f0-9]{20}\.so$/u.test(name)).length, 1);
	for(const name of ["libgmp.so.10", "liblean_bridge_native.so", "libleanshared.so", "libwasmtime.so"])
		assert.ok(names.includes(name));
	for(const dependency of item.receipt.dependencies)
		assert.deepEqual(item.manifest.files["lib/" + dependency.name], { bytes: dependency.bytes, sha256: dependency.sha256 });
	assert.equal(item.loader.sourceSha256, sha256(source)); digest(item.loader.executableSha256);
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
};

/**
 * Verify generated contracts, source identities and every enabled report.
 *
 * @param record - Complete source-bound acceptance receipt.
 */
export const assertOwnedWitReceiverExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedWitReceiverScope);
	assert.equal(record.run.command, ownedWitReceiverCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 20, pass: 20, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	for(const field of ["runtime", "packages"]) assert.deepEqual(record[field].map(item => item.mode), ["ordinary", "reviewed"]);
	for(const field of ["resources", "resourcePackages"]) assert.deepEqual(record[field].map(item => [item.mode, item.kind]), optionalOrder);
	const base = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	for(const item of [...record.runtime, ...record.resources])
	{
		const kind = item.kind ?? "full", full = kind === "full";
		assert.equal(item.schemaVersion, 1);
		assert.deepEqual(item.native, inputModel(item.input, item.mode, kind, base));
		const generated = generateOwnedWitPackage(item.input, componentBytes(item));
		assert.equal(item.sourceSha256, sha256(generated.source));
		const probe = full ? await ownedWitReceiverProbe(generated) : await ownedWitReceiverResourceProbe(generated, kind);
		assert.equal(item.probeSha256, sha256(probe));
		assert.deepEqual(item.manifest, generated.model.manifest);
		assert.equal(item.manifest.graph.schemaVersion, 3);
		assert.equal(item.sanitizer, "address,undefined");
		assert.equal(typeof item.startupLeakBaseline, "string");
		assert.doesNotMatch(item.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:/u);
		if(full)
		{
			assert.deepEqual(item.result, { checks: 8103, live: 0, identities: 0, failures: 13, beforeFailures: 9, afterFailures: 7 });
			assert.deepEqual(item.counts, { componentCalls: 337, nativeImports: 337, leanCalls: 334, exports: 27 });
			const implementation = ownedWitBorrowNativeSource(generated);
			const expected = ownedWitBorrowMutations.map(([name, before, after]) => {
				assert.ok(implementation.includes(before));
				return { name, compiled: true, semanticRejection: true, sourceSha256: sha256(implementation.replaceAll(before, after)) };
			});
			const offset = ownedReceiverMutants({ ...generated, source: implementation }).find(value => value.name === "receiver-parameter-offset");
			expected.push({ name: offset.name, compiled: true, semanticRejection: true, sourceSha256: sha256(offset.source) });
			assert.deepEqual(item.mutations, expected);
		}
		else
		{
			const calls = kind === "plain" ? 4 : kind === "consuming" ? 6 : 17;
			assert.deepEqual(item.result, { checks: kind === "plain" ? 68 : kind === "consuming" ? 100 : 560
				, componentCalls: calls, nativeImports: calls, leanCalls: calls
				, exports: kind === "plain" ? 4 : kind === "consuming" ? 5 : 9
				, live: 0, identities: 0 });
		}
	}
	const page = await readFile("docs/consume/wit-wasi.md", "utf8");
	const example = page.split("### Methods and properties\n")[1]?.split("```c\n")[1]?.split("```")[0];
	assert.ok(example);
	const loaderSource = await readFile("tests/fixtures/structured-types/wit-owned-package-loader.c");
	for(const item of [...record.packages, ...record.resourcePackages])
	{
		const kind = item.kind ?? "full", full = kind === "full";
		assert.equal(item.schemaVersion, 1);
		flags(item, ["sourceRemovedBeforeInstall", "relocated", "deterministicReassembly", "independentRebuild", "pkgConfig", "cmake"]);
		await checkCli(item);
		assert.deepEqual(item.model, inputModel(item.inputs, item.mode, kind, base, true));
		const generated = generateOwnedWitPackage(item.inputs, componentBytes(item), item.receipt.settings);
		assert.deepEqual(generated.layout.model.bindingIr, item.model.bindingIr);
		const source = guardOwnedWitHostSource(generated, item.receipt.dependencies);
		assert.deepEqual(item.receipt.ownedValues, { schemaVersion: 4
			, hostCallbacks: item.model.ownedGraph.hostCallbacks
			, ...item.model.ownedGraph.inputTransfers ? { inputTransfers: item.model.ownedGraph.inputTransfers } : {}
			, ...item.model.ownedGraph.resultAnchors ? { resultAnchors: item.model.ownedGraph.resultAnchors } : {}
			, receiverExports: item.model.ownedGraph.receiverExports
			, headerSha256: sha256(generated.publicHeader)
			, sourceSha256: sha256(source) });
		assert.deepEqual(item.manifest.ownedValues, item.receipt.ownedValues);
		assert.equal(item.manifest.bindingIrSha256, item.model.bindingIrSha256);
		assert.equal(item.manifest.runtimeIdentity, item.receipt.runtimeIdentity);
		const files = { ...generated.files, [`src/${generated.values.prefix}.c`]: source
			, [`wit/${generated.model.name}.wit`]: generated.model.wit
			, [`component/${generated.model.name}.wat`]: generated.model.wat
			, "binding-manifest.json": canonicalJson(generated.model.manifest) };
		for(const [path, value] of Object.entries(files))
			assert.deepEqual(item.receipt.files[path], { bytes: Buffer.byteLength(value), sha256: sha256(value) }, path);
		assert.ok(Object.keys(item.manifest.files).length > 30);
		for(const file of Object.values(item.manifest.files))
		{ digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
		assert.equal(item.manifest.files[`include/${generated.values.prefix}.h`].sha256, item.receipt.ownedValues.headerSha256);
		const archives = item.packages.filter(archive => archive.archive.endsWith("-wit-wasi.tar.gz"));
		assert.equal(archives.length, 1); const archive = archives[0];
		assert.equal(archive.archive, "owned-receivers-1.2.3-wit-wasi.tar.gz");
		assert.equal(archive.compilerAccess, false); digest(archive.sha256); assert.ok(archive.bytes > 0);
		if(item.mode === "reviewed") assert.ok(item.packages.some(value => value.archive.endsWith("-c.tar.gz")));
		flags(item.installed, ["compilerFreePath", "offlineInstall"]);
		assert.equal(item.installed.checks, full ? 1344 : kind === "plain" ? 21 : kind === "consuming" ? 30 : 74);
		assert.equal(item.rejected, Object.keys(files).length + (full ? 11 : 9));
		const label = item.mode + (full ? "" : ", " + kind);
		assert.ok(record.run.text.includes(`${label}: ${item.installed.checks} installed checks, ${item.rejected} rejected mutations, pkg-config and relocated CMake passed`));
		let probe;
		if(full)
		{
			assert.deepEqual(item.documentation, { sourceSha256: sha256(example), stdout: "99\nexpired\n99\n" });
			const macros = [
				["OPTION", "echoOption"], ["ARRAY", "echoArray"], ["LIST", "echoList"]
				, ["RESULT", "echoResult"], ["TUPLE", "echoTuple"]
				, ["ROW", "echoRow"], ["NESTED", "echoNested"]
			].map(([macro, name]) => {
				const id = generated.values.functions.find(fn => fn.name === name).parameters[0];
				return `#define COPY_${macro} ${generated.values.copies.find(fn => fn.id === id).cName}\n`;
			}).join("");
			probe = (await ownedWitReceiverProbe(generated, true)).replace('#include "borrow-copies.h"', macros);
		}
		else probe = await ownedWitReceiverResourceProbe(generated, kind, true);
		assert.equal(item.probeSha256, sha256(probe)); assert.equal(item.installed.consumerSha256, sha256(probe));
		checkLoader(item, loaderSource);
	}
	for(const item of [...record.packages, ...record.resourcePackages])
		assert.deepEqual(item.installedCli.report, record.packages[0].installedCli.report);
	assertOwnedWitReceiverCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
