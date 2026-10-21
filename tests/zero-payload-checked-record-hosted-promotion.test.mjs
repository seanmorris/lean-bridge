/**
 * Verify the evidence-derived six-lane zero-payload promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import "./helpers/zero-payload-php-wasm-promotion-source-history-tests.mjs";
import "./helpers/zero-payload-hosted-promotion-source-history-tests.mjs";
import {
	promoteZeroPayloadHosted, zeroPayloadHostedPromotionIds
	, zeroPayloadHostedPromotionLanes, zeroPayloadHostedPromotionPinPaths
	, zeroPayloadHostedPromotionProfiles, zeroPayloadHostedPromotionReferences
} from "./helpers/zero-payload-checked-record-hosted-promotion.mjs";

const baseline = () => {
	const source = execFileSync("git", ["show"
		, "e434aaffaeda338c7abbb13c439466a4f7fb4a17:docs/type-surface.v1.json"]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	return JSON.parse(source);
};

test("seven hosted zero-payload archives derive 28 exact references", async () => {
	const references = await zeroPayloadHostedPromotionReferences();
	assert.deepEqual(references.map(item => item.id), zeroPayloadHostedPromotionIds);
	assert.equal(references.length, 28);
	const positions = [];
	for(let index = 0; index < zeroPayloadHostedPromotionLanes.length; index += 1)
		positions.push(["parameter", "result"], ["parameter", "result"]
			, ["result"], ["result"]);
	assert.deepEqual(references.map(item => item.positions), positions);
	assert.deepEqual(references.map(item => item.artifacts.length)
		, [2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1
			, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1
			, 3, 3, 3, 3]);
});

test("promotion changes exactly 44 copied checked-record cells", async () => {
	const current = baseline();
	const promoted = await promoteZeroPayloadHosted(current
		, await zeroPayloadHostedPromotionReferences());
	assert.equal(promoted.evidence.length, current.evidence.length + 28);
	const changedIds = new Set();
	for(const path of zeroPayloadHostedPromotionPinPaths)
	{
		const before = current.evidence.flatMap(item => item.files)
			.filter(item => item.path === path).map(item => item.sha256);
		const after = promoted.evidence.flatMap(item => item.files)
			.filter(item => item.path === path).map(item => item.sha256);
		assert.ok(before.length > 0, path);
		assert.equal(new Set(after).size, 1, path);
	}
	for(const lane of zeroPayloadHostedPromotionLanes)
		for(const profile of lane.profiles)
			for(const path of ["ordinary-source", "reviewed-ir"])
				for(const position of ["parameter", "result"])
				{
					const before = current.observations.find(item =>
						item.profiles.includes(profile) && item.path === path
						&& item.shapes.includes("checked-record")
						&& item.positions.includes(position));
					const after = promoted.observations.find(item => item.id === before.id);
					changedIds.add(after.id);
					assert.ok(after.scope.includes(
						`hosted zero-payload ${lane.label} acceptance`));
					assert.ok(after.hostTypes["checked-record"][position]
						.includes(lane.hostTypes[profile][position]));
					assert.ok(after.conversionNotes["checked-record"]
						.endsWith(lane.conversion));
					assert.ok(after.limitations.includes(lane.limitation));
					for(const stage of Object.values(after.stages))
						assert.ok(stage.evidence.some(id =>
							id.startsWith(`zero-payload-${lane.key}-`)));
				}
	assert.equal(changedIds.size, 44);
	const changed = promoted.observations.filter(item => changedIds.has(item.id));
	assert.ok(changed.every(item => item.profiles.length === 1
		&& zeroPayloadHostedPromotionProfiles.includes(item.profiles[0])
		&& item.shapes.includes("checked-record")
		&& !item.positions.includes("field")
		&& !item.positions.includes("callbackInput")
		&& !item.positions.includes("callbackResult")));
	for(let index = 0; index < current.observations.length; index += 1)
		if(!changedIds.has(current.observations[index].id))
			assert.strictEqual(promoted.observations[index], current.observations[index]);
});

test("promotion rejects missing, reordered and forged references", async () => {
	const current = baseline(), references = await zeroPayloadHostedPromotionReferences();
	await assert.rejects(promoteZeroPayloadHosted(current, references.slice(1)));
	await assert.rejects(promoteZeroPayloadHosted(current, references.toReversed()));
	const forged = structuredClone(references);
	forged[0].artifacts[0].sha256 = "0".repeat(64);
	await assert.rejects(promoteZeroPayloadHosted(current, forged));
});
