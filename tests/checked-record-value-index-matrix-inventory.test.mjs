/**
 * Audit the promoted claims in a fresh process after archive replay exits.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkedRecordValueIndexMatrixConversion
	, checkedRecordValueIndexMatrixLimit
	, checkedRecordValueIndexMatrixProfiles
} from "./helpers/checked-record-value-index-matrix-promotion.mjs";

const lanes = Object.freeze({
	c: "native", cpp: "native", dotnet: "dotnet"
	, java: "jvm", kotlin: "jvm"
});
const routes = Object.freeze([
	"ordinary-source", "reviewed-ir"
	, "result-only-ordinary-source", "result-only-reviewed-ir"
]);
const prefix = "checked-record-value-index-";

test("public inventory contains exactly the final twenty matrix cells", async () => {
	const inventory = JSON.parse(await readFile(
		"docs/type-surface.v1.json", "utf8"));
	const expectedEvidence = Object.values(lanes).filter(
		(value, index, values) => values.indexOf(value) === index
	).flatMap(lane => routes.map(route =>
		`${prefix}${lane}-${route}-hosted-installed`));
	const evidence = inventory.evidence.filter(item =>
		expectedEvidence.includes(item.id));
	assert.deepEqual(evidence.map(item => item.id), expectedEvidence);
	assert.ok(evidence.every(item => item.kind === "installed"
		&& item.files.length > 0 && item.artifacts.length > 0));
	const promoted = inventory.observations.filter(observation =>
		Object.values(observation.stages).some(stage => stage.evidence.some(id =>
			expectedEvidence.includes(id))));
	assert.equal(promoted.length, 20);
	for(const observation of promoted)
	{
		assert.deepEqual(observation.shapes, ["checked-record"]);
		assert.equal(observation.profiles.length, 1);
		assert.ok(checkedRecordValueIndexMatrixProfiles.includes(
			observation.profiles[0]));
		assert.equal(observation.positions.length, 1);
		assert.ok(["parameter", "result"].includes(observation.positions[0]));
		assert.ok(observation.conversionNotes["checked-record"].includes(
			checkedRecordValueIndexMatrixConversion));
		assert.ok(observation.limitations.includes(
			checkedRecordValueIndexMatrixLimit));
		const lane = lanes[observation.profiles[0]];
		const expectedRoutes = observation.positions[0] === "result"
			? [observation.path, `result-only-${observation.path}`]
			: [observation.path];
		const expected = expectedRoutes.map(route =>
			`${prefix}${lane}-${route}-hosted-installed`);
		for(const stage of Object.values(observation.stages))
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith(`${prefix}${lane}-`)), expected);
	}
	const summary = await readFile(
		"docs/evidence/checked-record-value-index-matrix-promotion-20261020.md"
		, "utf8");
	for(const value of [
		"C and C++", ".NET", "Java and Kotlin", "17 consumer profiles"
		, "Bool", "String", "Nat", "20 parameter/result inventory cells"
	]) assert.ok(summary.includes(value), value);
});
