/**
 * Bind NuGet graph admission to fresh installed regressions and exact source edits.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertDotnetFamilyRegressions } from "./dotnet-installed-regressions.mjs";
import { assertDotnetSharedRegressions } from "./dotnet-shared-regressions.mjs";
import { assertSourceRegistrationUpdate } from "./source-registration-history.mjs";
import { beforePhpWasmSharedVerification } from "./php-wasm-shared-regression-receipt.mjs";
import { assertJvmSharedSourceTransition } from "./jvm-shared-regression-receipt.mjs";
import { beforeNativeSharedAdmission } from "./native-shared-admission.mjs";
import { beforeNativeSharedTestUpdates } from "./native-shared-test-updates.mjs";
import { beforeNativeSharedVerification } from "./native-shared-verifier-updates.mjs";

const receiptPath = "docs/evidence/native-shared-regressions-20260924.json";
const shared = ["src/build/native-c-projection.mjs", "src/build/native-graph-projection.mjs", "src/build/native-project.mjs"];
const targetTests = Object.fromEntries(["jvm", "perl", "python", "ruby", "rust"].map(profile => [`tests/${profile}-graph-package.test.mjs`, profile]));
const targetVerifiers = ["tests/helpers/native-python-graph-regression.mjs", "tests/helpers/native-ruby-graph-regression.mjs"];
const predecessorPaths = {
	nuget: "docs/evidence/perl-recursive-regressions-20260923.json"
	, maven: "docs/evidence/dotnet-recursive-packages-20260923.json"
	, "php-native": "docs/evidence/jvm-recursive-packages-20260923.json"
};
const gateNames = {
	c: "prepared recursive C and C++ packages run after removing source, headers and handoff"
	, jvm: "installed Java and Kotlin collections preserve copied values on both source paths"
	, perl: "ordinary and reviewed CPAN graphs install source-free on selected Perl ABIs"
	, python: "prepared recursive Python wheels install offline and execute without the producer"
	, ruby: "prepared recursive Ruby gems install offline and run without the producer"
	, rust: "prepared recursive Cargo crates install offline and run without producer or installed sources"
};
const replacements = {
	"src/build/native-c-projection.mjs": [[
		'["c", "cpp", "cargo", "pypi", "rubygems", "nuget"].includes(target)) });'
		, '["c", "cpp", "cargo", "pypi", "rubygems"].includes(target)) });'
	]]
	, "src/build/native-project.mjs": [[
		', copiedGraphs: targets.every(target => ["c", "cpp", "cargo", "pypi", "rubygems", "cpan", "nuget"].includes(target))'
		, ', copiedGraphs: targets.every(target => ["c", "cpp", "cargo", "pypi", "rubygems", "cpan"].includes(target))'
	]]
	, "src/build/native-graph-projection.mjs": [
		['import { compileCopiedDotnetGraphPackageModel } from "../backends/dotnet/copied-graph-package.mjs";\n', ""]
		, ['["c", "cpp", "cargo", "pypi", "rubygems", "cpan", "nuget"].includes(target)', '["c", "cpp", "cargo", "pypi", "rubygems", "cpan"].includes(target)']
		, ['Native copied graphs currently require C, C++, Cargo, PyPI, RubyGems, CPAN or NuGet target adapters', 'Native copied graphs currently require C, C++, Cargo, PyPI, RubyGems or CPAN target adapters']
		, ['\tconst dotnet = targets.includes("nuget") ? compileCopiedDotnetGraphPackageModel(ir) : null;\n', ""]
		, ['return c ?? rust ?? python ?? ruby ?? perl ?? dotnet;', 'return c ?? rust ?? python ?? ruby ?? perl;']
	]
};
const verifierChanges = {
	"tests/helpers/test-registration-history.mjs": [
		['import { assertDotnetGraphSourceTransition } from "./native-dotnet-graph-regression.mjs";\n', ""]
		, ['\tif(await assertDotnetGraphSourceTransition(path, source, expected)) return;\n', ""]
	]
	, "tests/helpers/native-perl-graph-regression.mjs": [
		['import { assertDotnetGraphSourceTransition } from "./native-dotnet-graph-regression.mjs";\n', ""]
		, ['await assertDotnetGraphSourceTransition(path, source, hash) || await assertSourceRegistrationUpdate(path, source, hash)', 'await assertSourceRegistrationUpdate(path, source, hash)']
		, ['\tif(sha256(source) !== record.sourceHashes[path]) assert.equal(await assertDotnetGraphSourceTransition(path, source, record.sourceHashes[path]), true, path);', '\tassert.equal(sha256(source), record.sourceHashes[path], path);']
	]
	, "tests/source-registration-history.test.mjs": [
		['import { beforeDotnetGraphVerification } from "./helpers/native-dotnet-graph-regression.mjs";\n', ""]
		, ['\tconst path = "tests/helpers/test-registration-history.mjs", current = await readFile(path, "utf8");\n\tconst source = beforeDotnetGraphVerification(path, current);', '\tconst path = "tests/helpers/test-registration-history.mjs", source = await readFile(path, "utf8");']
	]
};

/**
 * Reconstruct the exact preceding verifier, preserving its older source checks.
 *
 * @param path - One of the explicitly integrated verifier files.
 * @param source - Complete current verifier source.
 */
export const beforeDotnetGraphVerification = (path, source) => {
	source = beforePhpWasmSharedVerification(path, source);
	assert.ok(Object.hasOwn(verifierChanges, path), `Not a NuGet verifier edit: ${path}`);
	for(const [current, previous] of verifierChanges[path])
	{
		assert.equal(source.split(current).length, 2, "Exactly one NuGet regression verifier edit");
		source = source.replace(current, previous);
	}
	return source;
};

/**
 * Reverse only the three explicit NuGet admission changes.
 * The caller must compare the result with a pinned predecessor digest.
 *
 * @param path - Shared native-build source path.
 * @param source - Complete current source text.
 */
export const beforeDotnetGraphAdmission = (path, source) => {
	assert.ok(shared.includes(path), `Not a NuGet shared-build edit: ${path}`);
	for(const [current, previous] of replacements[path])
	{
		assert.equal(source.split(current).length, 2, "Exactly one NuGet graph admission edit");
		source = source.replace(current, previous);
	}
	return source;
};

export const nativeSharedVerifierPaths = [
	"tests/helpers/dotnet-shared-regressions.mjs"
	, "tests/helpers/jvm-shared-regression-receipt.mjs"
	, "tests/helpers/jvm-shared-verifier-updates.mjs"
	, "tests/helpers/native-dotnet-graph-regression.mjs"
	, ...targetVerifiers
	, "tests/helpers/native-shared-admission.mjs"
	, "tests/helpers/native-shared-test-updates.mjs"
	, "tests/helpers/native-shared-verifier-updates.mjs"
	, "tests/native-shared-admission.test.mjs"
];

/**
 * Retain the compiler, projection, packager and installed-test dependencies.
 * Registration manifests and historical receipts are checked separately.
 *
 * @param baselines - Authenticated original non-C# package records.
 */
export const nativeSharedSourcePaths = baselines => [...new Set([
	...Object.entries(baselines).filter(([name]) => name !== "dotnet").flatMap(([, baseline]) => Object.keys(baseline.sourceHashes))
		.filter(path => /^(?:src\/(?:analyze|backends|build|release)\/|tests\/)/.test(path)
			&& (!nativeSharedVerifierPaths.includes(path) || targetVerifiers.includes(path)))
	, ...shared
	, "src/backends/c/copied-graph-layout.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/managed/package-audit.mjs"
	, "src/backends/jvm/copied-graph-conversions.mjs"
	, "src/backends/php/copied-graph-conversions.mjs"
	, "tests/jvm-graph-package.test.mjs"
])].sort();

/**
 * Require fresh installed runs and the exact three measured admission stages.
 *
 * @param record - Combined current-source regression evidence.
 */
export const assertNativeSharedRegressionEvidence = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "native-shared-graph-regressions"); assert.equal(record.finalAcceptance, false);
	const baselines = {};
	assert.deepEqual(Object.keys(record.baselines).sort(), ["c", "dotnet", "jvm", "perl", "python", "pythonRegression", "ruby", "rust"]);
	for(const [name, entry] of Object.entries(record.baselines))
	{
		const bytes = await readFile(entry.path); assert.equal(sha256(bytes), entry.sha256);
		baselines[name] = JSON.parse(bytes);
	}
	assert.equal(record.baselines.dotnet.path, "docs/evidence/dotnet-current-family-regressions-20260924.json");
	await assertDotnetFamilyRegressions();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), nativeSharedSourcePaths(baselines));
	for(const [path, expected] of Object.entries(record.sourceHashes))
	{
		const source = await readFile(path, "utf8");
		assert.equal(sha256(targetVerifiers.includes(path) ? beforeNativeSharedVerification(path, source) : source), expected, path);
	}
	assert.deepEqual(Object.keys(record.verifierSources).sort(), nativeSharedVerifierPaths);
	for(const [path, expected] of Object.entries(record.verifierSources)) assert.equal(sha256(await readFile(path)), expected, path);
	assert.equal(record.verifierBaseline.path, "docs/evidence/php-wasm-shared-regressions-20260924.json");
	const verifierBytes = await readFile(record.verifierBaseline.path);
	assert.equal(sha256(verifierBytes), record.verifierBaseline.sha256);
	const verifierBaseline = JSON.parse(verifierBytes);
	assert.deepEqual(Object.keys(record.verifierPredecessors), ["tests/helpers/native-dotnet-graph-regression.mjs"]);
	for(const [path, previous] of Object.entries(record.verifierPredecessors))
	{
		assert.equal(previous.sha256, verifierBaseline.verifierSources[path]);
		assert.equal(sha256(previous.text), previous.sha256);
	}
	assert.deepEqual(Object.keys(record.predecessors).sort(), Object.keys(predecessorPaths).sort());
	for(const [target, previous] of Object.entries(record.predecessors))
	{
		assert.equal(previous.path, predecessorPaths[target]);
		const bytes = await readFile(previous.path); assert.equal(sha256(bytes), previous.sha256);
		const original = JSON.parse(bytes);
		assert.deepEqual(Object.keys(previous.sourceHashes).sort(), shared);
		for(const path of shared)
		{
			assert.equal(previous.sourceHashes[path], original.sourceHashes[path], `${target}: ${path}`);
			assert.equal(sha256(beforeNativeSharedAdmission(path, await readFile(path, "utf8"), target)), previous.sourceHashes[path], path);
		}
	}
	for(const [name, run] of Object.entries(record.runs))
	{
		assert.equal(sha256(canonicalJson(run.executions ?? run.report)), run.observationsSha256);
		assert.equal(sha256(run.log.text), run.log.sha256);
		assert.match(run.log.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0/);
		assert.ok(run.log.text.includes(`ok 1 - ${gateNames[name]}\n`), `${name} compiled gate`);
	}
	assertDotnetSharedRegressions(record.runs, baselines);
	return { record, baselines };
};

/** Require the complete current shared-native regression receipt. */
export const assertDotnetGraphRegressions = async () => assertNativeSharedRegressionEvidence(JSON.parse(await readFile(receiptPath)));

/**
 * Match an exact predecessor only after verifying the fresh installed matrix.
 * Earlier transitions remain the responsibility of their existing verifiers.
 *
 * @param path - Production source path from a historical receipt.
 * @param source - Complete current source text.
 * @param expected - Original recorded source hash, never replaced.
 */
export const assertDotnetGraphSourceTransition = async (path, source, expected) => {
	const { assertPhpWasmSharedSourceTransition } = await import("./php-wasm-shared-regression-receipt.mjs");
	if(await assertPhpWasmSharedSourceTransition(path, source, expected)) return true;
	if(await assertJvmSharedSourceTransition(path, source, expected)) return true;
	if(targetVerifiers.includes(path))
	{
		const { record } = await assertDotnetGraphRegressions();
		assert.equal(sha256(source), record.verifierSources[path], path);
		const previous = beforeNativeSharedVerification(path, source);
		if(sha256(previous) === expected) return true;
		if(path === "tests/helpers/native-ruby-graph-regression.mjs")
		{
			const { assertPerlGraphSourceTransition } = await import("./native-perl-graph-regression.mjs");
			return assertPerlGraphSourceTransition(path, previous, expected);
		}
		return false;
	}
	if(!shared.includes(path) && !Object.hasOwn(verifierChanges, path) && !Object.hasOwn(targetTests, path)) return false;
	const { record, baselines } = await assertDotnetGraphRegressions();
	assert.equal(sha256(source), record.sourceHashes[path], path);
	if(Object.hasOwn(targetTests, path))
	{
		const preceding = JSON.parse(await readFile(record.predecessors[targetTests[path] === "jvm" ? "php-native" : "nuget"].path));
		if((preceding.sourceHashes[path] ?? baselines[targetTests[path]].sourceHashes[path]) !== expected) return false;
		assert.equal(sha256(beforeNativeSharedTestUpdates(path, source)), expected, path);
		return true;
	}
	if(Object.hasOwn(verifierChanges, path))
	{
		const previous = beforeDotnetGraphVerification(path, source);
		if(sha256(previous) === expected) return true;
		return assertSourceRegistrationUpdate(path, previous, expected);
	}
	const target = Object.keys(record.predecessors).find(target => record.predecessors[target].sourceHashes[path] === expected);
	if(!target) return false;
	assert.equal(sha256(beforeNativeSharedAdmission(path, source, target)), expected, path);
	return true;
};
