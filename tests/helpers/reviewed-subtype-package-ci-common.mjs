/**
 * Check explicit reviewed package selections, real execution and original record bytes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { reviewedSubtypeInstalledIr, reviewedSubtypeInstalledSource } from "./reviewed-subtype-installed-fixture.mjs";
import { reviewedSubtypePackageTestNames } from "./reviewed-subtype-package-fixture.mjs";
import { nativeSubtypeTargets } from "./native-subtype-install.mjs";

/**
 * Reject missing or extra report fields.
 *
 * @param value - Parsed record.
 * @param names - Exact allowed fields.
 */
export const reviewedPackageKeys = (value, names) => assert.deepEqual(Object.keys(value).sort(), [...names].sort());

/**
 * Require the selected installed test, without skipped or duplicated TAP results.
 *
 * @param lane - Closed C-family or npm selection.
 * @param source - Original combined producer TAP.
 */
export const assertReviewedSubtypePackageTap = (lane, source) => {
	assert.ok(Object.hasOwn(reviewedSubtypePackageTestNames, lane));
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	const name = reviewedSubtypePackageTestNames[lane];
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
	return true;
};

/**
 * Parse closed options before opening any selected record.
 *
 * @param args - CLI arguments after the script name.
 */
export const parseReviewedSubtypePackageArgs = args => {
	const usage = "Usage: check-reviewed-subtype-package-reports.mjs --lane c-cpp|npm --directory <records> --tap <original-tap>";
	assert.ok(Array.isArray(args) && args.length === 6, usage);
	const parsed = {};
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(["--lane", "--directory", "--tap"].includes(flag), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(parsed, key) && typeof value === "string" && value.length > 0 && !value.startsWith("--"), usage);
		parsed[key] = value;
	}
	assert.ok(Object.hasOwn(reviewedSubtypePackageTestNames, parsed.lane), usage);
	return parsed;
};

/**
 * Read canonical original JSON and independently check both retained author inputs.
 *
 * @param lane - Closed C-family or npm selection.
 * @param read - Original relative-record byte reader.
 */
export const reviewedSubtypePackageInputs = async (lane, read) => {
	assert.ok(Object.hasOwn(reviewedSubtypePackageTestNames, lane));
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(Buffer.from(bytes).toString(), canonicalJson(value), `Noncanonical producer record: ${path}`);
		return value;
	};
	const review = reviewedSubtypeInstalledIr();
	const source = await readFile("tests/fixtures/onboarding/native-subtype/Subtypes.lean", "utf8") + reviewedSubtypeInstalledSource;
	const configuration = { schemaVersion: 1, modules: ["Subtypes"]
		, ...lane === "c-cpp" ? { targets: Object.fromEntries([nativeSubtypeTargets.c, nativeSubtypeTargets.cpp]) } : {} };
	for(const index of [0, 1])
	{
		assert.equal(Buffer.from(await read(`build-${index}/Subtypes.lean`)).toString(), source);
		assert.deepEqual(await json(`build-${index}/review.json`), review);
		assert.deepEqual(await json(`build-${index}/lean-bridge.exports.json`), configuration);
	}
	return { json, review, source, configuration };
};
