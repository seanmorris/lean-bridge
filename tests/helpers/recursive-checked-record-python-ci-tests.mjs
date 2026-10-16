/**
 * Source-only controls for the hosted recursive checked-record Python gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	assertRecursiveCheckedRecordPythonCiTap, parseRecursiveCheckedRecordPythonCiArgs
	, recursiveCheckedRecordPythonCiTestName
} from "./recursive-checked-record-python-ci-report.mjs";

const workflowPath = ".github/workflows/recursive-checked-record-python.yml";
const scriptPath = "scripts/run-recursive-checked-record-python-ci.sh";
const args = {
	route: "ordinary", fixture: "mutual", producer: "a".repeat(40)
	, directory: "build/records", tap: "build/run.tap", glibc: "2.38"
};
const flags = value => Object.entries(value).flatMap(([key, item]) => [`--${key}`, item]);
const tap = name => `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;

test("recursive checked-record Python CI arguments are closed and complete", () => {
	assert.deepEqual(parseRecursiveCheckedRecordPythonCiArgs(flags(args)), args);
	for(const key of Object.keys(args))
	{
		const missing = { ...args }; delete missing[key];
		assert.throws(() => parseRecursiveCheckedRecordPythonCiArgs(flags(missing)));
		assert.throws(() => parseRecursiveCheckedRecordPythonCiArgs([...flags(args), `--${key}`, args[key]]));
	}
	const invalid = [
		["route", "unknown"], ["fixture", "nested"], ["producer", "abc"]
		, ["glibc", "2.37"], ["directory", "--tap"], ["tap", ""]
	];
	for(const [key, value] of invalid)
		assert.throws(() => parseRecursiveCheckedRecordPythonCiArgs(flags({ ...args, [key]: value })));
	assert.throws(() => parseRecursiveCheckedRecordPythonCiArgs([...flags(args), "--mode", "full"]));
	assert.throws(() => parseRecursiveCheckedRecordPythonCiArgs([...flags(args), "--route"]));
});

test("recursive checked-record Python CI requires one complete zero-skip selection", () => {
	const name = recursiveCheckedRecordPythonCiTestName("reviewed", "recursive");
	assert.equal(name, "installed recursive checked-record Python packages reproduce and relocate reviewed recursive");
	assertRecursiveCheckedRecordPythonCiTap(tap(name), "reviewed", "recursive");
	for(const changed of [
		tap(name).replace("ok 1 -", "not ok 1 -")
		, tap(name).replace("# skipped 0", "# skipped 1")
		, tap(name).replace("# pass 1", "# pass 0")
		, tap(name).replace(`ok 1 - ${name}`, `ok 1 - ${name} # SKIP`)
		, tap(name).replace("1..1", "1..2")
		, tap(name).replace("TAP version 13\n", "")
		, tap(recursiveCheckedRecordPythonCiTestName("ordinary", "recursive"))
	]) assert.throws(() => assertRecursiveCheckedRecordPythonCiTap(changed, "reviewed", "recursive"));
	assert.throws(() => recursiveCheckedRecordPythonCiTestName("reviewed", "unknown"));
});

test("recursive checked-record Python workflow runs every selection and keeps partial records", async () => {
	const workflow = await readFile(workflowPath, "utf8"), script = await readFile(scriptPath, "utf8");
	assert.match(workflow, /^name: Installed recursive checked records in Python$/mu);
	assert.match(workflow, /^ {4}runs-on: ubuntu-24\.04$/mu);
	for(const minor of ["3.11", "3.12"]) assert.match(workflow, new RegExp(`python-version: "${minor.replace(".", "\\.")}"`, "u"));
	for(const version of ["4.6.0", "4.16.0"])
		assert.ok(workflow.includes(`--dest build/python-typing-wheels/${version} typing_extensions==${version}`), version);
	assert.ok(workflow.includes('bash scripts/run-recursive-checked-record-python-ci.sh "$RECURSIVE_PYTHON_311" "$RECURSIVE_PYTHON_312"'));
	assert.match(workflow, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.ok(workflow.includes("build/recursive-checked-record-python-ci/"));
	assert.match(workflow, /if: always\(\) && steps\.acceptance\.outcome != 'success'\n {8}run: exit 1/u);
	assert.doesNotMatch(workflow, /nested|continue-on-error/iu);
	assert.match(script, /^for fixture in recursive mutual; do\n {2}for route in ordinary reviewed; do$/mu);
	assert.match(script, /^export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.38$/mu);
	assert.match(script, /--glibc 2\.38 \| tee "\$output\/verification\.json"$/mu);
	assert.match(script, /^mkdir "\$output_root"$/mu);
});

test("recursive checked-record Python run script refuses local overrides before producing", () => {
	const pythons = [resolve(scriptPath), "/bin/python3.11", "/bin/python3.12"];
	const run = environment => spawnSync("/bin/bash", pythons, {
		env: { PATH: "/usr/bin:/bin", ...environment }, encoding: "utf8", cwd: "/"
	});
	const overrides = [
		"LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR"
		, "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHONS"
		, "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHON_MAX_LOAD"
	];
	for(const name of overrides)
	{
		const result = run({ [name]: "2.36" });
		assert.equal(result.status, 2, name); assert.match(result.stderr, /requires the glibc 2\.38 floor/u);
	}
	for(const argv of [[], ["python3.11", "/bin/python3.12"], ["/bin/python", "/bin/python"]])
	{
		const result = spawnSync("/bin/bash", [resolve(scriptPath), ...argv], { encoding: "utf8", cwd: "/" });
		assert.equal(result.status, 2); assert.match(result.stderr, /^Usage: /u);
	}
});
