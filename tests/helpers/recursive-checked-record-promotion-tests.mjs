/**
 * Aggregate recursive checked-record promotion contract. The native hosted
 * archive pin turns all 36 references into a hard public-inventory gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	readTypeSurface, typeSurfaceCells, validateTypeSurface
} from "../../src/adoption/type-surface.mjs";
import {
	mutualCheckedRecordNativeEvidence
	, mutualCheckedRecordNativeEvidenceSha256
} from "./mutual-checked-record-native-evidence.mjs";
import {
	assertExactRecursiveCheckedRecordReferences
	, promoteRecursiveCheckedRecords, recursiveCheckedRecordBoundary
	, recursiveCheckedRecordConversion, recursiveCheckedRecordPromotionLanes
	, recursiveCheckedRecordReferences
} from "./recursive-checked-record-promotion.mjs";
import {
	recursiveCheckedRecordPromotionHistoryPath
	, recursiveCheckedRecordPromotionPredecessor
} from "./recursive-checked-record-promotion-source-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
} from "./source-history-test-source.mjs";

const complete = mutualCheckedRecordNativeEvidenceSha256 !== null;
const inventoryPath = "docs/type-surface.v1.json";
const inventory = () => JSON.parse(execFileSync("git", ["show"
	, `${recursiveCheckedRecordPromotionPredecessor}:${inventoryPath}`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
const expectedProfiles = [
	"browser-javascript", "browser-react", "browser-worker", "c", "cpp"
	, "dotnet", "java", "kotlin", "node-javascript", "node-typescript"
	, "perl", "php-native", "php-wasm", "python", "ruby", "rust", "wit-wasi"
];
const recursiveDocumentation = [
	["docs/javascript-typescript.md"
		, "(evidence/recursive-checked-record-promotion-20261018.md)"]
	, ["docs/php.md"
		, "(evidence/recursive-checked-record-promotion-20261018.md)"]
	, ...["c", "cpp", "dotnet", "java", "kotlin", "perl", "python", "ruby"
		, "rust", "wit-wasi"].map(name => [
		`docs/consume/${name}.md`
		, "(../evidence/recursive-checked-record-promotion-20261018.md)"
		])
	, ["docs/lean/existing-package.md"
		, "(../evidence/recursive-checked-record-promotion-20261018.md)"]
	, ["docs/reference/types.md"
		, "(../evidence/recursive-checked-record-promotion-20261018.md)"]
];

test("recursive native archive index names exactly the tracked files", async () => {
	const index = JSON.parse(await readFile(
		`${mutualCheckedRecordNativeEvidence}/index.json`, "utf8"));
	const prefix = `${mutualCheckedRecordNativeEvidence}/`;
	const tracked = execFileSync("git", ["ls-files", "--", `${prefix}*`]
		, { encoding: "utf8" }).trim().split("\n").filter(Boolean)
		.map(path => path.slice(prefix.length)).sort();
	assert.deepEqual(tracked
		, ["index.json", ...index.files.map(file => file.path)].sort());
});

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

test("recursive checked-record documentation names the accepted graph and boundary", async () => {
	for(const [path, link] of recursiveDocumentation)
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes(link), `${path} links the acceptance record`);
		for(const name of ["Packet", "Envelope", "Step"])
			assert.match(source, new RegExp(`\\b${name}\\b`, "u"), `${path} names ${name}`);
		for(const boundary of ["callback", "cyclic host"])
			assert.ok(source.includes(boundary), `${path} retains the ${boundary} boundary`);
		assert.doesNotMatch(source
			, /Recursive checked-record combinations remain separate work\./u);
	}
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

test("recursive promotion changes exactly 102 copied checked-record cells", {
	skip: !complete, timeout: 900_000
}, async () => {
	const original = inventory();
	const references = await recursiveCheckedRecordReferences();
	const proposal = await promoteRecursiveCheckedRecords(original, references);
	const promoted = withHistoryMilestoneSourcePins(
		recursiveCheckedRecordPromotionHistoryPath, proposal
	);
	const { document: current, ...contracts } = await readTypeSurface();
	const milestone = JSON.parse(sourceAtHistoryMilestone(
		recursiveCheckedRecordPromotionHistoryPath, inventoryPath
	));
	validateTypeSurface(promoted, contracts);
	assert.deepEqual(current, milestone);
	assert.deepEqual(milestone, promoted);
	assert.equal(promoted.evidence.length, original.evidence.length + 36);
	assert.equal(promoted.observations.length, original.observations.length);
	assert.deepEqual(proposal.evidence.slice(0, original.evidence.length)
		, original.evidence);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(promoted, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "checked-record");
		assert.ok(expectedProfiles.includes(cell.profile));
		assert.ok(["ordinary-source", "reviewed-ir"].includes(cell.path));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(cell.conversionNote.includes(recursiveCheckedRecordConversion));
		assert.ok(cell.limitations.includes(recursiveCheckedRecordBoundary));
		const lane = recursiveCheckedRecordPromotionLanes.find(item =>
			item.profiles.includes(cell.profile));
		const ids = references.filter(item => item.lane === lane.id
			&& item.sourcePath === cell.path).map(item => item.id);
		assert.equal(ids.length, lane.fixtures.length);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith(`recursive-checked-record-${lane.id}-`)), ids);
		}
		changed.push(cell.id);
	}
	assert.equal(changed.length, 102);
	assert.equal(new Set(changed).size, 102);
	assert.deepEqual(original, inventory());
});

test("recursive promotion refuses missing, reordered, forged and duplicate evidence", {
	skip: !complete, timeout: 900_000
}, async () => {
	const original = inventory();
	const references = await recursiveCheckedRecordReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteRecursiveCheckedRecords(original, changed));
	for(const mutate of [
		item => ({ ...item, profiles: item.profiles.slice(0, -1) })
		, item => ({ ...item, positions: item.positions.slice(0, -1) })
		, item => ({ ...item, revision: "0".repeat(40) })
		, item => ({ ...item, files: item.files.slice(0, -1) })
		, item => ({ ...item, artifacts: item.artifacts.slice(0, -1) })
		, item => ({ ...item, scope: "Every recursive record works" })
	]) {
		const changed = [...references];
		changed[0] = mutate(changed[0]);
		await assert.rejects(promoteRecursiveCheckedRecords(original, changed));
	}
});
