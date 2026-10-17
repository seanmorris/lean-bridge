/**
 * Refuse unpinned JVM tools, skipped matrices, and narrowed failure evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertInheritedCheckedRecordJvmCiTap
	, inheritedCheckedRecordJvmCiTestName
	, parseInheritedCheckedRecordJvmCiArgs
} from "./inherited-checked-record-jvm-ci-report.mjs";
import {
	assertInheritedCheckedRecordJvmWorkflow
	, inheritedCheckedRecordJvmKotlinZipSha256
} from "./inherited-checked-record-jvm-ci-workflow.mjs";

test("inherited JVM workflow requires four selections and pinned tools"
	, async () => {
		const source = await readFile(
			".github/workflows/inherited-checked-record-jvm.yml", "utf8"
		);
		assertInheritedCheckedRecordJvmWorkflow(source);
		const shell = await readFile(
			"scripts/run-inherited-checked-record-jvm-ci.sh", "utf8"
		);
		for(const command of [
			"for route in ordinary reviewed; do"
			, "for mode in full result-only; do"
			, "export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_TEST=1"
			, "export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"
			, "node scripts/check-inherited-checked-record-jvm-ci.mjs"
			, "export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1"
			, "tests/helpers/inherited-checked-record-jvm-installed-tests.mjs"
			, "unset CLASSPATH JAVA_TOOL_OPTIONS JDK_JAVA_OPTIONS JDK_JAVAC_OPTIONS"
		]) assert.ok(shell.includes(command), command);
		assert.ok(shell.indexOf('mkdir "$output_root"') < shell.indexOf(
			"export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_TEST=1"
		));
		const consumer = await readFile(
			".github/workflows/consumer-matrix.yml", "utf8"
		);
		assert.ok(consumer.includes(
			`          echo '${inheritedCheckedRecordJvmKotlinZipSha256}  build/kotlin-compiler.zip' | sha256sum --check\n`
		));
		assert.ok(consumer.includes("          java-version: '22.0.2'\n"));
	}
);

test("inherited JVM workflow rejects tool and acceptance bypasses", async t => {
	const source = await readFile(
		".github/workflows/inherited-checked-record-jvm.yml", "utf8"
	);
	const replacements = [
		["  push:\n", ""], ["  pull_request:\n", ""]
		, ["contents: read", "contents: write"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ['node-version: "22"', 'node-version: "latest"']
		, ["npm ci --ignore-scripts", "npm install"]
		, ["bash scripts/bootstrap-toolchains.sh --lean-only", "true missing-lean"]
		, ["java-version: '22.0.2'", "java-version: '22'"]
		, ["distribution: temurin", "distribution: zulu"]
		, [inheritedCheckedRecordJvmKotlinZipSha256, "0".repeat(64)]
		, ["kotlin-compiler-2.2.0.zip", "kotlin-compiler-2.3.0.zip"]
		, ["| sha256sum --check\n", "\n"]
		, ["        id: acceptance\n"
			, "        id: acceptance\n        if: false\n"]
		, ["        id: acceptance\n"
			, "        id: acceptance\n        continue-on-error: true\n"]
		, ["run-inherited-checked-record-jvm-ci.sh", "missing-matrix.sh"]
		, ["bin/kotlinc\"\n", "bin/kotlinc\" || true\n"]
		, ["source scripts/env.sh", "set +e"]
		, ["if: always()\n", "if: success()\n"]
		, ["build/inherited-checked-record-jvm-ci/\n"
			, "build/inherited-checked-record-jvm-ci/ordinary-full/records/report.json\n"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome", "steps.unmeasured.outcome"]
		, ["run: exit 1", "run: exit 0"]
		, ["timeout-minutes: 180", "timeout-minutes: 360"]
		, ["        id: acceptance\n        timeout-minutes: 120"
			, "        id: acceptance\n        timeout-minutes: 1"]
		, ["      LEAN_NUM_THREADS:"
			, "      LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: 2.36\n      LEAN_NUM_THREADS:"]
		, ["      LEAN_NUM_THREADS:"
			, "      LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_MODES: full\n      LEAN_NUM_THREADS:"]
		, ["      LEAN_NUM_THREADS:"
			, "      LEAN_BRIDGE_KOTLINC: /usr/bin/kotlinc\n      LEAN_NUM_THREADS:"]
	];
	for(const [before, after] of replacements)
	{
		const changed = source.replace(before, () => after);
		assert.notEqual(changed, source);
		assert.throws(() => assertInheritedCheckedRecordJvmWorkflow(changed)
			, before);
	}
	assert.equal(replacements.length, 28);
	t.diagnostic("Twenty-eight workflow bypasses refused");
});

test("inherited JVM checker refuses incomplete arguments and partial TAP", () => {
	const valid = [
		"--route", "ordinary", "--mode", "full", "--producer"
		, "a".repeat(40), "--directory", "records", "--tap", "run.tap"
		, "--glibc", "2.38", "--java", "/j/java", "--javac", "/j/javac"
		, "--kotlinc", "/k/kotlinc"
	];
	assert.equal(parseInheritedCheckedRecordJvmCiArgs(valid).route, "ordinary");
	for(const broken of [
		valid.slice(2), [...valid, "--route", "reviewed"]
		, valid.map(value => value === "2.38" ? "2.40" : value)
		, valid.map(value => value === "/k/kotlinc" ? "kotlinc" : value)
		, valid.map(value => value === "full" ? "all" : value)
	]) assert.throws(() => parseInheritedCheckedRecordJvmCiArgs(broken));
	const name = inheritedCheckedRecordJvmCiTestName("reviewed", "result-only");
	const tap = `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1.5\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;
	assertInheritedCheckedRecordJvmCiTap(tap, "reviewed", "result-only");
	assert.throws(() => assertInheritedCheckedRecordJvmCiTap(
		tap, "ordinary", "result-only"
	));
	assert.throws(() => assertInheritedCheckedRecordJvmCiTap(
		tap.replace("ok 1", "not ok 1"), "reviewed", "result-only"
	));
	assert.throws(() => assertInheritedCheckedRecordJvmCiTap(
		tap.replace("# skipped 0", "# skipped 1")
		, "reviewed", "result-only"
	));
	assert.throws(() => assertInheritedCheckedRecordJvmCiTap(
		tap.replace(`ok 1 - ${name}`, `ok 1 - ${name} # SKIP`)
		, "reviewed", "result-only"
	));
});
