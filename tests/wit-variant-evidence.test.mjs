/**
 * Bind named WIT variants to real installed archives and separate fault probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { validateWitEvidence } from "./helpers/type-corpus-wit-evidence.mjs";
import { witVariantReviewedIr, witVariantSignatures, validateWitVariantSignatures, checkWitVariantManifest, witVariantConsumer } from "./helpers/wit-variant-fixture.mjs";
import { witVariantFaultSource } from "./helpers/wit-variant-faults.mjs";

const observation = value => ({ ...value, loadedLibraries: undefined });
const expectedObservation = { hostVersion: "42.0.1", checks: 476219, calls: 1936
	, rejections: 53, primitives: 19, families: 10, constructors: 281
	, wideCases: 257, copiesSurviveSessionClose: true, results: []
	, loadedLibraries: undefined };
const contracts = ir => ({
	declarations: ir.declarations.map(fn => ({ id: fn.id, parameters: fn.parameters.map(site => site.type), result: fn.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, target: type.target
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) })).sort((a, b) => a.id.localeCompare(b.id))
});

test("WIT variants bind named contracts, original installed bytes and independent reproduction", async () => {
	// Historical converter bytes stay fixed; collection acceptance checks the current converters.
	const bytes = await readFile("docs/evidence/wit-variants-20260921.json");
	assert.equal(sha256(bytes), "f726e1fc373051ab9a25d38cc9f10797f31e99b5a6eb7a9148c6e0018bb6122f");
	const record = JSON.parse(bytes);
	assert.deepEqual(record.profiles, ["wit-wasi"]); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.signatures, witVariantSignatures);
	const ir = witVariantReviewedIr();
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(ir)));
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const [path, hash] of Object.entries(record.sourceHashes))
		if(path !== "tests/wit-variant-evidence.test.mjs") assert.equal(sha256(await readFile(path)), hash, path);
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports: record.executions })));
	const source = await witVariantConsumer();
	const fixture = { source, validateSignatures: validateWitVariantSignatures
		, validateObservation: value => assert.deepEqual(observation(value), expectedObservation) };
	assert.deepEqual(record.reproduction.reports.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	assert.match(record.reproduction.reportSha256, /^[a-f0-9]{64}$/);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "wit-wasi"); assert.deepEqual(run.contracts, JSON.parse(canonicalJson(contracts(ir))));
		assert.equal(run.sourceRemovedBeforeInstallation, true); assert.equal(run.handoffRemovedBeforeExecution, true);
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, "wit-wasi"); assert.equal(pkg.role, "component");
		assert.equal(pkg.artifacts.length, 1);
		for(const name of ["receiptSha256", "bindingIrSha256", "sourceTreeSha256", "modelSha256"]) assert.match(run[name], /^[a-f0-9]{64}$/);
		assert.equal(run.wit.componentReceipt.sourceIdentity.sourceTreeSha256, run.sourceTreeSha256);
		checkWitVariantManifest(run.bindingManifest, ir);
		assert.equal(run.bindingManifest.bindingIrSha256, run.bindingIrSha256);
		assert.equal(run.wit.packageReceipt.files["binding-manifest.json"].sha256, sha256(canonicalJson(run.bindingManifest)));
		assert.equal(Object.keys(run.wit.packageReceipt.files).length, 68);
		assert.equal(Object.keys(run.wit.libraries).length, 6);
		const checked = { ...run, archive: pkg, archiveSha256: pkg.artifacts[0].sha256
			, runtimeIdentity: pkg.runtimeIdentity
			, declarationEvidence: { modelSha256: run.modelSha256 } };
		validateWitEvidence(checked, { cModule: "variants" }, fixture);
		const rebuilt = record.reproduction.reports.find(item => item.path === run.path);
		assert.notEqual(rebuilt.deploymentRoot, run.wit.deploymentRoot);
		assert.deepEqual(rebuilt.packages, run.packages);
		assert.equal(rebuilt.packageFilesSha256, sha256(canonicalJson(run.wit.packageReceipt.files)));
		assert.equal(rebuilt.componentSha256, run.wit.packageReceipt.componentSha256);
		assert.deepEqual(rebuilt.observation, JSON.parse(canonicalJson(expectedObservation)));
		for(const mutate of [
			value => { value.wit.repeatExecutions = 0; }
			, value => { value.wit.packageReceipt.files["lib/libvariants_wasmtime.so"].sha256 = "f".repeat(64); }
			, value => {
				const doc = value.wit.declarations.component.document, iface = doc.interfaces.find(item => item.name === "native");
				doc.types[iface.types["signal-marker-fields"]].kind.record.fields[0].type = "u32";
			}
			, value => { value.observation.rejections = 0; }
		]) {
			const mutant = structuredClone(checked); mutate(mutant);
			assert.throws(() => validateWitEvidence(mutant, { cModule: "variants" }, fixture));
		}
	}
	assert.doesNotMatch(source, /#include "variants\.h"|lean_ctor_|lb_in_|lb_out_|dlopen|dlsym/);
	const faults = record.faultProbe, model = compileCopiedWitModel(ir);
	assert.equal(record.faultReportSha256, sha256(canonicalJson(faults)));
	assert.equal(faults.synthetic, true); assert.deepEqual(faults.sanitizers, ["address", "undefined", "leak"]);
	assert.ok(faults.compilerOptions.includes("-fsanitize=address,undefined"));
	assert.equal(faults.sourceSha256, sha256(await witVariantFaultSource(model)));
	assert.equal(faults.headerSha256, sha256(generateCBindingPackage(ir)["include/variants.h"]));
	assert.deepEqual(faults.observation, { checks: 688008, scratchFailures: 25
		, inputBudgetFailures: 113855, outputBudgetFailures: 108251
		, malformedOutputs: 19, inactivePayloads: 22, partialInputs: 1
		, families: 10, liveAllocations: 0 });
});

test("WIT variant support advances six copied cells and stays required in CI", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("wit-wasi-variants-installed"));
	assert.equal(cells.length, 6);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "wit-wasi"); assert.equal(cell.shape, "variant");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["wit-wasi-variants-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_WIT_VARIANT_TEST=1 node --test --test-concurrency=1 tests/wit-variants.test.mjs tests/wit-variant-contract.test.mjs tests/wit-variant-conversions.test.mjs"));
	for(const name of ["wit", "wit-conversions"])
	{
		assert.ok(workflow.includes("test -s build/variants/" + name + ".json"));
		assert.ok(workflow.includes("            build/variants/" + name + ".json"));
	}
});
