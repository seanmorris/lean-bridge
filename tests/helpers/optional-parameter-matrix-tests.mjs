/**
 * Unit controls for the closed optional-parameter matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { optionalParameterProfiles } from "./optional-parameter-fixture.mjs";
import {
	optionalParameterMatrixLaneFor
	, optionalParameterMatrixCases
	, optionalParameterMatrixLanes
	, optionalParameterMatrixRoutes
	, validateOptionalParameterMatrixResults
} from "./optional-parameter-matrix.mjs";

const producer = "a".repeat(40);
const results = () => optionalParameterMatrixLanes.flatMap(lane =>
	optionalParameterMatrixRoutes.map(route => ({
		lane: lane.key, route: route.reportRoute, producerCommit: producer
		, profiles: [...lane.profiles], cases: { ...optionalParameterMatrixCases }
	}))
);

test("every optional profile belongs to exactly one installed lane", () => {
	assert.equal(optionalParameterMatrixLanes.length, 10);
	assert.deepEqual(optionalParameterMatrixLanes.flatMap(lane =>
		lane.profiles).sort(), [...optionalParameterProfiles].sort());
	for(const profile of optionalParameterProfiles)
		assert.ok(optionalParameterMatrixLaneFor(profile).profiles.includes(profile));
	assert.throws(() => optionalParameterMatrixLaneFor("unknown"));
});

test("the matrix requires all 34 ordinary and reviewed cells", () => {
	assert.deepEqual(validateOptionalParameterMatrixResults(
		results(), producer
	), { lanes: 10, routes: 2, profiles: 17, cells: 34 });
	for(const mutate of [
		value => { value.pop(); }
		, value => { value[0].producerCommit = "b".repeat(40); }
		, value => { value[0].profiles = []; }
		, value => { value[0].cases.explicitHostNull = false; }
	]) {
		const changed = results(); mutate(changed);
		assert.throws(() =>
			validateOptionalParameterMatrixResults(changed, producer));
	}
});
