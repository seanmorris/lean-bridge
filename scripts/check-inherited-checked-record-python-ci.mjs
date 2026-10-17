/**
 * Check retained inherited checked-record Python records against the selected API and actual host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { parseInheritedCheckedRecordPythonCiArgs, checkInheritedCheckedRecordPythonCiRecords } from "../tests/helpers/inherited-checked-record-python-ci-report.mjs";
import {
	inheritedCheckedRecordPythonMinors
} from "../tests/helpers/inherited-checked-record-python-fixture.mjs";
import {
	probeInheritedCheckedRecordPython
} from "../tests/helpers/inherited-checked-record-python-install.mjs";

const selected = parseInheritedCheckedRecordPythonCiArgs(process.argv.slice(2));
selected.python311 = await realpath(selected.python311);
selected.python312 = await realpath(selected.python312);
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8" });
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const interpreters = await Promise.all(
	inheritedCheckedRecordPythonMinors.map(minor =>
		probeInheritedCheckedRecordPython(
			minor, selected[`python${minor.replace(".", "")}`]
			, selected.directory
		)
	)
);
const result = await checkInheritedCheckedRecordPythonCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, runtime: { platform: process.platform, arch: process.arch, glibc: version.trim().slice(6) }
	, interpreters
	, read: path => {
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path));
		assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
		return readFile(join(selected.directory, path));
	}
});
process.stdout.write(canonicalJson(result));
