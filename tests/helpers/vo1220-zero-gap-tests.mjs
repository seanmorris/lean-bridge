/**
 * Prove that the final #1220 audit closes only its exact original scope.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { before } from "node:test";
import {
	hostNullCompleteHostedLanes
} from "./host-null-complete-hosted-archive.mjs";
import {
	hostNullCompletePromotionEvidenceId
	, hostNullCompletePromotionReferencePaths, promoteHostNullComplete
} from "./host-null-complete-promotion.mjs";
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
const revision = "2".repeat(40);
const reference = Object.freeze({
	id: hostNullCompletePromotionEvidenceId, revision
	, command: "hosted complete HostNull command"
	, scope: "hosted complete HostNull scope"
	, files: Object.freeze(hostNullCompletePromotionReferencePaths.map(
		(path, index) => ({
			path, sha256: ((index + 2) % 16).toString(16).repeat(64)
		})
	))
	, artifacts: Object.freeze(hostNullCompleteHostedLanes.map((lane, index) => ({
		path: `${lane.artifactPrefix}-${revision}.zip`
		, sha256: "abcdef0"[index].repeat(64)
	})))
	, limitations: Object.freeze(Array.from({ length: 6 }, (_, index) =>
		`complete hosted limitation ${index + 1}`))
});

const proposed = async () => {
	const { document, contracts } = await load();
	const report = vo1220ZeroGapReport(document, contracts);
	return {
		document: report.gaps.length === 0 ? document
			: promoteHostNullComplete(document, contracts, reference)
		, contracts
	};
};

let fixture;
before(async () => { fixture = await proposed(); });

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
