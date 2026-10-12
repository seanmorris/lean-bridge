/**
 * Compile independent installed-package callers against generated public headers.
 * These checks are syntax evidence, not installed-package execution.
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
import { nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeNativeCaller, nominalSubtypeNativeSelection } from "./nominal-subtype-native-caller.mjs";

test("nominal native gates require an explicit switch and reject malformed selections", () => {
	assert.deepEqual(nominalSubtypeNativeSelection({}), { enabled: false
		, profiles: ["c", "cpp"], routes: ["ordinary", "reviewed"]
		, modes: ["full", "result-only"] });
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_";
	for(const enabled of ["0", "1"])
		assert.equal(nominalSubtypeNativeSelection({ [prefix + "TEST"]: enabled }).enabled, enabled === "1");
	for(const [name, values] of Object.entries({ TEST: ["", "true", "2"]
		, PROFILES: ["", "perl", "c,c", "c,", "C"]
		, ROUTES: ["", "wrong", "ordinary,ordinary", "reviewed,"]
		, MODES: ["", "results", "full,full", "result-only,"] }))
		for(const value of values) assert.throws(() => nominalSubtypeNativeSelection({ [prefix + name]: value }));
	assert.deepEqual(nominalSubtypeNativeSelection({ [prefix + "TEST"]: "1"
		, [prefix + "PROFILES"]: "cpp", [prefix + "ROUTES"]: "reviewed"
		, [prefix + "MODES"]: "result-only" }), { enabled: true
		, profiles: ["cpp"], routes: ["reviewed"], modes: ["result-only"] });
});

test("C and C++ nominal callers compile for both routes and full/result-only packages", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-native-callers-"));
	t.after(() => rm(root, { recursive: true }));
	for(const mode of ["full", "result-only"]) for(const profile of ["c", "cpp"])
	{
		const directory = join(root, mode, profile);
		const review = nominalSubtypeInstalledReview(mode === "result-only");
		const files = { ...generateCBindingPackage(review)
			, ...profile === "c" ? generateGmpProjection(review).files
				: { ...generateCppBindingPackage(review), ...boostSources() } };
		for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
		for(const route of ["ordinary", "reviewed"])
		{
			const source = await nominalSubtypeNativeCaller(profile, route, mode);
			await saveLakeFile(directory, `consumer.${profile}`, source);
			await runCopied(profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++"
				, [`-std=${profile === "c" ? "c11" : "c++20"}`
					, "-Wall", "-Wextra", "-Werror"
					, "-fsyntax-only", "-Iinclude", `consumer.${profile}`], directory);
			t.diagnostic(`${profile} ${route} ${mode}: public-header syntax only`);
		}
	}
});
