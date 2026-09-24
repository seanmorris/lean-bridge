/**
 * Validate the complete current target set and preserve every preceding stage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { compileCopiedPerlGraphPackageModel } from "../src/backends/perl/copied-graph-package.mjs";
import { beforeNativeSharedAdmission } from "./helpers/native-shared-admission.mjs";
import { beforeNativeSharedTestUpdates, beforeDotnetGraphTargetTests } from "./helpers/native-shared-test-updates.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { assertNativeSharedRegressionEvidence, assertDotnetGraphSourceTransition } from "./helpers/native-dotnet-graph-regression.mjs";
import { beforeNativeSharedVerification } from "./helpers/native-shared-verifier-updates.mjs";

test("target test updates preserve exact immediate predecessors and reject unrelated edits", async () => {
	const perl = JSON.parse(await readFile("docs/evidence/perl-recursive-packages-20260923.json"));
	for(const [target, expected] of [
		["perl", perl.sourceHashes["tests/perl-graph-package.test.mjs"]]
		// The immediate NuGet predecessor already admits Maven and Composer.
		// The separate original-receipt check below reverses that expansion.
		, ["dotnet", "9ae3f4212c3990c1fbd9e0f4fdc254de4a8a5d7dca8655db6208e8cdbb021474"]
	]) {
		const path = `tests/${target}-graph-package.test.mjs`, source = await readFile(path, "utf8");
		assert.match(expected, /^[a-f0-9]{64}$/);
		assert.equal(sha256(beforeNativeSharedTestUpdates(path, source)), expected, path);
		assert.notEqual(sha256(beforeNativeSharedTestUpdates(path, source + "\n// unrelated edit\n")), expected);
		assert.throws(() => beforeNativeSharedTestUpdates(path, source + source));
		assert.throws(() => beforeNativeSharedTestUpdates(path, ""));
	}
	assert.throws(() => beforeNativeSharedTestUpdates("src/build/native-project.mjs", ""));
});

test("NuGet target expansion reconstructs the original package and family test hashes", async () => {
	const path = "tests/dotnet-graph-package.test.mjs", source = await readFile(path, "utf8");
	for(const name of ["packages", "family-regressions"])
	{
		const record = JSON.parse(await readFile(`docs/evidence/dotnet-recursive-${name}-20260923.json`));
		const expected = record.sourceHashes[path];
		assert.equal(sha256(beforeDotnetGraphTargetTests(source)), expected);
		assert.notEqual(sha256(beforeDotnetGraphTargetTests(source + "\n// unrelated edit\n")), expected);
	}
	assert.throws(() => beforeDotnetGraphTargetTests(source + source));
	assert.throws(() => beforeDotnetGraphTargetTests(source.replace('targets).prefix, "recursive"', 'targets).prefix, "changed"')));
});

test("Python, Ruby, Cargo and JVM target tests preserve their original complete modules", async () => {
	for(const profile of ["python", "ruby", "rust", "jvm"])
	{
		const path = `tests/${profile}-graph-package.test.mjs`, source = await readFile(path, "utf8");
		const previous = JSON.parse(await readFile(`docs/evidence/${profile === "jvm" ? "jvm-recursive-packages" : "perl-recursive-regressions"}-20260923.json`));
		assert.equal(sha256(beforeNativeSharedTestUpdates(path, source)), previous.sourceHashes[path], path);
		assert.notEqual(sha256(beforeNativeSharedTestUpdates(path, source + "\n// unrelated edit\n")), previous.sourceHashes[path]);
		assert.throws(() => beforeNativeSharedTestUpdates(path, source + source));
		assert.throws(() => beforeNativeSharedTestUpdates(path, ""));
	}
});

test("shared graph admission reconstructs the exact pre-NuGet, pre-Maven and pre-Composer sources", async () => {
	for(const [target, receipt] of [
		["nuget", "perl-recursive-regressions"]
		, ["maven", "dotnet-recursive-packages"]
		, ["php-native", "jvm-recursive-packages"]
	]) {
		const original = JSON.parse(await readFile(`docs/evidence/${receipt}-20260923.json`));
		for(const path of ["src/build/native-c-projection.mjs", "src/build/native-graph-projection.mjs", "src/build/native-project.mjs"])
		{
			const source = await readFile(path, "utf8"), expected = original.sourceHashes[path];
			assert.match(expected, /^[a-f0-9]{64}$/);
			assert.equal(sha256(beforeNativeSharedAdmission(path, source, target)), expected, `${target}: ${path}`);
			assert.notEqual(sha256(beforeNativeSharedAdmission(path, source + "\n// unrelated edit\n", target)), expected);
			assert.throws(() => beforeNativeSharedAdmission(path, source + source, target));
		}
	}
	assert.throws(() => beforeNativeSharedAdmission("src/build/native-component.mjs", "", "nuget"));
	assert.throws(() => beforeNativeSharedAdmission("src/build/native-project.mjs", "", "unknown"));
});

test("all implemented native graph targets validate alone and with CPAN without adding public C", () => {
	const ir = nativeRecursiveReviewedIr(), before = canonicalJson(ir);
	const moduleName = "LeanBridge::Recursive";
	const perl = compileCopiedPerlGraphPackageModel(ir, moduleName);
	const targets = ["c", "cpp", "cargo", "pypi", "rubygems", "cpan", "nuget", "maven", "php-native"];
	for(const target of targets) assert.ok(compileNativeGraphProjection(ir, [target], moduleName));
	for(const target of ["nuget", "maven", "php-native"])
	{
		assert.deepEqual(compileNativeGraphProjection(ir, ["cpan", target], moduleName), perl);
		assert.deepEqual(compileNativeGraphProjection(ir, [target, "cpan"], moduleName), perl);
		assert.throws(() => compileNativeGraphProjection(ir, ["cpan", target], "LeanBridge::Runtime"), /module/);
	}
	assert.ok(compileNativeGraphProjection(ir, targets, moduleName));
	for(const invalid of [undefined, {}, [], ["c", "c"], ["cpan", "unknown"], ["nuget", "wit-wasi"]])
		assert.throws(() => compileNativeGraphProjection(ir, invalid, moduleName), { code: "native-graph-projection-unavailable" });
	assert.throws(() => compileNativeGraphProjection(ir, ["cpan", "maven"]), { code: "native-graph-projection-unavailable" });
	assert.equal(canonicalJson(ir), before);
});

test("current shared-native evidence retains six complete gates and rejects weakened receipts", async () => {
	const record = JSON.parse(await readFile("docs/evidence/native-shared-regressions-20260924.json"));
	await assertNativeSharedRegressionEvidence(record);
	for(const change of [
		run => { delete run.runs.perl; }
		, run => { run.runs.c.executions.pop(); }
		, run => { run.runs.c.executions[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
		, run => { run.runs.jvm.executions[0].jvm.compilerFreeExecution = false; }
		, run => { run.runs.perl.report.observations[0].installs.pop(); }
		, run => { run.runs.ruby.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.36"; }
		, run => { run.runs.python.log.text = run.runs.python.log.text.replace("# skipped 0", "# skipped 1"); }
		, run => { run.runs.rust.log.text = run.runs.rust.log.text.replaceAll("prepared recursive Cargo crates", "different test"); }
		, run => { delete run.sourceHashes["src/build/native-c-projection.mjs"]; }
		, run => { run.sourceHashes["src/build/native-c-projection.mjs"] = "0".repeat(64); }
		, run => { run.verifierSources["tests/helpers/dotnet-shared-regressions.mjs"] = "0".repeat(64); }
		, run => { run.verifierBaseline.sha256 = "0".repeat(64); }
		, run => { run.verifierPredecessors["tests/helpers/native-dotnet-graph-regression.mjs"].text += "\n"; }
		, run => { delete run.predecessors.maven; }
		, run => { run.predecessors.nuget.sourceHashes["src/build/native-project.mjs"] = "0".repeat(64); }
		, run => { run.baselines.dotnet.sha256 = "0".repeat(64); }
		, run => { run.finalAcceptance = true; }
	]) {
		const changed = structuredClone(record); change(changed);
		for(const run of Object.values(changed.runs))
		{
			run.observationsSha256 = sha256(canonicalJson(run.executions ?? run.report));
			run.log.sha256 = sha256(run.log.text);
		}
		await assert.rejects(() => assertNativeSharedRegressionEvidence(changed));
	}
	for(const previous of Object.values(record.predecessors))
		for(const [path, expected] of Object.entries(previous.sourceHashes))
			assert.equal(await assertDotnetGraphSourceTransition(path, await readFile(path, "utf8"), expected), true);
	const path = "src/build/native-project.mjs", source = await readFile(path, "utf8");
	await assert.rejects(() => assertDotnetGraphSourceTransition(path, source + "\n// unrelated edit\n", record.predecessors.nuget.sourceHashes[path]));
	for(const profile of ["perl", "python", "ruby", "rust", "jvm"])
	{
		const previous = JSON.parse(await readFile(profile === "perl" ? record.baselines.perl.path : record.predecessors[profile === "jvm" ? "php-native" : "nuget"].path));
		const path = `tests/${profile}-graph-package.test.mjs`;
		assert.equal(await assertDotnetGraphSourceTransition(path, await readFile(path, "utf8"), previous.sourceHashes[path]), true);
	}
});

test("native regression verifier updates retain complete historical checker sources", async () => {
	const record = JSON.parse(await readFile("docs/evidence/native-shared-regressions-20260924.json"));
	const jvm = JSON.parse(await readFile("docs/evidence/jvm-shared-regressions-20260924.json"));
	const expected = {
		"tests/helpers/native-dotnet-graph-regression.mjs": record.verifierPredecessors["tests/helpers/native-dotnet-graph-regression.mjs"].sha256
		, "tests/helpers/jvm-shared-regression-receipt.mjs": jvm.verifierSources["tests/helpers/jvm-shared-regression-receipt.mjs"]
		, "tests/helpers/jvm-shared-verifier-updates.mjs": jvm.verifierSources["tests/helpers/jvm-shared-verifier-updates.mjs"]
		, "tests/helpers/native-python-graph-regression.mjs": record.sourceHashes["tests/helpers/native-python-graph-regression.mjs"]
		, "tests/helpers/native-ruby-graph-regression.mjs": record.sourceHashes["tests/helpers/native-ruby-graph-regression.mjs"]
	};
	for(const [path, hash] of Object.entries(expected))
	{
		const source = await readFile(path, "utf8"), previous = beforeNativeSharedVerification(path, source);
		assert.equal(sha256(previous), hash, path);
		assert.equal(beforeNativeSharedVerification(path, previous), previous);
		assert.notEqual(sha256(beforeNativeSharedVerification(path, source + "\n// unrelated edit\n")), hash);
	}
	assert.equal(beforeNativeSharedVerification("src/build/native-project.mjs", "unrelated"), "unrelated");
});
