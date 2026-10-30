/**
 * Prove that the final #1220 audit closes only its exact original scope.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { before } from "node:test";
import { hostNullCompletePromotionEvidenceId }
	from "./host-null-complete-promotion.mjs";
import {
	assertVo1220ZeroGap, vo1220CellCount, vo1220ShapeCells
	, vo1220StageEntryCount, vo1220ZeroGapReport
} from "./vo1220-zero-gap.mjs";

const load = async () => {
	const [document, irSchema, consumers] = await Promise.all([
		"docs/type-surface.v1.json", "schema/binding-ir.schema.json"
		, "docs/consumer-support.v1.json"
	].map(async path => JSON.parse(await readFile(path, "utf8"))));
	return { document, contracts: { irSchema, consumers } };
};

let fixture;
before(async () => { fixture = await load(); });

test("#1220 zero-gap audit closes exactly 1,054 cells and 5,270 stages", async () => {
	const { document, contracts } = fixture;
	const report = assertVo1220ZeroGap(document, contracts);
	assert.equal(report.cells, vo1220CellCount);
	assert.equal(report.stageEntries, vo1220StageEntryCount);
	assert.deepEqual(report.shapeCells, vo1220ShapeCells);
	assert.equal(report.passedCells, 1054);
	assert.equal(report.evidence.includes(hostNullCompletePromotionEvidenceId), true);
});

test("#1220 zero-gap audit rejects one non-passing stage", async () => {
	const { document, contracts } = fixture;
	const candidate = structuredClone(document);
	const observation = candidate.observations.find(item =>
		item.shapes.some(shape => Object.hasOwn(vo1220ShapeCells, shape)));
	assert.ok(observation.limitations.length > 0);
	observation.stages.installedExecution.state = "limited";
	const report = vo1220ZeroGapReport(candidate, contracts);
	assert.ok(report.gaps.length > 0);
	assert.throws(() => assertVo1220ZeroGap(candidate, contracts));
});

test("#1220 zero-gap audit rejects inferred profile coverage", async () => {
	const { document, contracts } = fixture;
	const candidate = structuredClone(document);
	const observation = candidate.observations.find(item =>
		item.shapes.includes("host-null"));
	assert.ok(observation.profiles.length > 0);
	observation.profiles.pop();
	const report = vo1220ZeroGapReport(candidate, contracts);
	assert.ok(report.missingObservations.length > 0);
	assert.throws(() => assertVo1220ZeroGap(candidate, contracts));
});

test("#1220 zero-gap audit rejects owner and shape drift", async () => {
	const { document, contracts } = fixture;
	const wrongOwner = structuredClone(document);
	wrongOwner.families.generic.owner = 1218;
	assert.throws(() => assertVo1220ZeroGap(wrongOwner, contracts));
	const unclassified = structuredClone(document);
	unclassified.shapes.find(shape => shape.id === "host-null").ir
		= "constructor:unknown";
	assert.throws(() => assertVo1220ZeroGap(unclassified, contracts));
});
