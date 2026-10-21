/**
 * Verify the evidence-derived Rust zero-payload promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import "./helpers/zero-payload-rust-promotion-source-history-tests.mjs";
import {
	promoteZeroPayloadRust, zeroPayloadRustPromotionConversion
	, zeroPayloadRustPromotionHostTypes, zeroPayloadRustPromotionLimit
	, zeroPayloadRustPromotionParent, zeroPayloadRustPromotionPinPaths
	, zeroPayloadRustPromotionProfiles, zeroPayloadRustPromotionReferences
} from "./helpers/zero-payload-checked-record-rust-promotion.mjs";

const baseline = () => {
	const source = execFileSync("git", ["show"
		, `${zeroPayloadRustPromotionParent}:docs/type-surface.v1.json`]
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
	return JSON.parse(source);
};
const ids = [
	"zero-payload-rust-ordinary-source-hosted-installed"
	, "zero-payload-rust-reviewed-ir-hosted-installed"
	, "zero-payload-rust-result-only-ordinary-source-hosted-installed"
	, "zero-payload-rust-result-only-reviewed-ir-hosted-installed"
];

test("hosted Rust zero-payload evidence derives four exact references", {
	timeout: 120_000
}, async () => {
	const references = await zeroPayloadRustPromotionReferences();
	assert.deepEqual(references.map(item => item.id), ids);
	assert.deepEqual(references.map(item => item.files.length)
		, [1775, 1777, 1775, 1777]);
	assert.deepEqual(references.map(item => item.artifacts.length), [1, 1, 1, 1]);
	assert.deepEqual(references.map(item => item.positions), [
		["parameter", "result"], ["parameter", "result"], ["result"], ["result"]
	]);
});

test("promotion changes only four Rust checked-record cells", {
	timeout: 120_000
}, async () => {
	const current = baseline();
	const promoted = await promoteZeroPayloadRust(current
		, await zeroPayloadRustPromotionReferences());
	assert.equal(promoted.evidence.length, current.evidence.length + 4);
	for(const path of zeroPayloadRustPromotionPinPaths)
	{
		const before = current.evidence.flatMap(item => item.files)
			.filter(item => item.path === path).map(item => item.sha256);
		const after = promoted.evidence.flatMap(item => item.files)
			.filter(item => item.path === path).map(item => item.sha256);
		assert.ok(before.length > 0);
		assert.equal(new Set(after).size, 1);
	}
	for(const profile of zeroPayloadRustPromotionProfiles)
		for(const path of ["ordinary-source", "reviewed-ir"])
			for(const position of ["parameter", "result"])
			{
				const before = current.observations.find(item =>
					item.profiles.includes(profile) && item.path === path
					&& item.shapes.includes("checked-record")
					&& item.positions.includes(position));
				const after = promoted.observations.find(item => item.id === before.id);
				assert.match(after.scope, /zero-payload Rust acceptance/u);
				assert.ok(after.hostTypes["checked-record"][position]
					.includes(zeroPayloadRustPromotionHostTypes[profile][position]));
				assert.ok(after.conversionNotes["checked-record"]
					.endsWith(zeroPayloadRustPromotionConversion));
				assert.ok(after.limitations.includes(zeroPayloadRustPromotionLimit));
				for(const stage of Object.values(after.stages))
					assert.ok(stage.evidence.some(id =>
						id.startsWith("zero-payload-rust-")));
			}
	const changed = promoted.observations.filter((item, index) =>
		JSON.stringify(item) !== JSON.stringify(current.observations[index]));
	assert.equal(changed.length, 4);
	assert.ok(changed.every(item => item.profiles.length === 1
		&& zeroPayloadRustPromotionProfiles.includes(item.profiles[0])
		&& item.shapes.includes("checked-record")
		&& !item.positions.includes("field")
		&& !item.positions.includes("callbackInput")
		&& !item.positions.includes("callbackResult")));
});

test("Rust promotion rejects missing, reordered and forged evidence", {
	timeout: 120_000
}, async () => {
	const current = baseline()
		, references = await zeroPayloadRustPromotionReferences();
	await assert.rejects(promoteZeroPayloadRust(current, references.slice(1)));
	await assert.rejects(promoteZeroPayloadRust(current
		, references.toReversed()));
	const forged = structuredClone(references);
	forged[0].artifacts[0].sha256 = "0".repeat(64);
	await assert.rejects(promoteZeroPayloadRust(current, forged));
});
