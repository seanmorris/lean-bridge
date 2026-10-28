/**
 * Controls for the proof-erasure evidence candidate ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditProofErasureEvidence } from "./proof-erasure-evidence-audit.mjs";
import { readTypeSurfaceContracts } from "./type-surface-contracts.mjs";

const inventory = async () => JSON.parse(await readFile(
	"docs/type-surface.v1.json", "utf8"
));

test("proof evidence audit partitions all 204 cells without promoting candidates", async () => {
	const result = auditProofErasureEvidence(
		await inventory(), await readTypeSurfaceContracts());
	assert.equal(result.cells.length, 204);
	assert.equal(result.candidates.length, 170);
	assert.equal(result.residual.length, 34);
	assert.ok(result.candidates.every(item =>
		item.verification === "pending-exact-replay"));
	assert.ok(result.residual.every(item =>
		item.cell.endsWith("/signature")));
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
});

test("proof evidence audit refuses a missing or non-installed candidate", async () => {
	const original = await inventory(), contracts = await readTypeSurfaceContracts();
	const id = "zero-payload-native-ordinary-source-hosted-installed";
	const missing = structuredClone(original);
	missing.evidence = missing.evidence.filter(item => item.id !== id);
	assert.throws(() => auditProofErasureEvidence(missing, contracts)
		, new RegExp(id));
	const inspected = structuredClone(original);
	inspected.evidence.find(item => item.id === id).kind = "inspection";
	assert.throws(() => auditProofErasureEvidence(inspected, contracts));
});

test("proof evidence audit refuses route drift and never binds signatures", async () => {
	const original = await inventory(), contracts = await readTypeSurfaceContracts();
	const id = "nested-checked-record-native-reviewed-full-installed";
	const changed = structuredClone(original);
	changed.evidence.find(item => item.id === id).id
		= "nested-checked-record-native-reviewed-moved-installed";
	assert.throws(() => auditProofErasureEvidence(changed, contracts)
		, new RegExp(id));
	const result = auditProofErasureEvidence(original, contracts);
	assert.equal(result.candidates.some(item =>
		item.cell.endsWith("/signature")), false);
});
