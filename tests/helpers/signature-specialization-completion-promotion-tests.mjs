/**
 * Keep signature completion tied to one immutable archive and 45 cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	typeSurfaceCells
} from "../../src/adoption/type-surface.mjs";
import {
	signatureSpecializationCompletionEvidenceId
	, signatureSpecializationCompletionReference
	, signatureSpecializationCompletionTargetCells
} from "./signature-specialization-completion-promotion.mjs";

test("signature completion references one immutable ten-lane archive", async () => {
	const reference = await signatureSpecializationCompletionReference();
	assert.ok(reference.artifacts.length >= 10);
	assert.equal(Object.keys(reference.index.producerCommits).length, 10);
	assert.equal(new Set(Object.values(reference.index.producerCommits)).size, 3);
	assert.deepEqual(reference.artifacts.map(item => item.path)
		, reference.index.lanes.flatMap(lane =>
			lane.hostedRun.artifact.parts.map(part => part.path)));
	assert.ok(reference.files.some(file => file.path.endsWith("/index.json")));
	assert.ok(reference.files.some(file =>
		file.path.endsWith("hosted-evidence.test.mjs")));
	for(const file of [...reference.files, ...reference.artifacts])
		assert.match(file.sha256, /^[a-f0-9]{64}$/u, file.path);
});

test("signature completion closes exactly its 45 installed cells", async () => {
	const [document, irSchema, consumers] = await Promise.all([
		"docs/type-surface.v1.json", "schema/binding-ir.schema.json"
		, "docs/consumer-support.v1.json"
	].map(async path => JSON.parse(await readFile(path, "utf8"))));
	const contracts = { irSchema, consumers };
	const cells = typeSurfaceCells(document, contracts);
	const targets = new Map(cells.filter(cell =>
		signatureSpecializationCompletionTargetCells.includes(cell.id))
	.map(cell => [cell.id, cell]));
	assert.equal(targets.size, 45);
	for(const [id, cell] of targets)
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed", id);
			assert.deepEqual(stage.evidence
				, [signatureSpecializationCompletionEvidenceId], id);
		}
});
