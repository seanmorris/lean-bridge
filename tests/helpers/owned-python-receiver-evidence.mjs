/**
 * Bind Python receiver claims to compiled inputs and original installed wheels.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedRubyReceiverHistoricalBytes } from "./owned-ruby-receiver-history.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { generateOwnedRustPackage } from "../../src/backends/rust/owned-package.mjs";
import { generateOwnedPythonPackage } from "../../src/backends/python/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustBorrowNativeSource } from "./owned-rust-borrow-fixture.mjs";
import { ownedReceiverSource } from "./owned-receiver-fixture.mjs";
import { ownedPythonReceiverSource, ownedPythonReceiverReviewedIr, ownedPythonReceiverProbe
	, ownedPythonPlainReceiverProbe, ownedPythonInstalledReceiverProbe } from "./owned-python-receiver-fixture.mjs";
import { ownedCppReceiverProbe } from "./owned-cpp-receiver-fixture.mjs";
import { ownedRustReceiverProbe } from "./owned-rust-receiver-fixture.mjs";
import { ownedPythonInstalledProbe } from "./owned-python-installed-probes.mjs";
import { pythonTypingWheels } from "./python-wheel-install.mjs";
import { assertOwnedPythonReceiverCi } from "./owned-python-receiver-ci.mjs";

export const ownedPythonReceiverCommand = "LEAN_BRIDGE_COLLECTION_MYPY_PYTHON=/app/build/python-collection-typecheck/bin/python LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/app/build/python-typing-wheels LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-python-receivers";
export const ownedPythonReceiverScope = Object.freeze({
	profiles: ["python"], sharedAdapterConsumers: ["cpp", "rust"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true, installedPackages: true
	, publicExports: 27, receiverExports: 16, resultAnchors: 20
	, nominalMembers: true, readOnlyProperties: true, classDescriptors: true
	, originalOwnerTransfers: true, receiverAnchors: true
	, remainingParameterAnchors: true
	, receiverOnlyWithoutOptionalCapabilities: true, consumingWithoutAnchors: true
	, transitiveExpiration: true, independentRetains: true
	, emptyValues: true, recursiveValues: true, returnedClosures: true
	, callbackReentry: true, allocationFaults: true
	, retainedExceptionTracebacks: true
	, foreignCloseSnapshots: true, strictTyping: true, compiledNegativeVariants: 3
	, sourceFreeInstallation: true, offlineInstall: true
	, sourceFreeRelocatedExecution: true, documentationExecuted: true
	, deterministicReassembly: true, independentRebuild: true
	, callbackResultAnchors: false, docker: false, installedSupportPromotions: 0
});
const options = { transferredInputs: true, anchoredResults: true, receiverExports: true };
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true
	, ownedReceiverExports: true };
const names = ["3.11-minimum", "3.11-current", "3.12-standard"];
const trueFields = (value, fields) => { for(const field of fields) assert.equal(value[field], true, field); };
const mixed = input => {
	trueFields(input, ["hostCallbacks", "transferredInputs", "anchoredResults", "receiverExports"]);
	const model = createCompiledNativeModel(input, capabilities);
	assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
	assert.equal(model.exports.length, 27); assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
	assert.equal(model.ownedGraph.resultAnchors.exports.length, 20); assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
	assert.deepEqual(model.ownedGraph.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.chooseTicket"), { bindingId: "lean:Owned.chooseTicket", parameter: 0 });
	return { model, c: generateOwnedCPackage(input), python: generateOwnedPythonPackage(model.bindingIr, null, options) };
};
const sourceIdentity = (input, mode, source) => {
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(input.sourceIdentity.modules.find(item => item.module === "Owned").source.sha256, sha256(source));
};

/**
 * Regenerate direct APIs and check observations without claiming package acceptance.
 *
 * @param record - Compiled runtime, no-optional-capability and typing reports.
 */
export const assertOwnedPythonReceiverInputs = async record => {
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.plain.map(item => [item.mode, item.consuming]), [
		["ordinary", false], ["reviewed", false]
		, ["ordinary", true], ["reviewed", true]
	]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const probe = await ownedPythonReceiverProbe();
	for(const item of record.runtime)
	{
		sourceIdentity(item.input, item.mode, lean + ownedPythonReceiverSource);
		const { c, python } = mixed(item.input), runtime = python.files[`${python.packageDir}/_owned.py`];
		assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
		assert.equal(item.publicSha256, sha256(python.valuesSource)); assert.equal(item.stubSha256, sha256(python.stub));
		assert.equal(item.conversionsSha256, sha256(python.source)); assert.equal(item.runtimeSha256, sha256(runtime));
		assert.equal(item.nativeSha256, sha256(ownedRustBorrowNativeSource(c))); assert.equal(item.probeSha256, sha256(probe));
		const choose = python.functions.findIndex(fn => fn.name === "chooseTicket");
		const mutations = [
			["receiver-used-as-other-argument-anchor", python.source, `return _call${choose}(self.get(), arg1)`, `return _call${choose}(self.get(), self)`]
			, ["unchecked-whole-value", runtime, "            storage.lease.require()\n            return storage.value", "            return storage.value"]
			, ["escaped-callback-frame", runtime, "            self.scope.active = False", "            self.scope.active = True"]
		].map(([name, source, before, after]) => {
			assert.equal(source.split(before).length, 2, name);
			return { name, compiled: true, sourceSha256: sha256(source.replace(before, after)) };
		});
		assert.deepEqual(item.observations.map(value => value.name), names);
		for(const [index, value] of item.observations.entries())
		{
			assert.equal(value.typing, ["4.6.0", "4.16.0", null][index]);
			assert.equal(value.checks, 2489); assert.equal(value.live, 0); assert.equal(value.identities, 0); assert.equal(value.restored, true);
			for(const [field, count] of Object.entries({ pythonBefore: 114, pythonAfter: 63, nativeBefore: 129, nativeAfter: 97 })) assert.equal(value[field], count);
			assert.deepEqual(value.retainedLifetimeFailures, ["borrowed-transfer", "expired-get", "expired-argument", "wrong-thread"]);
			assert.deepEqual(value.foreignCloseSchedules, ["array", "option", "nested"].flatMap(shape => ["get", "retain", "copy", "is_closed"].map(operation => `${shape}/${operation}`)));
			assert.deepEqual(value.rejectedMutations, mutations);
		}
	}
	for(const item of record.plain)
	{
		sourceIdentity(item.input, item.mode, lean + ownedReceiverSource);
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedReceiverExports: true, ownedInputTransfers: item.consuming });
		assert.deepEqual(item.model, model); assert.equal(model.exports.length, item.consuming ? 4 : 3);
		assert.equal(model.ownedGraph.receiverExports.exports.length, item.consuming ? 3 : 2);
		assert.equal(model.ownedGraph.hostCallbacks, undefined); assert.equal(model.ownedGraph.resultAnchors, undefined);
		if(!item.consuming) assert.equal(model.ownedGraph.inputTransfers, undefined);
		const python = generateOwnedPythonPackage(model.bindingIr, null, { receiverExports: true, transferredInputs: item.consuming, hostCallbacks: false });
		assert.deepEqual(item.contract, python.contract); assert.equal(item.sourceSha256, sha256(generateOwnedCPackage(item.input).source));
		assert.equal(item.probe, ownedPythonPlainReceiverProbe(item.consuming)); assert.equal(item.probeSha256, sha256(item.probe));
		assert.deepEqual(item.observations, names.map((name, index) => ({ name, typing: ["4.6.0", "4.16.0", null][index], checks: item.consuming ? 8 : 7, identities: 0 })));
	}
	const typed = generateOwnedPythonPackage(ownedPythonReceiverReviewedIr(), null, options);
	assert.equal(record.typing.stubSha256, sha256(typed.stub));
	const testSource = await readFile("tests/owned-python-receivers.test.mjs", "utf8");
	for(const name of ["positive", "invalid"])
	{
		const source = testSource.match(new RegExp(`const ${name} = \x60([^\x60]+)\x60;`, "u"))?.[1];
		assert.ok(source); assert.equal(record.typing[`${name}Sha256`], sha256(source));
	}
	assert.deepEqual(record.typing.observations, names.map((name, index) => ({ name, typing: ["4.6.0", "4.16.0", null][index], rejected: [3, 4, 5, 6, 7, 8, 9] })));
};

/**
 * Require one complete eleven-test run and reconstruct every shipped contract.
 *
 * @param record - Source-bound runtime and installed-wheel acceptance record.
 */
export const assertOwnedPythonReceiverExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedPythonReceiverScope);
	assert.equal(record.run.command, ownedPythonReceiverCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 11, pass: 11, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	await assertOwnedPythonReceiverInputs(record);
	const observations = record.run.text.split("\n").filter(line => line.startsWith("# {"))
		.map(line => canonicalJson(JSON.parse(line.slice(2)))).sort();
	assert.deepEqual(observations, [
		...record.runtime.flatMap(item => item.observations)
		, ...record.plain.map(({ mode, consuming, observations }) => ({ mode, consuming, observations }))
	].map(canonicalJson).sort());
	assert.deepEqual(record.packages.map(item => item.mode), ["ordinary", "reviewed"]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const consumer = await ownedPythonInstalledReceiverProbe();
	const example = await readFile("tests/fixtures/documentation/consumers/python/owned-receivers.py", "utf8");
	assert.equal((await readFile("docs/consume/python.md", "utf8")).match(/```python file=python\/owned-receivers\.py\n([\s\S]*?)```/u)?.[1], example);
	const loader = ownedPythonInstalledProbe.replaceAll("compatible.serial(ticket)", "compatible.serial(ticket.get())")
		.replaceAll("module.serial(value)", "module.serial(value.get())").replaceAll("api.serial(ticket)", "api.serial(ticket.get())");
	const cliConfig = JSON.parse(ownedRubyReceiverHistoricalBytes("config/cli-package.v1.json", await readFile("config/cli-package.v1.json"), record.sources["config/cli-package.v1.json"]).toString());
	for(const item of record.packages)
	{
		trueFields(item, ["sourceRemovedBeforeInstall"
			, "cliRemovedBeforeConsumerInstall", "sourceFreeInstallation"
			, "sourceFreeRelocatedExecution", "handoffRemovedBeforeRelocatedExecution"
			, "deterministicReassembly", "independentRebuild"]);
		const input = { metadata: item.metadata, sourceIdentity: item.model.sourceIdentity, component: item.model.component, hostCallbacks: true, ...options };
		sourceIdentity(input, item.mode, lean + ownedPythonReceiverSource);
		const { model, c, python } = mixed(input), native = generateCompiledNativeLeanAdapters(model);
		assert.deepEqual(item.model, model);
		const { componentReceipt: component, adapter, runtime, packageSetReceipt: packages } = item;
		assert.equal(component.schemaVersion, 6); assert.equal(adapter.schemaVersion, 6); assert.equal(adapter.ownedValues.schemaVersion, 5);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
		assert.equal(component.callbackSourceSha256, model.ownedGraph.hostCallbacks.trampolineSha256);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		for(const field of ["receiverExports", "resultAnchors", "inputTransfers"])
		{
			assert.deepEqual(component[field], model.ownedGraph[field]); assert.deepEqual(adapter.ownedValues[field], model.ownedGraph[field]);
		}
		assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader)); assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.deepEqual(adapter.pythonValues, python.contract); assert.equal(python.contract.schemaVersion, 4);
		assert.equal(runtime.schemaVersion, 1); assert.equal(runtime.profile, "native-library-v1"); assert.equal(runtime.pointerBits, 64);
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
		const packaged = generateOwnedPythonPackage(model.bindingIr, evidence, options);
		assert.equal(item.consumerSha256, sha256(consumer)); assert.equal(item.loaderProbeSha256, sha256(loader));
		assert.equal(item.rejected, 21); assert.equal(item.incapableReadersRejected, 4);
		assert.deepEqual(item.observations.map(value => value.name), names);
		for(const [index, value] of item.observations.entries())
		{
			assert.ok(value.checks > 350); assert.equal(value.relocatedChecks, value.checks); assert.equal(value.rejectedTypes, 4);
			assert.equal(value.installation.resolvedOffline, true); assert.match(value.installation.python, index === 2 ? /^3\.12\./u : /^3\.11\./u);
			if(index === 2) assert.equal(value.installation.dependency, null);
			else
			{
				const version = index === 0 ? "4.6.0" : "4.16.0";
				assert.equal(value.installation.dependency.version, version); assert.equal(value.installation.dependency.sha256, pythonTypingWheels[version]);
			}
			assert.equal(value.loader.liveIdentities, 0); assert.equal(value.loader.runtimeInitializations, 1); assert.equal(value.loader.componentInitializations, 1);
			assert.deepEqual(value.loader.consumer, { checks: value.checks, ordinaryImport: true });
			trueFields(value.loader, ["conflictingRuntimeRejected", "forkWithHeldLockRejected"]);
			assert.equal(value.loader.compatibleImports, 5); assert.equal(value.loader.concurrentImports, 4);
			assert.deepEqual(value.documentation, { sourceSha256: sha256(example), stdout: "42\n42\n" });
			const manifest = value.manifest;
			assert.equal(manifest.schemaVersion, 5); assert.deepEqual(manifest.ownedValues, python.contract);
			assert.equal(manifest.tag, "py3-none-manylinux_2_36_x86_64");
			assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity); assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
			for(const [path, source] of Object.entries(packaged.files))
			{
				const target = path.startsWith(`${packaged.packageDir}/`) ? path : `${packaged.packageDir}/lean_bridge/${path}`;
				assert.deepEqual(manifest.files[target], { bytes: Buffer.byteLength(source), sha256: sha256(source) }, target);
			}
			for(const [file, hash] of Object.entries(libraries)) assert.equal(manifest.files[`${packaged.packageDir}/native/linux-x64/${file}`].sha256, hash);
		}
		assert.ok(record.run.text.includes(`${item.mode}: ${item.observations.map(value => `${value.name} ${value.checks}+${value.relocatedChecks}`).join(", ")} installed and relocated receiver checks`));
		validatePackageSetReceipt(packages);
		const targets = item.mode === "reviewed" ? ["c", "cargo", "cpp", "pypi"] : ["pypi"];
		assert.deepEqual(packages.packages.map(value => value.target).sort(), targets); assert.equal(packages.profiles[0].bindingIrSha256, model.bindingIrSha256);
		if(item.mode === "reviewed")
		{
			assert.deepEqual(adapter.cppValues, generateOwnedCppPackage(model.bindingIr, options).contract);
			assert.deepEqual(adapter.rustValues, generateOwnedRustPackage(model.bindingIr, null, {}, options).contract);
			for(const [name, source] of [["cpp", "#define OWNED_BORROW_INSTALLED 1\n" + await ownedCppReceiverProbe()], ["rust", "use owned_receivers::*;\n" + await ownedRustReceiverProbe()]])
			{ assert.ok(item.companions[name].checks > 300); assert.equal(item.companions[name].probeSha256, sha256(source)); }
		} else assert.deepEqual(item.companions, {});
		const { archive, inventorySha256, externalRegistryWrites, ...inventory } = item.cli;
		assert.equal(item.cli.kind, "lean-bridge-cli-package"); assert.equal(inventorySha256, sha256(canonicalJson(inventory)));
		assert.equal(item.cli.productionApproved, false); assert.equal(externalRegistryWrites, false);
		assert.match(archive.sha256, /^[a-f0-9]{64}$/u); assert.ok(archive.bytes > 0);
		assert.deepEqual(item.cliInstallation, { offline: true, filesVerified: item.cli.files.length, sourceRemoved: true });
		assert.equal(item.cli.files.length, cliConfig.files.length + 2);
		assert.equal(new Set(item.cli.files.map(file => file.path)).size, item.cli.files.length);
		for(const path of cliConfig.files)
		{
			const file = item.cli.files.find(value => value.path === path);
			const bytes = Buffer.from(ownedRubyReceiverHistoricalBytes(path, await readFile(path), file?.sha256));
			assert.ok(file, path); assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, sha256(bytes), path);
		}
		assert.equal(item.builds.length, 2);
		for(const build of item.builds)
		{ assert.equal(build.status, "ok"); assert.deepEqual([...build.result.targets].sort(), targets); }
		assert.equal(item.verification.status, "ok"); assert.equal(item.verification.result.verificationType, "local-package-set");
	}
	assert.deepEqual(record.packages[0].cli, record.packages[1].cli);
	assertOwnedPythonReceiverCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
