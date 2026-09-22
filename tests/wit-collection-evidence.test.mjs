/**
 * Bind WIT collection support to original archives and independent fault probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { renderWitConversions, witConversionPrelude } from "../src/backends/wit/copied-conversions.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";
import { validateWitEvidence } from "./helpers/type-corpus-wit-evidence.mjs";
import { validateWitCollectionSignatures, witCollectionConsumer } from "./helpers/wit-collection-fixture.mjs";
import { witCollectionFaultIr, witCollectionFaultSource } from "./helpers/wit-collection-faults.mjs";
import { witListFaultIr } from "./helpers/wit-list-faults.mjs";
import { witCompoundFaultIr } from "./helpers/wit-compound-faults.mjs";
import { witAliasFaultIr } from "./helpers/wit-alias-faults.mjs";
import { witVariantReviewedIr } from "./helpers/wit-variant-fixture.mjs";

const receipt = async () => JSON.parse(await readFile("docs/evidence/wit-collections-20260922.json"));
const withoutPaths = value => { const copy = { ...value }; delete copy.loadedLibraries; return copy; };
const observation = { hostVersion: "42.0.1", checks: 800719, calls: 2836
	, rejections: 75, primitives: 19, records: 7
	, copiesSurviveSessionClose: true, results: [] };

test("WIT collections bind all original signatures and both reproducible installed paths", async () => {
	const record = await receipt(), source = await witCollectionConsumer();
	assert.equal(record.schemaVersion, 1); assert.deepEqual(record.profiles, ["wit-wasi"]); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.signatures, collectionSignatures);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(collectionReviewedIr())));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	for(const [path, hash] of Object.entries(record.generatorSourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports: record.executions })));
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	assert.equal(record.reproduction.runs.length, 2);
	const fixture = { source, validateSignatures: validateWitCollectionSignatures
		, validateObservation: value => assert.deepEqual(withoutPaths(value), observation) };
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	for(const run of record.executions)
	{
		assert.equal(run.profile, "wit-wasi"); assert.deepEqual(sort(run.signatures), sort(collectionSignatures));
		assert.equal(run.sourceRemovedBeforeInstallation, true); assert.equal(run.handoffRemovedBeforeExecution, true);
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.target, "wit-wasi"); assert.equal(pkg.role, "component"); assert.equal(pkg.artifacts.length, 1);
		assert.equal(run.wit.componentReceipt.sourceIdentity.sourceTreeSha256, run.sourceTreeSha256);
		assert.equal(Object.keys(run.wit.packageReceipt.files).length, 68);
		const checked = { ...run, archive: pkg, archiveSha256: pkg.artifacts[0].sha256
			, runtimeIdentity: pkg.runtimeIdentity
			, declarationEvidence: { modelSha256: run.modelSha256 } };
		validateWitEvidence(checked, { cModule: "collections" }, fixture);
		const rebuilt = record.reproduction.runs.find(item => item.path === run.path); assert.ok(rebuilt);
		assert.notEqual(rebuilt.deploymentRoot, run.wit.deploymentRoot);
		assert.deepEqual(rebuilt.packages, run.packages);
		assert.equal(rebuilt.packageFilesSha256, sha256(canonicalJson(run.wit.packageReceipt.files)));
		assert.equal(rebuilt.componentSha256, run.wit.packageReceipt.componentSha256);
		assert.equal(rebuilt.executableSha256, run.wit.executableSha256);
		assert.deepEqual(rebuilt.observation, observation);
		for(const mutate of [
			value => { value.wit.repeatExecutions = 0; }
			, value => { value.wit.packageReceipt.files["lib/libcollections_wasmtime.so"].sha256 = "f".repeat(64); }
			, value => {
				const doc = value.wit.declarations.component.document, iface = doc.interfaces.find(iface => iface.name === "api");
				const type = doc.types[iface.functions["record-inspect"].params[0].type];
				assert.equal(type.kind.record.fields[16].name, "char");
				type.kind.record.fields[16].name = "char-";
			}
			, value => { value.observation.rejections = 0; }
		]) {
			const mutant = structuredClone(checked); mutate(mutant);
			assert.throws(() => validateWitEvidence(mutant, { cModule: "collections" }, fixture));
		}
	}
	assert.doesNotMatch(source, /#include "collections\.h"|lean_ctor_|lb_in_|lb_out_|dlopen|dlsym/u);
});

test("WIT collection failure probes and all current regressions retain their scope", async () => {
	const record = await receipt(), faults = record.faultProbe;
	const ir = witCollectionFaultIr(), model = compileCopiedWitModel(ir);
	assert.equal(record.faultReportSha256, sha256(canonicalJson(faults)));
	assert.equal(faults.synthetic, true); assert.equal(faults.bindingIrSha256, model.manifest.bindingIrSha256);
	assert.deepEqual(faults.sanitizers, ["address", "undefined", "leak"]);
	assert.ok(faults.compilerOptions.includes("-fsanitize=address,undefined"));
	assert.equal(faults.sourceSha256, sha256(await witCollectionFaultSource(model)));
	assert.equal(faults.conversionsSha256, sha256(witConversionPrelude + renderWitConversions(model)));
	assert.equal(faults.headerSha256, sha256(generateCBindingPackage(ir)["include/probe.h"]));
	assert.deepEqual(faults.observation, { checks: 52227, scratchFailures: 13
		, inputBudgetFailures: 4386, outputBudgetFailures: 6941
		, rawBoolRejections: 1778, malformedInputs: 11, malformedOutputs: 15
		, emptyPoisonPointers: 8, partialInputs: 1, inactivePayloads: 2
		, liveAllocations: 0 });
	assert.deepEqual(record.regressions.map(run => run.name), ["lists", "compounds", "aliases", "variants", "callables", "ordinary"]);
	const probes = { lists: witListFaultIr, compounds: witCompoundFaultIr
		, aliases: witAliasFaultIr, variants: witVariantReviewedIr };
	for(const run of record.regressions)
	{
		assert.equal(run.log.sha256, sha256(run.log.text)); assert.match(run.log.text, /# fail 0\n/u);
		assert.match(run.log.text, /# skipped 0\n/u); assert.ok(run.passed > 0);
		if(probes[run.name])
		{
			const model = compileCopiedWitModel(probes[run.name]());
			assert.equal(run.faultProbe.synthetic, true);
			assert.equal(run.faultProbe.conversionsSha256, sha256(witConversionPrelude + renderWitConversions(model)));
			assert.equal(run.faultProbe.observation.liveAllocations, 0);
		}
	}
});

test("WIT collection promotion names only reviewed collection and primitive-field cells", async () => {
	const { document, ...contracts } = await readTypeSurface(), id = "wit-wasi-collections-installed";
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes(id));
	assert.equal(cells.length, 22);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "wit-wasi"); assert.equal(cell.path, "reviewed-ir");
		assert.equal(cell.stages.installedExecution.state, "passed");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_WIT_COLLECTION_TEST=1 node --test --test-concurrency=1 tests/wit-collections.test.mjs tests/wit-collection-contract.test.mjs tests/wit-collection-conversions.test.mjs"));
	for(const name of ["wit", "wit-conversions"]) assert.ok(workflow.includes(`test -s build/collections/${name}.json`));
});
