/**
 * Bind installed Python input consumption to compiler facts and observed runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedBorrowHistoricalBytes } from "./owned-borrow-history.mjs";
import { generateOwnedPythonConversions } from "../../src/backends/python/owned-conversions.mjs";
import { generateOwnedPythonPackage } from "../../src/backends/python/owned-package.mjs";
import { ownedPythonRuntime } from "../../src/backends/python/owned-runtime.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { historicalOwnedTransferPackage } from "./owned-transfer-generated-history.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { generateOwnedRustPackage } from "../../src/backends/rust/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedPythonInstalledProbe } from "./owned-python-installed-probes.mjs";
import { pythonTypingWheels } from "./python-wheel-install.mjs";
import { ownedRustTransferSource } from "./owned-rust-transfer-fixture.mjs";

export const ownedPythonTransferCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-python-transfers";
export const ownedPythonTransferScope = Object.freeze({
	ordinaryCompiler: true, reviewedCompiler: true, installedPython: true
	, transferredInputs: true, hostAssembledGraphs: true, boxedRecursion: true
	, callbackReentry: true, independentRetains: true, multipleInputHandoffs: true
	, pythonAllocationFaults: true, nativeAllocationFaults: true
	, retainedExceptionTracebacks: true, sourceFreeInstallation: true
	, offlineInstall: true, sourceFreeRelocatedExecution: true
	, deterministicReassembly: true, documentationExecuted: true
	, cCppRustCompanions: true, otherConsumerBindings: false
	, anchoredBorrowedResults: false, docker: false, installedSupportPromotions: 0
});
const names = ["3.11-minimum", "3.11-current", "3.12-standard"];

/**
 * Reconstruct compiled contracts and require both actual execution paths.
 *
 * @param record - Source-bound private and installed transfer observations.
 */
export const assertOwnedPythonTransferExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedPythonTransferScope);
	assert.equal(record.run.command, ownedPythonTransferCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 6, pass: 6, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.consumers.map(item => item.mode), ["ordinary", "reviewed"]);
	const probe = await readFile("tests/fixtures/structured-types/owned-python-transfers.py");
	const fixture = await readFile("tests/fixtures/structured-types/owned-installed-python-transfers.py");
	const documentation = await readFile("tests/fixtures/documentation/consumers/python/owned-transfers.py");
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + ownedRustTransferSource;
	for(const item of [...record.runtime, ...record.consumers])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		const extractor = "src/analyze/NativeExports.lean", expectedExtractor = item.input.sourceIdentity.extractorSha256;
		assert.equal(sha256(ownedBorrowHistoricalBytes(extractor, await readFile(extractor), expectedExtractor)), expectedExtractor);
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
		assert.equal(model.schemaVersion, 8); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 20);
		assert.deepEqual(item.observations.map(observation => observation.name), names);
		if(record.runtime.includes(item))
		{
			assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
			assert.equal(item.probeSha256, sha256(probe));
			const generated = generateOwnedPythonConversions(model.bindingIr, { transferredInputs: true });
			assert.equal(item.publicSha256, sha256(generated.valuesSource)); assert.equal(item.stubSha256, sha256(generated.stub));
			assert.equal(item.conversionsSha256, sha256(generated.source));
			assert.equal(item.runtimeSha256, sha256(ownedPythonRuntime(generated.c.prefix, { transferredInputs: true })));
			for(const observation of item.observations)
			{
				assert.ok(observation.checks > 1000);
				for(const key of ["pythonBefore", "pythonAfter"
					, "nativeBefore", "nativeAfter"
					, "multiPythonBefore", "multiPythonAfter"
					, "multiNativeBefore", "multiNativeAfter"])
					assert.ok(Number.isSafeInteger(observation[key]) && observation[key] > 0, key);
				assert.equal(observation.live, 0); assert.equal(observation.identities, 0);
			}
			continue;
		}
		for(const key of ["compiledLean", "installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation", "sourceFreeRelocatedExecution"
			, "handoffRemovedBeforeRelocatedExecution", "deterministicReassembly"
			, "ordinaryImport"])
			assert.equal(item[key], true, key);
		assert.deepEqual(item.tamperRejected, ["adapter-version", "contract-version", "consumption", "aliases", "native-transfers", "source", "abi", "library"]);
		assert.equal(item.documentationSha256, sha256(documentation)); assert.equal(item.consumerSha256, sha256(fixture));
		assert.equal(item.loaderProbeSha256, sha256(ownedPythonInstalledProbe));
		const { componentReceipt: component, adapterReceipt: adapter
			, runtimeReceipt: runtime, packageSetReceipt: packages } = item;
		const native = generateCompiledNativeLeanAdapters(model);
		const c = historicalOwnedTransferPackage(generateOwnedCPackage({ ...item.input, hostCallbacks: true, transferredInputs: true }), adapter.ownedValues.sourceSha256);
		const python = generateOwnedPythonPackage(model.bindingIr, null, { transferredInputs: true });
		assert.equal(component.schemaVersion, 4); assert.equal(adapter.schemaVersion, 4);
		assert.equal(adapter.ownedValues.schemaVersion, 3); assert.deepEqual(adapter.pythonValues, python.contract);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader)); assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.deepEqual(adapter.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(runtime.schemaVersion, 1); assert.equal(runtime.profile, "native-library-v1");
		assert.equal(runtime.pointerBits, 64);
		const libraries = {
			[adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
			, [component.library]: component.nativeLibrary.sha256
			, "libgmp.so.10": adapter.files["gmp/lib/libgmp.so.10"].sha256
			, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256]))
		};
		const evidence = { runtimeIdentity: component.runtimeIdentity
			, componentId: model.component.id
			, componentReceiptSha256: sha256(canonicalJson(component))
			, ownedValues: python.contract
			, library: adapter.library, libraries };
		const packaged = generateOwnedPythonPackage(model.bindingIr, evidence, { transferredInputs: true });
		for(const [index, observation] of item.observations.entries())
		{
			assert.ok(observation.checks > 100); assert.equal(observation.relocatedChecks, observation.checks);
			assert.equal(observation.rejectedTypes, 3); assert.equal(observation.installation.resolvedOffline, true);
			assert.match(observation.installation.python, index === 2 ? /^3\.12\./u : /^3\.11\./u);
			if(index === 2) assert.equal(observation.installation.dependency, null);
			else
			{
				const version = index === 0 ? "4.6.0" : "4.16.0";
				assert.equal(observation.installation.dependency.version, version);
				assert.equal(observation.installation.dependency.sha256, pythonTypingWheels[version]);
			}
			assert.equal(observation.loader.liveIdentities, 0);
			assert.equal(observation.loader.runtimeInitializations, 1); assert.equal(observation.loader.componentInitializations, 1);
			assert.equal(observation.loader.consumer.checks, observation.checks);
			assert.equal(observation.manifest.schemaVersion, 3); assert.deepEqual(observation.manifest.ownedValues, python.contract);
			assert.equal(observation.manifest.tag, "py3-none-manylinux_2_36_x86_64");
			for(const [path, source] of Object.entries(packaged.files).filter(([path]) => path.startsWith(`${packaged.packageDir}/`)))
				assert.deepEqual(observation.manifest.files[path], { bytes: Buffer.byteLength(source), sha256: sha256(source) }, path);
			for(const [file, hash] of Object.entries(libraries))
				assert.equal(observation.manifest.files[`${packaged.packageDir}/native/linux-x64/${file}`].sha256, hash, file);
		}
		validatePackageSetReceipt(packages);
		assert.deepEqual(packages.packages.map(item => item.target).sort(), item.mode === "reviewed" ? ["c", "cargo", "cpp", "pypi"] : ["pypi"]);
		assert.equal(packages.profiles[0].bindingIrSha256, model.bindingIrSha256);
		if(item.mode === "reviewed")
		{
			assert.deepEqual(Object.keys(item.companions).sort(), ["c", "cpp", "rust"]);
			for(const count of Object.values(item.companions)) assert.ok(Number.isSafeInteger(count) && count > 100);
			assert.deepEqual(adapter.cppValues, generateOwnedCppPackage(model.bindingIr, { transferredInputs: true }).contract);
			assert.deepEqual(adapter.rustValues, generateOwnedRustPackage(model.bindingIr, null, {}, { transferredInputs: true }).contract);
		} else assert.deepEqual(item.companions, {});
	}
};

/**
 * Require both authoring paths in the enabled Python shard and uploaded reports.
 *
 * @param workflow - Complete downstream workflow source.
 */
export const assertOwnedPythonTransferCi = workflow => {
	const step = workflow.split("- name: Compare installed Python corpus packages with fresh Lean results\n")[1]?.split("      - name:")[0];
	assert.ok(step?.includes("          npm run test:owned-python-transfers\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-python-transfers"'));
	for(const directory of ["owned-python-transfers", "owned-python-transfer-packaging"])
	{
		assert.ok(workflow.includes(`            build/${directory}/\n`));
		for(const mode of ["ordinary", "reviewed"]) assert.ok(step.includes(`          test -s build/${directory}/${mode}.json\n`));
	}
};
