/**
 * Source-only controls for inherited checked-record C/C++ selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateGmpProjection } from "../../src/backends/c/gmp-projection.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import {
	inheritedCheckedRecordNativeCaller
	, inheritedCheckedRecordNativeConfiguration
	, inheritedCheckedRecordNativeCounts
	, inheritedCheckedRecordNativeModes
	, inheritedCheckedRecordNativeProfiles
	, inheritedCheckedRecordNativeReview
	, inheritedCheckedRecordNativeRoutes
	, inheritedCheckedRecordNativeSelection
	, parseInheritedCheckedRecordNativeResult
} from "./inherited-checked-record-native-fixture.mjs";

test("inherited checked-record native selection is closed and explicit", () => {
	assert.deepEqual(inheritedCheckedRecordNativeSelection({}), {
		enabled: false, profiles: inheritedCheckedRecordNativeProfiles
		, routes: inheritedCheckedRecordNativeRoutes
		, modes: inheritedCheckedRecordNativeModes, maxLoad: 10
	});
	assert.deepEqual(inheritedCheckedRecordNativeSelection({
		LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_TEST: "1"
		, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_ROUTES: "reviewed"
		, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_MODES: "result-only"
		, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_OUTPUT: "build/records"
		, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_MAX_LOAD: "8"
	}), {
		enabled: true, profiles: inheritedCheckedRecordNativeProfiles
		, routes: ["reviewed"], modes: ["result-only"], maxLoad: 8
	});
	for(const environment of [
		{ LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_TEST: "yes" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_TEST: "1"
			, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_ROUTES: "ordinary,ordinary" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_TEST: "1"
			, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_MODES: "unknown" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_TEST: "1"
			, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_PROFILES: "c" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_TEST: "1"
			, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_MAX_LOAD: "14" }
	]) assert.throws(() => inheritedCheckedRecordNativeSelection(environment));
});

test("inherited checked-record native configuration retains both routes and API modes", async () => {
	for(const route of inheritedCheckedRecordNativeRoutes)
		for(const mode of inheritedCheckedRecordNativeModes)
		{
			const configuration = inheritedCheckedRecordNativeConfiguration(route, mode);
			validateExportConfiguration(configuration);
			await assertJsonSchema("lean-export-configuration", configuration);
			assert.deepEqual(Object.keys(configuration.targets).sort(), ["c", "cpp"]);
			assert.equal(Object.hasOwn(configuration, "exports"), route === "ordinary");
			if(route === "ordinary")
			{
				const names = configuration.exports.map(name => name.split(".").at(-1));
				assert.deepEqual(mode === "full" ? names : [...names].sort()
					, mode === "full"
						? ["first", "normalized", "pair", "aliased", "nested", "echo"
							, "produce", "produceStamped"]
						: ["produce", "produceStamped"]);
			}
			const review = inheritedCheckedRecordNativeReview(mode);
			validateBindingIr(review);
			assert.deepEqual(review.declarations.map(item => item.name).sort()
				, mode === "full"
					? ["aliased", "echo", "first", "nested", "normalized", "pair"
						, "produce", "produceStamped"]
					: ["produce", "produceStamped"]);
			assert.deepEqual(review.types.map(type => type.name)
				, mode === "full"
					? ["Span", "Stamped", "Ticket", "TicketAlias"]
					: ["Span", "Stamped", "Ticket"]);
		}
});

test("inherited checked-record native callers fix every route, mode and result total", async () => {
	for(const profile of inheritedCheckedRecordNativeProfiles)
		for(const route of inheritedCheckedRecordNativeRoutes)
			for(const mode of inheritedCheckedRecordNativeModes)
			{
				const source = await inheritedCheckedRecordNativeCaller(
					profile, route, mode
				);
				assert.equal(source.includes("#define INHERITED_CHECKED_RECORD_RESULT_ONLY")
					, mode === "result-only");
				assert.equal(source.includes('#define INHERITED_PARAMETER_PREFIX "value"')
					, route === "reviewed");
				const call = name => profile === "c"
					? `inheritedcheckedrecords_${name}(` : `api::${name}(`;
				for(const name of ["produce", "produce_stamped", "first"
					, "normalized", "pair", "aliased", "nested"])
					assert.ok(source.includes(call(name)), `${profile} ${name}`);
				assert.doesNotMatch(source, /\b(?:Lean|sorry|axiom|unsafeCast)\b/u);
				const expected = inheritedCheckedRecordNativeCounts[profile][mode];
				assert.deepEqual(parseInheritedCheckedRecordNativeResult(
					JSON.stringify(expected), profile, mode
				), expected);
				for(const key of ["checks", "rejections", "rounds"])
				{
					const changed = { ...expected, [key]: expected[key] + 1 };
					assert.throws(() => parseInheritedCheckedRecordNativeResult(
						JSON.stringify(changed), profile, mode
					));
				}
			}
});

test("independent inherited checked-record C and C++ callers compile against both APIs", async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-bridge-inherited-checked-record-native-callers-"));
	t.after(() => rm(root, { recursive: true }));
	for(const mode of inheritedCheckedRecordNativeModes)
		for(const profile of inheritedCheckedRecordNativeProfiles)
		{
			const directory = join(root, `${profile}-${mode}`);
			const review = inheritedCheckedRecordNativeReview(mode);
			const files = {
				...generateCBindingPackage(review)
				, ...profile === "c" ? generateGmpProjection(review).files : {
					...generateCppBindingPackage(review), ...boostSources()
				}
			};
			for(const [path, source] of Object.entries(files))
				await saveLakeFile(directory, path, source);
			const source = await inheritedCheckedRecordNativeCaller(
				profile, "ordinary", mode
			);
			await saveLakeFile(directory, `consumer.${profile}`, source);
			await runCopied(profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++", [
				`-std=${profile === "c" ? "c11" : "c++20"}`
				, "-Wall", "-Wextra", "-Werror", "-Iinclude", "-S"
				, `consumer.${profile}`, "-o", "consumer.s"
			], directory);
		}
});
