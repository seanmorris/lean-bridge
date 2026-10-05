/**
 * Bind C++ whole-value borrows to real Lean, installed packages and required CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedReceiverHistoricalBytes } from "./owned-receiver-history.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedCppBorrowSource } from "./owned-cpp-borrow-fixture.mjs";

export const ownedCppBorrowScript = "LEAN_BRIDGE_OWNED_CPP_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-cpp-borrows.test.mjs tests/owned-cpp-borrow-packaging.test.mjs";
export const ownedCppBorrowScope = Object.freeze({
	profiles: ["cpp"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedPackages: true, sourceFreeInstallation: true
	, relocated: true, deterministicReassembly: true, independentRebuild: false
	, publicExports: 26, anchoredResults: 19, consumingFunctions: 4
	, wholeValueOwners: true, emptyValues: true, recursiveValues: true
	, returnedClosures: true, callbackReentry: true, canonicalIdentity: true
	, independentRetains: true, originalOwnerTransfers: true
	, transitiveExpiration: true, wrongThread: true, inheritedProcess: true
	, allocationFaults: true, mutationChecks: true, documentationExecuted: true
	, sanitizers: ["address", "undefined"], otherConsumerProjections: false
	, receiverAnchors: false, callbackResultAnchors: false
	, docker: false, installedSupportPromotions: 0
});
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true };
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const run = (value, command, count) => {
	assert.equal(value.command, command); assert.equal(value.exitCode, 0);
	assert.equal(value.sha256, sha256(value.text));
	for(const [name, expected] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(value.text, new RegExp(`^# ${name} ${expected}$`, "mu"));
	assert.doesNotMatch(value.text, /^not ok|# SKIP|# TODO/mu);
};

/**
 * Reconstruct native/C++ contracts and require both independent source paths.
 *
 * @param record - Runtime and installed evidence bound to the current sources.
 */
export const assertOwnedCppBorrowExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedCppBorrowScope);
	run(record.runs.headers, "node --test --test-name-pattern='whole-value owners' tests/owned-cpp-borrows.test.mjs", 1);
	run(record.runs.runtime, "LEAN_BRIDGE_OWNED_CPP_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-cpp-borrows.test.mjs", 3);
	run(record.runs.installed, "LEAN_BRIDGE_OWNED_CPP_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-cpp-borrow-packaging.test.mjs", 2);
	for(const group of [record.runtime, record.packages]) assert.deepEqual(group.map(item => item.mode), ["ordinary", "reviewed"]);
	const probe = await readFile("tests/fixtures/structured-types/owned-cpp-borrows.cpp");
	const source = (await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8")) + ownedCppBorrowSource;
	const page = await readFile("docs/consume/cpp.md", "utf8");
	const example = page.match(/```cpp file=cpp\/owned-borrows\.cpp\n([\s\S]*?)```/u)?.[1];
	assert.ok(example);
	assert.equal(await readFile("tests/fixtures/documentation/consumers/cpp/owned-borrows.cpp", "utf8"), example);
	for(const item of [...record.runtime, ...record.packages])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(source));
		assert.equal(item.input.sourceIdentity.extractorSha256, sha256(ownedReceiverHistoricalBytes("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"))));
		const model = createCompiledNativeModel(item.input, capabilities);
		assert.equal(model.schemaVersion, 9); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		const cpp = generateOwnedCppPackage(model.bindingIr, { transferredInputs: true, anchoredResults: true });
		const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true, transferredInputs: true, anchoredResults: true });
		if(record.runtime.includes(item))
		{
			flags(item, ["actualLean", "compiledLean"]); assert.equal(item.installedPackage, false);
			assert.equal(item.probeSha256, sha256(probe)); assert.equal(item.sourceSha256, sha256(c.source));
			assert.deepEqual(item.contract, cpp.contract);
			assert.equal(item.result.checks, 918); assert.equal(item.sanitizer.checks, 910);
			for(const observed of [item.result, item.sanitizer])
			{
				assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
				for(const key of ["cppFaults", "nativeFaults", "before", "after"]) assert.ok(observed[key] > 0, key);
			}
			assert.deepEqual(item.rejectedMutations, ["missing-whole-value-validation", "empty-owner-dropped", "callback-wrapper-escape", "raw-pointer-equality"]);
			assert.doesNotMatch(item.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:/u);
			continue;
		}
		flags(item, ["compiledLean", "installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation", "compilerFreeExecution"
			, "handoffRemovedBeforeRelocatedExecution", "deterministicReassembly"]);
		assert.equal(item.incapableReadersRejected, 3);
		assert.deepEqual(item.forgedAnchorContractsRejected, ["values", "anchor", "expiration", "descendants", "emptyValues", "aliases", "independentOwnership", "resourceEquality", "transfers"]);
		assert.deepEqual(item.model, model); assert.equal(item.fixtureSha256, sha256(probe));
		assert.equal(item.schemaVersion, 1); assert.equal(item.planNode, 1219);
		assert.equal(item.consumerSha256, sha256("#define OWNED_BORROW_INSTALLED 1\n" + probe.toString("utf8")));
		assert.deepEqual(item.checks, { pkgConfig: 407, cmake: 407, sanitized: 407 });
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), stdout: "42\n" });
		const { componentReceipt: component, adapterReceipt: adapter, manifest } = item;
		assert.equal(component.schemaVersion, 5); assert.equal(adapter.schemaVersion, 5);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.deepEqual(component.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(adapter.cppValues, cpp.contract);
		assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(manifest.schemaVersion, 5); assert.deepEqual(manifest.cppValues, cpp.contract);
		assert.deepEqual(manifest.ownedValues.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(manifest.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
		for(const [path, bytes] of Object.entries(cpp.files))
		{
			const expected = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) };
			assert.deepEqual(adapter.files[path], expected, path);
			if(!path.startsWith("src/")) assert.deepEqual(manifest.files[path], expected, path);
		}
		validatePackageSetReceipt(item.packageSetReceipt);
		assert.deepEqual(item.packageSetReceipt.packages.map(value => value.target).sort(), ["c", "cpp"]);
		assert.doesNotMatch(item.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:/u);
	}
};

/**
 * Require both compiler paths, exact enabled test command and retained reports.
 *
 * @param workflow - Current downstream workflow source.
 * @param manifest - Current package scripts.
 */
export const assertOwnedCppBorrowCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-cpp-borrows"], ownedCppBorrowScript);
	const step = workflow.split("id: type_corpus_c_family\n")[1]?.split("      - name:")[0];
	assert.ok(step?.includes("          npm run test:owned-cpp-borrows > build/owned-cpp-borrows.log 2>&1\n"));
	for(const summary of ["pass 5", "fail 0", "skipped 0"]) assert.ok(step.includes(`          rg '^# ${summary}$' build/owned-cpp-borrows.log\n`));
	for(const directory of ["owned-cpp-borrows", "owned-cpp-borrow-packaging"])
	{
		for(const mode of ["ordinary", "reviewed"]) assert.ok(step.includes(`          test -s build/${directory}/${mode}.json\n`));
		assert.ok(workflow.includes(`            build/${directory}/\n`));
	}
	assert.ok(workflow.includes("            build/owned-cpp-borrows.log\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-cpp-borrows"'));
	assert.ok(workflow.includes("steps.type_corpus_c_family.outcome != 'success'"));
};
