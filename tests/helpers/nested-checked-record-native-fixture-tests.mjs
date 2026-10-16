/**
 * Source-only controls for the nested checked-record C/C++ package selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateGmpProjection } from "../../src/backends/c/gmp-projection.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import {
	nestedCheckedRecordNativeCaller,
	nestedCheckedRecordNativeConfiguration,
	nestedCheckedRecordNativeCounts,
	nestedCheckedRecordNativeReview,
	nestedCheckedRecordNativeSelection,
	parseNestedCheckedRecordNativeResult
} from "./nested-checked-record-native-fixture.mjs";

test("nested checked-record native selection is closed over both public projections", () => {
	assert.deepEqual(nestedCheckedRecordNativeSelection({}), {
		enabled: false, profiles: ["c", "cpp"]
		, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"]
	});
	assert.deepEqual(nestedCheckedRecordNativeSelection({
		LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_TEST: "1"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_ROUTES: "reviewed"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_MODES: "result-only"
	}), {
		enabled: true, profiles: ["c", "cpp"]
		, routes: ["reviewed"], modes: ["result-only"]
	});
	for(const environment of [
		{ LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_TEST: "yes" }
		, { LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_PROFILES: "c" }
		, { LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_TEST: "1"
			, LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_ROUTES: "ordinary,ordinary" }
	]) assert.throws(() => nestedCheckedRecordNativeSelection(environment));
});

test("nested checked-record native configurations retain exact author routes and modes", () => {
	const ordinary = nestedCheckedRecordNativeConfiguration("ordinary", "full");
	assert.deepEqual(Object.keys(ordinary.targets), ["c", "cpp"]);
	assert.equal(ordinary.exports.length, 13);
	assert.equal(Object.keys(ordinary.contracts).length, 13);
	const reviewed = nestedCheckedRecordNativeConfiguration("reviewed", "result-only");
	assert.deepEqual(Object.keys(reviewed.targets), ["c", "cpp"]);
	assert.ok(!Object.hasOwn(reviewed, "exports"));
	assert.equal(nestedCheckedRecordNativeReview("result-only").declarations.length, 2);
});

test("independent nested checked-record C and C++ callers compile against both APIs", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-checked-record-native-callers-"));
	t.after(() => rm(root, { recursive: true }));
	for(const mode of ["full", "result-only"])
		for(const profile of ["c", "cpp"])
		{
			const directory = join(root, `${profile}-${mode}`);
			const review = nestedCheckedRecordNativeReview(mode);
			const files = {
				...generateCBindingPackage(review)
				, ...profile === "c" ? generateGmpProjection(review).files : {
					...generateCppBindingPackage(review), ...boostSources()
				}
			};
			for(const [path, source] of Object.entries(files))
				await saveLakeFile(directory, path, source);
			const source = await nestedCheckedRecordNativeCaller(profile, "ordinary", mode);
			await saveLakeFile(directory, `consumer.${profile}`, source);
			await runCopied(profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++", [
				`-std=${profile === "c" ? "c11" : "c++20"}`
				, "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude"
				, `consumer.${profile}`
			], directory);
		}
});

test("nested checked-record native result receipts reject every changed count", () => {
	for(const profile of ["c", "cpp"])
		for(const mode of ["full", "result-only"])
		{
			const expected = nestedCheckedRecordNativeCounts[profile][mode];
			assert.deepEqual(parseNestedCheckedRecordNativeResult(
				JSON.stringify(expected) + "\n", profile, mode), expected);
			for(const key of Object.keys(expected))
			{
				const changed = { ...expected, [key]: expected[key] + 1 };
				assert.throws(() => parseNestedCheckedRecordNativeResult(
					JSON.stringify(changed), profile, mode), undefined, `${profile}/${mode}/${key}`);
			}
		}
});
