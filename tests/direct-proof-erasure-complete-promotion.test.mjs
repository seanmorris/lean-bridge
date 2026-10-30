/**
 * Audit the published direct proof-erasure cells and exact evidence pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { typeSurfaceCells, validateTypeSurface }
	from "../src/adoption/type-surface.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import {
	directProofErasureCompleteCells, directProofErasureCompleteEvidenceId
	, directProofErasureCompleteReferencePaths
} from "./helpers/direct-proof-erasure-complete-promotion.mjs";

test("complete direct proof-erasure publication owns exactly 204 passed cells"
	, async () => {
		const [inventory, irSchema, consumers] = await Promise.all([
			"docs/type-surface.v1.json", "schema/binding-ir.schema.json"
			, "docs/consumer-support.v1.json"
		].map(async path => JSON.parse(await readFile(path, "utf8"))));
		const contracts = { irSchema, consumers };
		assert.equal(validateTypeSurface(inventory, contracts), true);
		const evidence = inventory.evidence.filter(item =>
			item.id === directProofErasureCompleteEvidenceId);
		assert.equal(evidence.length, 1);
		assert.deepEqual(evidence[0].files.map(item => item.path)
			, directProofErasureCompleteReferencePaths);
		for(const file of evidence[0].files)
			assert.equal(file.sha256, sha256(await readFile(file.path)), file.path);
		assert.equal(evidence[0].artifacts.length, 11);

		const cells = new Map(typeSurfaceCells(inventory, contracts).map(cell =>
			[cell.id, cell]));
		assert.equal(directProofErasureCompleteCells.length, 204);
		for(const id of directProofErasureCompleteCells)
		{
			const cell = cells.get(id);
			assert.ok(cell, id);
			for(const stage of Object.values(cell.stages))
			{
				assert.equal(stage.state, "passed", id);
				assert.deepEqual(stage.evidence
					, [directProofErasureCompleteEvidenceId], id);
			}
			assert.match(cell.conversionNote
				, /null, Unit, defaults or fabricated proofs/u);
		}
	}
);
