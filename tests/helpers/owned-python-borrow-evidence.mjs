/**
 * Authenticate Python original-owner results against compiled and installed runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedReceiverHistoricalBytes } from "./owned-receiver-history.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { generateOwnedRustPackage } from "../../src/backends/rust/owned-package.mjs";
import { generateOwnedPythonConversions } from "../../src/backends/python/owned-conversions.mjs";
import { generateOwnedPythonPackage } from "../../src/backends/python/owned-package.mjs";
import { ownedPythonRuntime } from "../../src/backends/python/owned-runtime.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustBorrowReviewedIr, ownedRustBorrowSource, ownedRustBorrowNativeSource } from "./owned-rust-borrow-fixture.mjs";
import { ownedPythonInstalledProbe } from "./owned-python-installed-probes.mjs";
import { pythonTypingWheels } from "./python-wheel-install.mjs";
import { beforeManagedClose } from "./managed-close-history.mjs";
import { beforeManagedCloseGenerated, historicalManagedClosePythonPackage } from "./managed-close-generated-history.mjs";

export const ownedPythonBorrowScript = "LEAN_BRIDGE_OWNED_PYTHON_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-python-borrows.test.mjs tests/owned-python-borrow-packaging.test.mjs";
export const ownedPythonBorrowCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-python-borrows";
export const ownedPythonBorrowScope = Object.freeze({
	profiles: ["python"], sharedAdapterConsumers: ["cpp", "rust"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedPackages: true, sourceFreeInstallation: true
	, offlineInstall: true, relocated: true, deterministicReassembly: true
	, independentRebuild: false, publicExports: 26, anchoredResults: 19
	, consumingFunctions: 4, wholeValueOwners: true, emptyValues: true
	, recursiveValues: true, returnedClosures: true, callbackReentry: true
	, canonicalIdentity: true, independentRetains: true
	, originalOwnerTransfers: true, transitiveExpiration: true
	, strictTyping: true, borrowOnlySyntaxCompiled: true, borrowOnlyExecuted: true
	, inheritedProcess: true, wrongThread: true, allocationFaults: true
	, retainedExceptionTracebacks: true, mutationChecks: true
	, documentationExecuted: true, otherConsumerProjections: false
	, receiverAnchors: false, callbackResultAnchors: false
	, sanitizers: [], docker: false, installedSupportPromotions: 0
});
export const ownedPythonCloseScope = Object.freeze({ ...ownedPythonBorrowScope, foreignCloseSnapshots: true });
export const ownedPythonCloseCommand = "LEAN_BRIDGE_COLLECTION_MYPY_PYTHON=/app/build/python-collection-typecheck/bin/python LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/app/build/python-typing-wheels " + ownedPythonBorrowCommand;
const names = ["3.11-minimum", "3.11-current", "3.12-standard"];
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true };
const options = { transferredInputs: true, anchoredResults: true };
const fields = ["values", "anchor", "expiration", "descendants", "emptyValues"
	, "aliases", "independentOwnership", "copyType", "resourceEquality"
	, "invalidEquality", "transfers"];

/**
 * Require executable observations and regenerate contracts from their Lean inputs.
 *
 * @param record - Source-bound runtime, typing and prepared-wheel observations.
 */
export const assertOwnedPythonBorrowExecution = async record => {
	const repaired = record.kind === "owned-python-close-repair";
	assert.equal(record.kind, repaired ? "owned-python-close-repair" : "owned-python-borrows");
	assert.equal(record.acceptance, "passed");
	assert.deepEqual(record.scope, repaired ? ownedPythonCloseScope : ownedPythonBorrowScope);
	assert.equal(record.run.command, repaired ? ownedPythonCloseCommand : ownedPythonBorrowCommand);
	assert.equal(record.run.exitCode, 0); assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [name, count] of Object.entries({ tests: 8, pass: 8, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp(`^# ${name} ${count}$`, "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.packages.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.typing.observations.map(item => item.name), names);
	// The typing fixture preserves author order; compiled exports are sorted.
	const typed = generateOwnedPythonConversions(ownedRustBorrowReviewedIr(), options);
	assert.equal(record.typing.stubSha256, sha256(typed.stub));
	const testSource = await readFile("tests/owned-python-borrows.test.mjs", "utf8");
	for(const name of ["positive", "invalid"])
	{
		const source = testSource.match(new RegExp(`const ${name} = \x60([^\x60]+)\x60;`, "u"))?.[1];
		assert.ok(source); assert.equal(record.typing[`${name}Sha256`], sha256(source));
	}
	for(const [index, item] of record.typing.observations.entries())
	{
		assert.equal(item.typing, ["4.6.0", "4.16.0", null][index]);
		assert.deepEqual(item.rejected, [3, 4, 5, 6, 8, 9, 10]);
		assert.equal(item.borrowOnlyCompiled, true);
	}
	const probePath = "tests/fixtures/structured-types/owned-python-borrows.py";
	let probe = await readFile(probePath, "utf8");
	if(!repaired) probe = beforeManagedClose(probePath, probe, record.sources[probePath]);
	const consumer = await readFile("tests/fixtures/structured-types/owned-installed-python-borrows.py");
	const documentation = await readFile("tests/fixtures/documentation/consumers/python/owned-borrows.py", "utf8");
	const page = await readFile("docs/consume/python.md", "utf8");
	assert.equal(page.match(/```python file=python\/owned-borrows\.py\n([\s\S]*?)```/u)?.[1], documentation);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + ownedRustBorrowSource;
	const loader = ownedPythonInstalledProbe.replaceAll("compatible.serial(ticket)", "compatible.serial(ticket.get())")
		.replaceAll("module.serial(value)", "module.serial(value.get())").replaceAll("api.serial(ticket)", "api.serial(ticket.get())");
	assert.deepEqual(record.borrowOnly.observations.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.equal(record.borrowOnly.probeSha256, sha256(record.borrowOnly.probe));
	assert.ok(testSource.includes(record.borrowOnly.probe));
	for(const item of record.borrowOnly.observations)
	{
		assert.equal(item.compiledLean, true); assert.equal(item.installedPackage, false);
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256,
			sha256(await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean")));
		assert.equal(item.input.sourceIdentity.extractorSha256, sha256(ownedReceiverHistoricalBytes("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"))));
		const model = createCompiledNativeModel(item.input, capabilities);
		assert.equal(model.exports.length, 22);
		assert.equal(model.ownedGraph.inputTransfers, undefined);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 18);
		const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true, anchoredResults: true });
		const python = generateOwnedPythonConversions(model.bindingIr, { anchoredResults: true });
		assert.equal(item.nativeSha256, sha256(c.source));
		assert.equal(item.publicSha256, sha256(python.valuesSource));
		assert.equal(item.stubSha256, sha256(python.stub));
		assert.equal(item.conversionsSha256, sha256(python.source));
		const currentRuntime = ownedPythonRuntime(c.values.prefix, { anchoredResults: true });
		assert.equal(item.runtimeSha256, sha256(repaired ? currentRuntime : beforeManagedCloseGenerated(currentRuntime, item.runtimeSha256)));
		assert.deepEqual(item.interpreters.map(value => value.name), names);
		for(const [index, value] of item.interpreters.entries())
		{
			assert.equal(value.typing, ["4.6.0", "4.16.0", null][index]);
			assert.equal(value.stdout, "borrow-only-ok\n");
		}
	}
	for(const item of [...record.runtime, ...record.packages])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		assert.equal(item.input.sourceIdentity.extractorSha256, sha256(ownedReceiverHistoricalBytes("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"))));
		const model = createCompiledNativeModel(item.input, capabilities);
		assert.equal(model.schemaVersion, 9); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		assert.deepEqual(item.observations.map(observation => observation.name), names);
		const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true, ...options });
		if(record.runtime.includes(item))
		{
			assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
			const generated = generateOwnedPythonConversions(model.bindingIr, options);
			let runtime = ownedPythonRuntime(c.values.prefix, options);
			if(!repaired) runtime = beforeManagedCloseGenerated(runtime, item.runtimeSha256);
			assert.equal(item.publicSha256, sha256(generated.valuesSource));
			assert.equal(item.stubSha256, sha256(generated.stub));
			assert.equal(item.conversionsSha256, sha256(generated.source));
			assert.equal(item.runtimeSha256, sha256(runtime));
			assert.equal(item.probeSha256, sha256(probe));
			assert.equal(item.nativeSha256, sha256(ownedRustBorrowNativeSource(c)));
			const mutants = [
				["unchecked-whole-value", runtime, "            storage.lease.require()\n            return storage.value", "            return storage.value"]
				, ["discarded-empty-owner", runtime
					, (repaired ? "            result = object.__new__(cls)\n" : "") + "            result._storage = storage"
					, (repaired ? "            result = object.__new__(cls)\n" : "") + "            result._storage = None if value == () or value is None else storage"]
				, ["escaped-callback-frame", runtime, "            self.scope.active = False", "            self.scope.active = True"]
				, ["pointer-equality", generated.valuesSource, "        return self.same_identity(other)", "        return self._handle == other._handle"]
				, ...repaired ? [
					["late-whole-value-read", runtime, "            return storage.value", "            return self._storage.value"]
					, ["late-retain-storage-read", runtime, "            return storage.copy(value, _whole=True)", "            return self._storage.copy(value, _whole=True)"]
					, ["late-copy-storage-read", runtime, "            result = object.__new__(type(self))\n            result._storage = storage", "            result = object.__new__(type(self))\n            result._storage = self._storage"]
					, ["late-status-storage-read", runtime, "            return storage is None or storage.lease.closed", "            return storage is None or self._storage.lease.closed"]
				] : []
			].map(([name, source, before, after]) => {
				assert.ok(source.includes(before), name);
				return { name, compiled: true, sourceSha256: sha256(source.replaceAll(before, after)) };
			});
			for(const [index, observation] of item.observations.entries())
			{
				assert.equal(observation.typing, ["4.6.0", "4.16.0", null][index]);
				assert.equal(observation.checks, repaired ? 2447 : 2410);
				if(repaired) assert.deepEqual(observation.foreignCloseSchedules, ["array", "option", "nested"].flatMap(shape =>
					["get", "retain", "copy", "is_closed"].map(operation => `${shape}/${operation}`)));
				else assert.equal(observation.foreignCloseSchedules, undefined);
				assert.equal(observation.live, 0); assert.equal(observation.identities, 0);
				assert.deepEqual(observation.retainedLifetimeFailures, ["borrowed-transfer", "expired-get", "expired-argument", "wrong-thread"]);
				for(const [key, count] of Object.entries({ pythonBefore: 114, pythonAfter: 63, nativeBefore: 129, nativeAfter: 97 }))
					assert.equal(observation[key], count, key);
				assert.deepEqual(observation.rejectedMutations, mutants);
			}
			continue;
		}
		for(const key of ["compiledLean", "installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation", "sourceFreeRelocatedExecution"
			, "handoffRemovedBeforeRelocatedExecution", "deterministicReassembly"
			, "ordinaryImport"]) assert.equal(item[key], true, key);
		assert.equal(item.schemaVersion, 1); assert.equal(item.planNode, 1219);
		assert.deepEqual(item.tamperRejected, [...fields, "adapter-version", "contract-version", "native-anchors", "input-transfers", "source", "abi", "library"]);
		assert.equal(item.incapableReadersRejected, 3);
		assert.equal(item.consumerSha256, sha256(consumer));
		assert.equal(item.documentationSha256, sha256(documentation));
		assert.equal(item.loaderProbeSha256, sha256(loader));
		const { componentReceipt: component, adapterReceipt: adapter
			, runtimeReceipt: runtime, packageSetReceipt: packages } = item;
		const native = generateCompiledNativeLeanAdapters(model);
		let python = generateOwnedPythonPackage(model.bindingIr, null, options);
		if(!repaired) python = historicalManagedClosePythonPackage(python, adapter.pythonValues);
		assert.equal(component.schemaVersion, 5); assert.equal(adapter.schemaVersion, 5);
		assert.equal(adapter.ownedValues.schemaVersion, 4);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(native.header));
		assert.equal(component.adaptersSha256, sha256(native.leanSource));
		assert.deepEqual(component.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
		assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.deepEqual(adapter.ownedValues.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(adapter.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
		assert.deepEqual(adapter.pythonValues, python.contract);
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
			, ownedValues: python.contract, library: adapter.library, libraries };
		let packaged = generateOwnedPythonPackage(model.bindingIr, evidence, options);
		if(!repaired) packaged = historicalManagedClosePythonPackage(packaged, adapter.pythonValues);
		for(const [index, observation] of item.observations.entries())
		{
			assert.equal(observation.checks, 328);
			assert.equal(observation.relocatedChecks, observation.checks);
			assert.equal(observation.rejectedTypes, 4);
			assert.equal(observation.installation.resolvedOffline, true);
			assert.match(observation.installation.python, index === 2 ? /^3\.12\./u : /^3\.11\./u);
			if(index === 2) assert.equal(observation.installation.dependency, null);
			else
			{
				const version = index === 0 ? "4.6.0" : "4.16.0";
				assert.equal(observation.installation.dependency.version, version);
				assert.equal(observation.installation.dependency.sha256, pythonTypingWheels[version]);
			}
			assert.equal(observation.loader.liveIdentities, 0);
			assert.equal(observation.loader.runtimeInitializations, 1);
			assert.equal(observation.loader.componentInitializations, 1);
			assert.deepEqual(observation.loader.consumer, { checks: observation.checks, ordinaryImport: true });
			for(const key of ["conflictingRuntimeRejected", "forkWithHeldLockRejected"]) assert.equal(observation.loader[key], true);
			assert.equal(observation.loader.compatibleImports, 5);
			assert.equal(observation.loader.concurrentImports, 4);
			const manifest = observation.manifest;
			assert.equal(manifest.schemaVersion, 4);
			assert.deepEqual(manifest.ownedValues, python.contract);
			assert.equal(manifest.tag, "py3-none-manylinux_2_36_x86_64");
			assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity);
			assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
			for(const [path, source] of Object.entries(packaged.files))
			{
				const target = path.startsWith(`${packaged.packageDir}/`) ? path : `${packaged.packageDir}/lean_bridge/${path}`;
				assert.deepEqual(manifest.files[target], { bytes: Buffer.byteLength(source), sha256: sha256(source) }, target);
			}
			for(const [file, hash] of Object.entries(libraries))
				assert.equal(manifest.files[`${packaged.packageDir}/native/linux-x64/${file}`].sha256, hash, file);
		}
		validatePackageSetReceipt(packages);
		assert.deepEqual(packages.packages.map(value => value.target).sort(), item.mode === "reviewed" ? ["c", "cargo", "cpp", "pypi"] : ["pypi"]);
		assert.equal(packages.profiles[0].bindingIrSha256, model.bindingIrSha256);
		if(item.mode === "reviewed")
		{
			assert.deepEqual(item.companions, { cpp: 407, rust: 440 });
			assert.deepEqual(adapter.cppValues, generateOwnedCppPackage(model.bindingIr, options).contract);
			assert.deepEqual(adapter.rustValues, generateOwnedRustPackage(model.bindingIr, null, {}, options).contract);
		} else assert.deepEqual(item.companions, {});
	}
};

/**
 * Require all eight enabled tests and both installed source paths in CI.
 *
 * @param workflow - Complete downstream workflow.
 * @param manifest - Package scripts.
 */
export const assertOwnedPythonBorrowCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-python-borrows"], ownedPythonBorrowScript);
	const step = workflow.split("id: type_corpus_python\n")[1]?.split("      - name:")[0];
	assert.ok(step?.includes("          npm run test:owned-python-borrows > build/owned-python-borrows.log 2>&1\n"));
	for(const summary of ["pass 8", "fail 0", "skipped 0"]) assert.ok(step.includes(`          rg '^# ${summary}$' build/owned-python-borrows.log\n`));
	for(const directory of ["owned-python-borrows", "owned-python-borrow-packaging"])
	{
		for(const mode of ["ordinary", "reviewed"]) assert.ok(step.includes(`          test -s build/${directory}/${mode}.json\n`));
		assert.ok(workflow.includes(`            build/${directory}/\n`));
	}
	assert.ok(step.includes("          test -s build/owned-python-borrows/typing.json\n"));
	assert.ok(step.includes("          test -s build/owned-python-borrows/borrow-only.json\n"));
	assert.ok(workflow.includes("            build/owned-python-borrows.log\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-python-borrows"'));
	assert.ok(workflow.includes("steps.type_corpus_python.outcome != 'success'"));
};
