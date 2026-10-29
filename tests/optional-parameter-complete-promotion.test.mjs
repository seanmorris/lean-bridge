/**
 * Audit the published optional-parameter cells and their exact evidence pins.
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
	optionalParameterCompleteCells, optionalParameterCompleteEvidenceId
	, optionalParameterCompleteGroups, optionalParameterCompletePaths
	, optionalParameterCompleteReferencePaths
} from "./helpers/optional-parameter-complete-promotion.mjs";

test("complete optional-parameter publication owns exactly 34 passed cells"
	, async () => {
		const [inventory, irSchema, consumers] = await Promise.all([
			"docs/type-surface.v1.json", "schema/binding-ir.schema.json"
			, "docs/consumer-support.v1.json"
		].map(async path => JSON.parse(await readFile(path, "utf8"))));
		const contracts = { irSchema, consumers };
		assert.equal(validateTypeSurface(inventory, contracts), true);
		const evidence = inventory.evidence.filter(item =>
			item.id === optionalParameterCompleteEvidenceId);
		assert.equal(evidence.length, 1);
		assert.deepEqual(evidence[0].files.map(item => item.path)
			, optionalParameterCompleteReferencePaths);
		for(const file of evidence[0].files)
			assert.equal(file.sha256, sha256(await readFile(file.path)), file.path);
		assert.equal(evidence[0].artifacts.length, 11);

		const cells = new Map(typeSurfaceCells(inventory, contracts).map(cell =>
			[cell.id, cell]));
		assert.equal(optionalParameterCompleteCells.length, 34);
		for(const id of optionalParameterCompleteCells)
		{
			const cell = cells.get(id);
			assert.ok(cell, id);
			for(const stage of Object.values(cell.stages))
			{
				assert.equal(stage.state, "passed", id);
				assert.deepEqual(stage.evidence
					, [optionalParameterCompleteEvidenceId], id);
			}
			assert.match(cell.conversionNote
				, /Option\.none, Unit and explicit host null/u);
		}

		const expected = optionalParameterCompleteGroups.flatMap(group =>
			optionalParameterCompletePaths.map(path =>
				`optional-parameter-complete-${group.id}-${path}`));
		assert.deepEqual(inventory.observations.filter(item =>
			expected.includes(item.id)).map(item => item.id).sort()
			, expected.sort());
		const documentation = await Promise.all([
			"docs/lean/existing-package.md", "docs/lean/export-decisions.md"
		].map(path => readFile(path, "utf8")));
		assert.match(documentation[0]
			, /Omission never means null, Unit or `Option\.none`/u);
		assert.match(documentation[1]
			, /target-idiomatic omission without changing the full-arity ABI/u);
	}
);
