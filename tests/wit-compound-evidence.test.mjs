/**
 * Verify installed compound receipts separately from synthetic converter evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { compoundSignatures } from "./helpers/compound-fixture.mjs";
import { assertCompoundSourceHash } from "./helpers/compound-source-history.mjs";
import { validateWitEvidence } from "./helpers/type-corpus-wit-evidence.mjs";
import { validateWitCompoundSignatures, witCompoundConsumer } from "./helpers/wit-compound-fixture.mjs";
import { witCompoundFaultIr, witCompoundFaultSource } from "./helpers/wit-compound-faults.mjs";

test("WIT compound evidence binds both source paths to installed packages and parsed declarations", async () => {
	// Historical converter bytes stay fixed; collection acceptance checks the current converters.
	const bytes = await readFile("docs/evidence/wit-compounds-20260920.json");
	assert.equal(sha256(bytes), "e2c3616ea66dad8473ce9b66990cd3d6d71abf49dc1cdc9e7c8ecb0cbfd822e7");
	const record = JSON.parse(bytes);
	assert.deepEqual(record.profiles, ["wit-wasi"]); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.signatures, compoundSignatures);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assertCompoundSourceHash(path, await readFile(path), hash);
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports: record.executions })));
	const source = await witCompoundConsumer(), sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	const fixture = { source
		, validateSignatures: validateWitCompoundSignatures
		, validateObservation: observation => {
			assert.equal(observation.checks, 390113); assert.equal(observation.rejections, 86);
			assert.equal(observation.primitives, 19); assert.ok(observation.calls > 4500);
			assert.equal(observation.copiesSurviveSessionClose, true);
		}
	};
	for(const run of record.executions)
	{
		assert.equal(run.profile, "wit-wasi"); assert.deepEqual(sort(run.signatures), sort(compoundSignatures));
		assert.equal(run.sourceRemovedBeforeInstallation, true); assert.equal(run.handoffRemovedBeforeExecution, true);
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, "wit-wasi"); assert.equal(pkg.role, "component");
		assert.equal(pkg.artifacts.length, 1);
		for(const name of ["receiptSha256", "bindingIrSha256", "sourceTreeSha256", "modelSha256"]) assert.match(run[name], /^[a-f0-9]{64}$/);
		assert.equal(run.wit.componentReceipt.sourceIdentity.sourceTreeSha256, run.sourceTreeSha256);
		const checked = { ...run, archive: pkg
			, archiveSha256: pkg.artifacts[0].sha256
			, runtimeIdentity: pkg.runtimeIdentity
			, declarationEvidence: { modelSha256: run.modelSha256 } };
		validateWitEvidence(checked, { cModule: "compounds" }, fixture);
		for(const mutate of [
			value => { value.wit.repeatExecutions = 0; }
			, value => { value.wit.packageReceipt.files["lib/libcompounds_wasmtime.so"].sha256 = "f".repeat(64); }
			, value => { value.wit.declarations.component.document.interfaces.find(iface => iface.name === "api").functions["option-unit"].result = "bool"; }
			, value => { value.observation.rejections = 0; }
		]) {
			const mutant = structuredClone(checked); mutate(mutant);
			assert.throws(() => validateWitEvidence(mutant, { cModule: "compounds" }, fixture));
		}
	}
	assert.doesNotMatch(source, /#include "compounds\.h"|lean_ctor_|lb_in_|lb_out_|dlopen|dlsym/);
	const faults = record.faultProbe, ir = witCompoundFaultIr(), model = compileCopiedWitModel(ir);
	assert.equal(faults.synthetic, true);
	assert.deepEqual(faults.sanitizers, ["address", "undefined", "leak"]);
	assert.ok(faults.compilerOptions.includes("-fsanitize=address,undefined"));
	assert.equal(faults.sourceSha256, sha256(witCompoundFaultSource(model)));
	assert.equal(faults.headerSha256, sha256(generateCBindingPackage(ir)["include/probe.h"]));
	assert.deepEqual(faults.observation, { checks: 3055, scratchFailures: 4, budgetFailures: 812, malformedOutputs: 8, inactivePayloads: 3, liveAllocations: 0 });
});
