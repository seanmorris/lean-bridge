/**
 * Authenticate the frozen nested checked-record Java/Kotlin launches.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import { assertNestedCheckedRecordJvmCiTap } from "./nested-checked-record-jvm-ci-report.mjs";
import {
	nestedCheckedRecordJvmGenerator
	, nestedCheckedRecordJvmOriginal
} from "./nested-checked-record-jvm-generators.mjs";

export { nestedCheckedRecordJvmOriginal };

export const nestedCheckedRecordJvmProducer = "ef8876ba067e29197b32a21eb708b394f4df3568";
export const nestedCheckedRecordJvmLoadCeiling = 12;
export const nestedCheckedRecordJvmEvidence
	= "docs/evidence/nested-checked-record-jvm-20261016";
export const nestedCheckedRecordJvmSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);
export const nestedCheckedRecordJvmTools = Object.freeze({
	java: "/app/.toolchains/jdk22/bin/java"
	, javac: "/app/.toolchains/jdk22/bin/javac"
	, kotlinc: "/app/.toolchains/kotlin-2.2.0/kotlinc/bin/kotlinc"
	, maven: "/app/.toolchains/apache-maven-3.9.11/bin/mvn"
});
export const nestedCheckedRecordJvmRunnerNames = Object.freeze({
	initial: "run-vo1506-nested-record-jvm-ef8876b-initial.mjs"
	, continuation: "run-vo1506-nested-record-jvm-ef8876b.mjs"
});

const closureEntries = Object.freeze([
	"scripts/check-nested-checked-record-jvm-ci.mjs"
	, "tests/helpers/nested-checked-record-jvm-controls.mjs"
	, "tests/helpers/nested-checked-record-jvm-installed-tests.mjs"
	, "tests/helpers/nested-checked-record-jvm-ci-workflow-tests.mjs"
]);
const extraSources = Object.freeze([
	".github/workflows/nested-checked-record-jvm.yml"
	, "scripts/run-nested-checked-record-jvm-ci.sh"
	, "tests/fixtures/nested-checked-record-consumers/java.java"
	, "tests/fixtures/nested-checked-record-consumers/kotlin.kt"
	, ...["LICENSE", "NestedCheckedRecords.lean", "lakefile.toml"
		, "lean-toolchain", "package.json"]
		.map(path => `tests/fixtures/onboarding/nested-checked-records/${path}`)
]);

const historicalClosure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		if(files.has(path)) return;
		const source = nestedCheckedRecordJvmOriginal(revision, path).toString("utf8");
		files.add(path);
		for(const specifier of moduleSpecifiers(source, path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...files].sort();
};

let selectedSources;

/** Reconstruct every static producer/checker module and dynamic generator input. */
export const nestedCheckedRecordJvmEvidenceSources = async () => selectedSources ??= Object.freeze([
	...new Set([
		...historicalClosure(nestedCheckedRecordJvmProducer, closureEntries)
		, ...(await nestedCheckedRecordJvmGenerator(nestedCheckedRecordJvmProducer)).paths
		, ...extraSources
	])
].sort());

const environmentOf = (route, mode, output) => ({
	CMAKE_BUILD_PARALLEL_LEVEL: "1"
	, LEAN_BRIDGE_JAVA: nestedCheckedRecordJvmTools.java
	, LEAN_BRIDGE_JAVAC: nestedCheckedRecordJvmTools.javac
	, LEAN_BRIDGE_KOTLINC: nestedCheckedRecordJvmTools.kotlinc
	, LEAN_BRIDGE_LEAN_PREFIX: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
	, LEAN_BRIDGE_MAVEN: nestedCheckedRecordJvmTools.maven
	, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
	, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_MAX_LOAD: String(nestedCheckedRecordJvmLoadCeiling)
	, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_MODES: mode
	, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_OUTPUT: output
	, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_ROUTES: route
	, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_TEST: "1"
	, LEAN_NUM_THREADS: "1", MAKEFLAGS: "-j1", NO_COLOR: "1"
	, OMP_NUM_THREADS: "1"
});

/**
 * Require one successful serial local launch and its terminal output.
 *
 * @param options - Frozen launch records and archive label.
 * @param options.start - Canonical launch record.
 * @param options.end - Canonical terminal record.
 * @param options.tap - Complete TAP output.
 * @param options.stderr - Complete standard error output.
 * @param options.route - Ordinary source or reviewed IR.
 * @param options.mode - Full or result-only API.
 * @param options.label - Archive selection label.
 */
export const assertNestedCheckedRecordJvmRun = ({ start, end, tap, stderr
	, route, mode, label }) => {
	assert.ok(nestedCheckedRecordJvmSelections.some(item =>
		item[0] === route && item[1] === mode));
	assert.equal(label, `${route}-${mode}`);
	for(const record of [start, end])
	{
		assert.equal(record.schemaVersion, 1); assert.equal(record.producer, nestedCheckedRecordJvmProducer);
		assert.equal(record.route, route); assert.equal(record.mode, mode);
	}
	assert.deepEqual(start.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
	assert.deepEqual(start.tools, nestedCheckedRecordJvmTools);
	assert.equal(start.command, "/usr/bin/nice");
	const name = `installed nested checked-record JVM packages reproduce and relocate ${route} ${mode}`;
	assert.deepEqual(start.args, ["-n", "19", "/usr/bin/ionice", "-c", "3"
		, "/usr/bin/taskset", "-c", "3", "/usr/bin/node"
		, "--max-old-space-size=3072", "--test", "--test-concurrency=1"
		, "--test-reporter=tap", `--test-name-pattern=^${name}$`
		, "tests/helpers/nested-checked-record-jvm-installed-tests.mjs"]);
	assert.deepEqual(start.environment, environmentOf(route, mode
		, `/app/build/vo1506-nested-record-jvm-ef8876b/${label}/records`));
	assert.deepEqual([end.code, end.signal], [0, null]);
	assert.equal(end.started, start.started); assert.ok(Date.parse(start.started) < Date.parse(end.finished));
	assert.equal(end.tapSha256, sha256(tap)); assert.equal(end.stderrSha256, sha256(stderr));
	assert.equal(stderr.length, 0); assertNestedCheckedRecordJvmCiTap(tap.toString(), route, mode);
	};
