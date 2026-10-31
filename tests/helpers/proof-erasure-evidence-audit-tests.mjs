/**
 * Controls for the proof-erasure evidence candidate ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	auditProofErasureEvidence
	, proofErasureEvidenceAuditReport
	, proofErasureEvidenceAuditReportPath
} from "./proof-erasure-evidence-audit.mjs";
import { proofErasureEvidenceAuditImplementation }
	from "./proof-erasure-evidence-audit-source-history.mjs";
import { readTypeSurfaceContracts } from "./type-surface-contracts.mjs";

const inventoryPromise = readFile("docs/type-surface.v1.json", "utf8")
	.then(JSON.parse);
const contractsPromise = readTypeSurfaceContracts();
const inventory = () => inventoryPromise;
const contracts = () => contractsPromise;
const auditMilestoneInventory = () => JSON.parse(execFileSync("git", [
	"show", `${proofErasureEvidenceAuditImplementation}:docs/type-surface.v1.json`
], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }));
const auditMilestoneContracts = () => Object.fromEntries([
	["irSchema", "schema/binding-ir.schema.json"]
	, ["consumers", "docs/consumer-support.v1.json"]
].map(([name, path]) => [name
	, JSON.parse(execFileSync("git", [
		"show", `${proofErasureEvidenceAuditImplementation}:${path}`
	], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }))]));

test("proof evidence audit binds 102 exact cells and preserves 102 gaps", async () => {
	const result = auditProofErasureEvidence(
		auditMilestoneInventory(), auditMilestoneContracts());
	assert.equal(result.cells.length, 204);
	assert.equal(result.bindings.length, 102);
	assert.equal(result.residual.length, 102);
	assert.ok(result.bindings.every(item =>
		item.verification === "exact-retained-replay"));
	assert.ok(result.bindings.every(item =>
		item.retained.archiveIndex.path.endsWith("/index.json")
		&& item.retained.fixtureSource.path.includes("/sources/")
		&& item.retained.replaySource.path.endsWith(".mjs")
		&& item.retained.replayCommand.includes("node --test")));
	assert.deepEqual(Object.fromEntries([
		"field", "callback-parameter", "callback-result"
	].map(position => [position
		, result.bindings.filter(item =>
		item.cell.endsWith(`/${position}`)).length]
	)), {
		field: 34, "callback-parameter": 34, "callback-result": 34
	});
	assert.deepEqual(Object.fromEntries([
		"parameter", "result", "signature"
	].map(position => [position
		, result.residual.filter(item =>
		item.cell.endsWith(`/${position}`)).length]
	)), {
		parameter: 34, result: 34, signature: 34
	});
	assert.deepEqual(
		Object.fromEntries([
			"parameter", "result", "field", "callback-parameter"
			, "callback-result", "signature"
		].map(position => [position
			, result.cells.filter(cell =>
				cell.endsWith(`/${position}`)).length
		]))
		, {
			parameter: 34, result: 34, field: 34
			, "callback-parameter": 34, "callback-result": 34, signature: 34
		}
	);
	assert.deepEqual(JSON.parse(await readFile(
		proofErasureEvidenceAuditReportPath, "utf8"))
	, proofErasureEvidenceAuditReport(result));
});

test("proof evidence audit refuses a missing or non-installed candidate", async () => {
	const original = await inventory(), currentContracts = await contracts();
	const id = "zero-payload-native-ordinary-source-hosted-installed";
	const missing = structuredClone(original);
	missing.evidence = missing.evidence.filter(item => item.id !== id);
	assert.throws(() => auditProofErasureEvidence(missing, currentContracts)
		, new RegExp(id));
	const inspected = structuredClone(original);
	inspected.evidence.find(item => item.id === id).kind = "inspection";
	assert.throws(() => auditProofErasureEvidence(inspected, currentContracts));
});

test("proof evidence audit refuses route drift and never binds signatures", async () => {
	const original = await inventory(), currentContracts = await contracts();
	const id = "nested-checked-record-native-reviewed-full-installed";
	const changed = structuredClone(original);
	changed.evidence.find(item => item.id === id).id
		= "nested-checked-record-native-reviewed-moved-installed";
	assert.throws(() => auditProofErasureEvidence(changed, currentContracts)
		, new RegExp(id));
	const result = auditProofErasureEvidence(original, currentContracts);
	assert.equal(result.bindings.some(item =>
		item.cell.endsWith("/signature")), false);
});

test("proof evidence audit refuses fixture or archive substitution", async () => {
	const original = await inventory(), currentContracts = await contracts();
	const evidence = original.evidence.find(item =>
		item.id === "nested-checked-record-native-ordinary-full-installed");
	const fixture = evidence.files.find(file =>
		file.path.includes("/sources/")
		&& file.path.endsWith("/NestedCheckedRecords.lean"));
	const changedFixture = structuredClone(original);
	changedFixture.evidence.find(item => item.id === evidence.id).files.find(
		file => file.path === fixture.path).sha256 = "0".repeat(64);
	assert.throws(() => auditProofErasureEvidence(changedFixture, currentContracts));
	const changedIndex = structuredClone(original);
	changedIndex.evidence.find(item => item.id === evidence.id).files.find(
		file => file.path.endsWith("/index.json")).path += ".moved";
	assert.throws(() => auditProofErasureEvidence(changedIndex, currentContracts));
});
