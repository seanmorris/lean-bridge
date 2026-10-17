/**
 * Source-only controls for the hosted recursive checked-record Ruby gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	assertRecursiveCheckedRecordRubyCiTap, parseRecursiveCheckedRecordRubyCiArgs
	, recursiveCheckedRecordRubyCiTestName
} from "./recursive-checked-record-ruby-ci-report.mjs";

const workflowPath = ".github/workflows/recursive-checked-record-ruby.yml";
const scriptPath = "scripts/run-recursive-checked-record-ruby-ci.sh";
const args = {
	route: "ordinary", fixture: "mutual", producer: "a".repeat(40)
	, directory: "build/records", tap: "build/run.tap", glibc: "2.38"
	, ruby: "/usr/bin/ruby"
};
const flags = value => Object.entries(value).flatMap(([key, item]) => [`--${key}`, item]);
const tap = name => `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;

test("recursive checked-record Ruby CI arguments are closed and complete", () => {
	assert.deepEqual(parseRecursiveCheckedRecordRubyCiArgs(flags(args)), args);
	for(const key of Object.keys(args))
	{
		const missing = { ...args }; delete missing[key];
		assert.throws(() => parseRecursiveCheckedRecordRubyCiArgs(flags(missing)));
		assert.throws(() => parseRecursiveCheckedRecordRubyCiArgs([...flags(args), `--${key}`, args[key]]));
	}
	const invalid = [
		["route", "unknown"], ["fixture", "nested"], ["producer", "abc"]
		, ["glibc", "2.37"], ["directory", "--tap"], ["tap", ""]
	];
	for(const [key, value] of invalid)
		assert.throws(() => parseRecursiveCheckedRecordRubyCiArgs(flags({ ...args, [key]: value })));
	assert.throws(() => parseRecursiveCheckedRecordRubyCiArgs([...flags(args), "--mode", "full"]));
});

test("recursive checked-record Ruby CI requires one complete zero-skip selection", () => {
	const name = recursiveCheckedRecordRubyCiTestName("reviewed", "mutual");
	assert.equal(name, "installed recursive checked-record Ruby packages reproduce and relocate reviewed mutual");
	assertRecursiveCheckedRecordRubyCiTap(tap(name), "reviewed", "mutual");
	for(const changed of [
		tap(name).replace("ok 1 -", "not ok 1 -")
		, tap(name).replace("# skipped 0", "# skipped 1")
		, tap(name).replace("# pass 1", "# pass 0")
		, tap(name).replace(`ok 1 - ${name}`, `ok 1 - ${name} # SKIP`)
		, tap(name).replace("1..1", "1..2")
		, tap(recursiveCheckedRecordRubyCiTestName("ordinary", "mutual"))
	]) assert.throws(() => assertRecursiveCheckedRecordRubyCiTap(changed, "reviewed", "mutual"));
	assert.throws(() => recursiveCheckedRecordRubyCiTestName("reviewed", "unknown"));
});

test("recursive checked-record Ruby workflow runs every selection and keeps partial records", async () => {
	const workflow = await readFile(workflowPath, "utf8"), script = await readFile(scriptPath, "utf8");
	assert.match(workflow, /^name: Installed recursive checked records in Ruby$/mu);
	assert.match(workflow, /ruby-version: '3\.3\.12'/u);
	assert.ok(workflow.includes('bash scripts/run-recursive-checked-record-ruby-ci.sh "$ruby_command" "$gem_command"'));
	assert.match(workflow, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.ok(workflow.includes("build/recursive-checked-record-ruby-ci/"));
	assert.match(workflow, /if: always\(\) && steps\.acceptance\.outcome != 'success'\n {8}run: exit 1/u);
	assert.doesNotMatch(workflow, /nested|continue-on-error/iu);
	assert.match(script, /^for fixture in recursive mutual; do\n {2}for route in ordinary reviewed; do$/mu);
	assert.match(script, /^export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.38$/mu);
	assert.match(script, /--glibc 2\.38 --ruby "\$LEAN_BRIDGE_RUBY" \| tee "\$output\/verification\.json"$/mu);
});

test("recursive checked-record Ruby run script refuses local overrides before producing", () => {
	const argv = [resolve(scriptPath), "/bin/ruby", "/bin/gem"];
	const overrides = [
		"LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_RUBY", "LEAN_BRIDGE_GEM"
		, "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_FIXTURES"
		, "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_MAX_LOAD"
	];
	for(const name of overrides)
	{
		const result = spawnSync("/bin/bash", argv, {
			env: { PATH: "/usr/bin:/bin", [name]: "explicit" }
			, encoding: "utf8", cwd: "/"
		});
		assert.equal(result.status, 2, name); assert.match(result.stderr, /glibc 2\.38 floor/u);
	}
	for(const extra of [[], ["ruby", "/bin/gem"], ["/bin/ruby", "/bin/ruby"]])
	{
		const result = spawnSync("/bin/bash", [resolve(scriptPath), ...extra], { encoding: "utf8", cwd: "/" });
		assert.equal(result.status, 2); assert.match(result.stderr, /^Usage: /u);
	}
});
