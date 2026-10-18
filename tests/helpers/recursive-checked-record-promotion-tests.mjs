/**
 * Pre-promotion topology and fail-closed controls for the complete recursive
 * checked-record matrix. Aggregate archive tests become active only after the
 * native hosted index is pinned.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	mutualCheckedRecordNativeEvidenceSha256
} from "./mutual-checked-record-native-evidence.mjs";
import {
	assertExactRecursiveCheckedRecordReferences
	, recursiveCheckedRecordPromotionLanes, recursiveCheckedRecordReferences
} from "./recursive-checked-record-promotion.mjs";

const complete = mutualCheckedRecordNativeEvidenceSha256 !== null;
const expectedProfiles = [
	"browser-javascript", "browser-react", "browser-worker", "c", "cpp"
	, "dotnet", "java", "kotlin", "node-javascript", "node-typescript"
	, "perl", "php-native", "php-wasm", "python", "ruby", "rust", "wit-wasi"
];

test("recursive promotion lanes partition all seventeen profiles and 36 selections", () => {
	assert.equal(recursiveCheckedRecordPromotionLanes.length, 11);
	const actualProfiles = recursiveCheckedRecordPromotionLanes.flatMap(lane =>
		lane.profiles);
	assert.equal(new Set(actualProfiles).size, actualProfiles.length);
	assert.deepEqual(actualProfiles.sort(), [...expectedProfiles].sort());
	assert.deepEqual(recursiveCheckedRecordPromotionLanes.map(lane => lane.id), [
		"native", "browser", "jvm", "dotnet", "python", "ruby", "perl"
		, "php", "php-wasm", "rust", "wit"
	]);
	assert.equal(recursiveCheckedRecordPromotionLanes.reduce((sum, lane) =>
		sum + lane.fixtures.length * 2, 0), 36);
});

test("recursive promotion remains closed until native hosted evidence is pinned", {
	skip: complete
}, async () => {
	assert.equal(mutualCheckedRecordNativeEvidenceSha256, null);
	await assert.rejects(recursiveCheckedRecordReferences());
});

test("recursive promotion authenticates the exact 36-reference matrix", {
	skip: !complete
}, async () => {
	const references = await recursiveCheckedRecordReferences();
	assert.equal(references.length, 36);
	assert.equal(new Set(references.map(item => item.id)).size, 36);
	for(const lane of recursiveCheckedRecordPromotionLanes)
	{
		const selected = references.filter(item => item.lane === lane.id);
		assert.equal(selected.length, lane.fixtures.length * 2);
		for(const reference of selected)
		{
			assert.deepEqual(reference.profiles, lane.profiles);
			assert.deepEqual(reference.positions, ["parameter", "result", "field"]);
			assert.equal(reference.sourcePath, reference.route === "ordinary"
				? "ordinary-source" : "reviewed-ir");
			assert.ok(reference.files.some(file => file.path
				=== `${lane.evidence}/index.json`));
			assert.ok(reference.artifacts.length > 0);
		}
	}
	await assertExactRecursiveCheckedRecordReferences(references);
	for(const changed of [
		references.slice(1), references.slice().reverse()
		, [...references, references[0]]
	]) await assert.rejects(assertExactRecursiveCheckedRecordReferences(changed));
	const forged = structuredClone(references);
	forged[0].revision = "0".repeat(40);
	await assert.rejects(assertExactRecursiveCheckedRecordReferences(forged));
});
