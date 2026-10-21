/**
 * Verify the evidence-derived .NET zero-payload promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import "./helpers/zero-payload-dotnet-promotion-source-history-tests.mjs";
import {
	promoteZeroPayloadDotnet, zeroPayloadDotnetPromotionConversion
	, zeroPayloadDotnetPromotionHostTypes, zeroPayloadDotnetPromotionLimit
	, zeroPayloadDotnetPromotionParent, zeroPayloadDotnetPromotionPinPaths
	, zeroPayloadDotnetPromotionProfiles, zeroPayloadDotnetPromotionReferences
} from "./helpers/zero-payload-checked-record-dotnet-promotion.mjs";

const baseline = () => {
	const source = execFileSync("git", ["show"
		, `${zeroPayloadDotnetPromotionParent}:docs/type-surface.v1.json`]
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
	return JSON.parse(source);
};
const ids = [
	"zero-payload-dotnet-ordinary-source-hosted-installed"
	, "zero-payload-dotnet-reviewed-ir-hosted-installed"
	, "zero-payload-dotnet-result-only-ordinary-source-hosted-installed"
	, "zero-payload-dotnet-result-only-reviewed-ir-hosted-installed"
];

test("hosted .NET zero-payload evidence derives four exact references", {
	timeout: 120_000
}, async () => {
	const references = await zeroPayloadDotnetPromotionReferences();
	assert.deepEqual(references.map(item => item.id), ids);
	assert.deepEqual(references.map(item => item.files.length)
		, [1691, 1693, 1691, 1693]);
	assert.deepEqual(references.map(item => item.artifacts.length), [1, 1, 1, 1]);
	assert.deepEqual(references.map(item => item.positions), [
		["parameter", "result"], ["parameter", "result"], ["result"], ["result"]
	]);
});

test("promotion changes only four .NET checked-record cells", {
	timeout: 120_000
}, async () => {
	const current = baseline();
	const promoted = await promoteZeroPayloadDotnet(current
		, await zeroPayloadDotnetPromotionReferences());
	assert.equal(promoted.evidence.length, current.evidence.length + 4);
	for(const path of zeroPayloadDotnetPromotionPinPaths)
	{
		const before = current.evidence.flatMap(item => item.files)
			.filter(item => item.path === path).map(item => item.sha256);
		const after = promoted.evidence.flatMap(item => item.files)
			.filter(item => item.path === path).map(item => item.sha256);
		assert.ok(before.length > 0);
		assert.equal(new Set(after).size, 1);
	}
	for(const profile of zeroPayloadDotnetPromotionProfiles)
		for(const path of ["ordinary-source", "reviewed-ir"])
			for(const position of ["parameter", "result"])
			{
				const before = current.observations.find(item =>
					item.profiles.includes(profile) && item.path === path
					&& item.shapes.includes("checked-record")
					&& item.positions.includes(position));
				const after = promoted.observations.find(item => item.id === before.id);
				assert.match(after.scope, /zero-payload \.NET acceptance/u);
				assert.ok(after.hostTypes["checked-record"][position]
					.includes(zeroPayloadDotnetPromotionHostTypes[profile][position]));
				assert.ok(after.conversionNotes["checked-record"]
					.endsWith(zeroPayloadDotnetPromotionConversion));
				assert.ok(after.limitations.includes(zeroPayloadDotnetPromotionLimit));
				for(const stage of Object.values(after.stages))
					assert.ok(stage.evidence.some(id =>
						id.startsWith("zero-payload-dotnet-")));
			}
	const changed = promoted.observations.filter((item, index) =>
		JSON.stringify(item) !== JSON.stringify(current.observations[index]));
	assert.equal(changed.length, 4);
	assert.ok(changed.every(item => item.profiles.length === 1
		&& zeroPayloadDotnetPromotionProfiles.includes(item.profiles[0])
		&& item.shapes.includes("checked-record")
		&& !item.positions.includes("field")
		&& !item.positions.includes("callbackInput")
		&& !item.positions.includes("callbackResult")));
});

test(".NET promotion rejects missing, reordered and forged evidence", {
	timeout: 120_000
}, async () => {
	const current = baseline()
		, references = await zeroPayloadDotnetPromotionReferences();
	await assert.rejects(promoteZeroPayloadDotnet(current, references.slice(1)));
	await assert.rejects(promoteZeroPayloadDotnet(current
		, references.toReversed()));
	const forged = structuredClone(references);
	forged[0].artifacts[0].sha256 = "0".repeat(64);
	await assert.rejects(promoteZeroPayloadDotnet(current, forged));
});
