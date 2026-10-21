/**
 * Verify the evidence-derived Java/Kotlin zero-payload promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import "./helpers/zero-payload-jvm-promotion-source-history-tests.mjs";
import {
	promoteZeroPayloadJvm, zeroPayloadJvmPromotionConversion
	, zeroPayloadJvmPromotionHostTypes, zeroPayloadJvmPromotionLimit
	, zeroPayloadJvmPromotionParent, zeroPayloadJvmPromotionPinPaths
	, zeroPayloadJvmPromotionProfiles, zeroPayloadJvmPromotionReferences
} from "./helpers/zero-payload-checked-record-jvm-promotion.mjs";

const baseline = () => {
	const source = execFileSync("git", ["show"
		, `${zeroPayloadJvmPromotionParent}:docs/type-surface.v1.json`]
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
	return JSON.parse(source);
};
const ids = [
	"zero-payload-jvm-ordinary-source-hosted-installed"
	, "zero-payload-jvm-reviewed-ir-hosted-installed"
	, "zero-payload-jvm-result-only-ordinary-source-hosted-installed"
	, "zero-payload-jvm-result-only-reviewed-ir-hosted-installed"
];

test("hosted JVM zero-payload evidence derives four exact references", {
	timeout: 120_000
}, async () => {
	const references = await zeroPayloadJvmPromotionReferences();
	assert.deepEqual(references.map(item => item.id), ids);
	assert.deepEqual(references.map(item => item.files.length)
		, [1751, 1753, 1743, 1745]);
	assert.deepEqual(references.map(item => item.artifacts.length), [2, 2, 2, 2]);
	assert.deepEqual(references.map(item => item.positions), [
		["parameter", "result"], ["parameter", "result"], ["result"], ["result"]
	]);
});

test("promotion changes only eight Java/Kotlin checked-record cells", {
	timeout: 120_000
}, async () => {
	const current = baseline();
	const promoted = await promoteZeroPayloadJvm(current
		, await zeroPayloadJvmPromotionReferences());
	assert.equal(promoted.evidence.length, current.evidence.length + 4);
	for(const path of zeroPayloadJvmPromotionPinPaths)
	{
		const before = current.evidence.flatMap(item => item.files)
			.filter(item => item.path === path).map(item => item.sha256);
		const after = promoted.evidence.flatMap(item => item.files)
			.filter(item => item.path === path).map(item => item.sha256);
		assert.ok(before.length > 0);
		assert.equal(new Set(after).size, 1);
	}
	for(const profile of zeroPayloadJvmPromotionProfiles)
		for(const path of ["ordinary-source", "reviewed-ir"])
			for(const position of ["parameter", "result"])
			{
				const before = current.observations.find(item =>
					item.profiles.includes(profile) && item.path === path
					&& item.shapes.includes("checked-record")
					&& item.positions.includes(position));
				const after = promoted.observations.find(item => item.id === before.id);
				assert.match(after.scope, /zero-payload Java\/Kotlin acceptance/u);
				assert.ok(after.hostTypes["checked-record"][position]
					.includes(zeroPayloadJvmPromotionHostTypes[profile][position]));
				assert.ok(after.conversionNotes["checked-record"]
					.endsWith(zeroPayloadJvmPromotionConversion));
				assert.ok(after.limitations.includes(zeroPayloadJvmPromotionLimit));
				for(const stage of Object.values(after.stages))
					assert.ok(stage.evidence.some(id => id.startsWith("zero-payload-jvm-")));
			}
	const changed = promoted.observations.filter((item, index) =>
		JSON.stringify(item) !== JSON.stringify(current.observations[index]));
	assert.equal(changed.length, 8);
	assert.ok(changed.every(item => item.profiles.length === 1
		&& zeroPayloadJvmPromotionProfiles.includes(item.profiles[0])
		&& item.shapes.includes("checked-record")
		&& !item.positions.includes("field")
		&& !item.positions.includes("callbackInput")
		&& !item.positions.includes("callbackResult")));
});

test("JVM promotion rejects missing, reordered and forged evidence", {
	timeout: 120_000
}, async () => {
	const current = baseline(), references = await zeroPayloadJvmPromotionReferences();
	await assert.rejects(promoteZeroPayloadJvm(current, references.slice(1)));
	await assert.rejects(promoteZeroPayloadJvm(current, references.toReversed()));
	const forged = structuredClone(references);
	forged[0].artifacts[0].sha256 = "0".repeat(64);
	await assert.rejects(promoteZeroPayloadJvm(current, forged));
});
