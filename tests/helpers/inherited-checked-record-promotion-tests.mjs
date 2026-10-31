/**
 * Aggregate inherited checked-record promotion contract.
 *
 * The final Perl archive pin registers every aggregate test as a hard
 * 44-reference promotion gate for the public inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	typeSurfaceCells, validateTypeSurface
} from "../../src/adoption/type-surface.mjs";
import {
	inheritedCheckedRecordPerlEvidenceSha256
} from "./inherited-checked-record-perl-evidence.mjs";
import {
	inheritedCheckedRecordPromotionHistoryPath
	, inheritedCheckedRecordPromotionPredecessor
} from "./inherited-checked-record-promotion-source-history.mjs";
import {
	inheritedCheckedRecordBoundary
	, inheritedCheckedRecordConversion
	, inheritedCheckedRecordLaneReferences
	, inheritedCheckedRecordPromotionLanes
	, inheritedCheckedRecordReferences
	, promoteInheritedCheckedRecords
} from "./inherited-checked-record-promotion.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
} from "./source-history-test-source.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";

const complete = inheritedCheckedRecordPerlEvidenceSha256 !== null;
const inventoryPath = "docs/type-surface.v1.json";
const inventory = () => JSON.parse(execFileSync("git", ["show"
	, `${inheritedCheckedRecordPromotionPredecessor}:${inventoryPath}`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
const expectedProfiles = [
	"browser-javascript", "browser-react", "browser-worker", "c", "cpp"
	, "dotnet", "java", "kotlin", "node-javascript", "node-typescript"
	, "perl", "php-native", "php-wasm", "python", "ruby", "rust", "wit-wasi"
];

test("inherited promotion lanes partition all seventeen profiles", () => {
	assert.equal(inheritedCheckedRecordPromotionLanes.length, 11);
	const actual = inheritedCheckedRecordPromotionLanes.flatMap(lane => lane.profiles);
	assert.equal(new Set(actual).size, actual.length);
	assert.deepEqual(actual.sort(), [...expectedProfiles].sort());
	assert.deepEqual(inheritedCheckedRecordPromotionLanes.map(lane => lane.id), [
		"native", "browser", "jvm", "dotnet", "python", "ruby", "perl"
		, "php", "php-wasm", "rust", "wit"
	]);
});

test("the ten retained archives derive forty exact pre-Perl references", async () => {
	const retained = inheritedCheckedRecordPromotionLanes.filter(lane =>
		lane.id !== "perl");
	const references = [];
	for(const lane of retained)
		references.push(...await inheritedCheckedRecordLaneReferences(lane));
	assert.equal(references.length, 40);
	assert.equal(new Set(references.map(item => item.id)).size, 40);
	for(const lane of retained)
		assert.equal(references.filter(item => item.lane === lane.id).length, 4);
});

test("inherited promotion authenticates exactly four selections per lane", {
	skip: !complete
}, async () => {
	const references = await inheritedCheckedRecordReferences();
	assert.equal(references.length, 44);
	assert.equal(new Set(references.map(item => item.id)).size, 44);
	for(const lane of inheritedCheckedRecordPromotionLanes)
	{
		const selected = references.filter(item => item.lane === lane.id);
		assert.deepEqual(selected.map(item => [item.route, item.mode]), [
			["ordinary", "full"], ["ordinary", "result-only"]
			, ["reviewed", "full"], ["reviewed", "result-only"]
		]);
		for(const reference of selected)
		{
			assert.deepEqual(reference.profiles, lane.profiles);
			assert.deepEqual(reference.positions, reference.mode === "full"
				? ["parameter", "result", "field"] : ["result"]);
			assert.equal(reference.sourcePath, reference.route === "ordinary"
				? "ordinary-source" : "reviewed-ir");
			assert.match(reference.revision, /^[a-f0-9]{40}$/u);
			assert.ok(reference.command.includes(
				`run-inherited-checked-record-${lane.id}-ci.sh`));
			assert.ok(reference.scope.includes(inheritedCheckedRecordBoundary));
			assert.ok(reference.files.some(file => file.path
				=== `${lane.evidence}/index.json`));
			assert.ok(reference.artifacts.length > 0);
			assert.ok(reference.artifacts.every(file => reference.files.some(
				candidate => candidate.path === file.path
					&& candidate.sha256 === file.sha256
			)));
		}
	}
});

test("inherited promotion changes exactly 102 copied checked-record cells", {
	skip: !complete
}, async () => {
	// Hold at most three parsed inventories at once and compare whole
	// documents by canonical digest; key-sorted canonical JSON is equal exactly
	// when the parsed documents are deeply equal.
	const digest = document => sha256(canonicalJson(document));
	const original = inventory(), originalDigest = digest(original);
	const references = await inheritedCheckedRecordReferences();
	let promoted;
	{
		// The unpinned proposal is unreachable once its pinned copy exists.
		const proposal = await promoteInheritedCheckedRecords(original, references);
		assert.deepEqual(proposal.evidence.slice(0, original.evidence.length)
			, original.evidence);
		promoted = withHistoryMilestoneSourcePins(
			inheritedCheckedRecordPromotionHistoryPath, proposal
		);
	}
	const contracts = typeSurfaceContractsAtProducer(
		inheritedCheckedRecordPromotionPredecessor
	);
	validateTypeSurface(promoted, contracts);
	// sourceAtHistoryMilestone authenticates the recorded milestone digest.
	assert.equal(digest(JSON.parse(sourceAtHistoryMilestone(
		inheritedCheckedRecordPromotionHistoryPath, inventoryPath
	))), digest(promoted));
	assert.equal(promoted.evidence.length, original.evidence.length + 44);
	assert.equal(promoted.observations.length, original.observations.length);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(promoted, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "checked-record");
		assert.ok(expectedProfiles.includes(cell.profile));
		assert.ok(["ordinary-source", "reviewed-ir"].includes(cell.path));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(cell.conversionNote.includes(inheritedCheckedRecordConversion));
		assert.ok(cell.limitations.includes(inheritedCheckedRecordBoundary));
		const lane = inheritedCheckedRecordPromotionLanes.find(item =>
			item.profiles.includes(cell.profile));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.lane === lane.id
			&& item.route === route
			&& (cell.position === "result" || item.mode === "full"))
			.map(item => item.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith(`inherited-checked-record-${lane.id}-`)), ids);
		}
		changed.push(cell.id);
	}
	assert.equal(changed.length, 102);
	assert.equal(new Set(changed).size, 102);
	// Promotion must not mutate its authenticated predecessor inventory.
	assert.equal(digest(original), originalDigest);
});

test("inherited promotion refuses missing, reordered, forged and duplicate evidence", {
	skip: !complete
}, async () => {
	const original = inventory();
	const references = await inheritedCheckedRecordReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteInheritedCheckedRecords(original, changed));
	for(const mutate of [
		item => ({ ...item, profiles: item.profiles.slice(0, -1) })
		, item => ({ ...item, positions: item.positions.slice(0, -1) })
		, item => ({ ...item, revision: "0".repeat(40) })
		, item => ({ ...item, files: item.files.slice(0, -1) })
		, item => ({ ...item, artifacts: item.artifacts.slice(0, -1) })
		, item => ({ ...item, scope: "Every inherited record works" })
	]) {
		const changed = [...references];
		changed[0] = mutate(changed[0]);
		await assert.rejects(promoteInheritedCheckedRecords(original, changed));
	}
});
