/**
 * Verify the evidence-derived C/C++ zero-payload promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	promoteZeroPayloadNative, zeroPayloadNativePromotionConversion
	, zeroPayloadNativePromotionHostTypes, zeroPayloadNativePromotionLimit
	, zeroPayloadNativePromotionPinPaths, zeroPayloadNativePromotionProfiles
	, zeroPayloadNativePromotionReferences
} from "./helpers/zero-payload-checked-record-native-promotion.mjs";

const baseline = () => {
	const source = execFileSync("git", ["show"
		, "54e040d40391ddb8e23b9764c1a75765abb0f458:docs/type-surface.v1.json"]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	return JSON.parse(source);
};
const ids = [
	"zero-payload-native-ordinary-source-hosted-installed"
	, "zero-payload-native-reviewed-ir-hosted-installed"
	, "zero-payload-native-result-only-ordinary-source-hosted-installed"
	, "zero-payload-native-result-only-reviewed-ir-hosted-installed"
];

test("hosted native zero-payload evidence derives four exact references", async () => {
	const references = await zeroPayloadNativePromotionReferences();
	assert.deepEqual(references.map(item => item.id), ids);
	assert.deepEqual(references.map(item => item.files.length), [1734, 1736, 1734, 1736]);
	assert.deepEqual(references.map(item => item.artifacts.length), [2, 2, 2, 2]);
	assert.deepEqual(references.map(item => item.positions), [
		["parameter", "result"], ["parameter", "result"], ["result"], ["result"]
	]);
});

test("promotion changes only eight C/C++ checked-record cells", async () => {
	const current = baseline();
	const promoted = await promoteZeroPayloadNative(current
		, await zeroPayloadNativePromotionReferences());
	assert.equal(promoted.evidence.length, current.evidence.length + 4);
	for(const path of zeroPayloadNativePromotionPinPaths)
	{
		const before = current.evidence.flatMap(item => item.files)
			.filter(item => item.path === path).map(item => item.sha256);
		const after = promoted.evidence.flatMap(item => item.files)
			.filter(item => item.path === path).map(item => item.sha256);
		assert.ok(before.length > 0);
		assert.equal(new Set(after).size, 1);
	}
	for(const profile of zeroPayloadNativePromotionProfiles)
		for(const path of ["ordinary-source", "reviewed-ir"])
			for(const position of ["parameter", "result"])
			{
				const before = current.observations.find(item => item.profiles.includes(profile)
					&& item.path === path && item.shapes.includes("checked-record")
					&& item.positions.includes(position));
				const after = promoted.observations.find(item => item.id === before.id);
				assert.match(after.scope, /hosted zero-payload C\/C\+\+ acceptance/u);
				assert.ok(after.hostTypes["checked-record"][position]
					.includes(zeroPayloadNativePromotionHostTypes[profile][position]));
				assert.ok(after.conversionNotes["checked-record"]
					.endsWith(zeroPayloadNativePromotionConversion));
				assert.ok(after.limitations.includes(zeroPayloadNativePromotionLimit));
				for(const stage of Object.values(after.stages))
					assert.ok(stage.evidence.some(id => id.startsWith("zero-payload-native-")));
			}
	const changed = promoted.observations.filter((item, index) =>
		JSON.stringify(item) !== JSON.stringify(current.observations[index]));
	assert.equal(changed.length, 8);
	assert.ok(changed.every(item => item.profiles.length === 1
		&& zeroPayloadNativePromotionProfiles.includes(item.profiles[0])
		&& item.shapes.includes("checked-record")
		&& !item.positions.includes("field") && !item.positions.includes("callbackInput")
		&& !item.positions.includes("callbackResult")));
});

test("promotion rejects missing, reordered and forged evidence", async () => {
	const current = baseline(), references = await zeroPayloadNativePromotionReferences();
	await assert.rejects(promoteZeroPayloadNative(current, references.slice(1)));
	await assert.rejects(promoteZeroPayloadNative(current, references.toReversed()));
	const forged = structuredClone(references);
	forged[0].artifacts[0].sha256 = "0".repeat(64);
	await assert.rejects(promoteZeroPayloadNative(current, forged));
});
