#!/usr/bin/env node
/**
 * Recheck one retained hosted dependent checked-record Python route from original records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
import {
	checkDependentCheckedRecordPythonCiRecords
	, parseDependentCheckedRecordPythonCiArgs
	, renderDependentCheckedRecordPythonCiVerification
} from "../tests/helpers/dependent-checked-record-python-ci-report.mjs";

const options = parseDependentCheckedRecordPythonCiArgs(process.argv.slice(2));
const root = resolve(options.directory), tapPath = resolve(options.tap);
assert.equal(relative(root, tapPath).startsWith(".."), false, "TAP must remain within retained output");
const glibc = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8" }).trim();
assert.match(glibc, /^glibc 2\.[0-9]+$/u);
const runtime = { platform: process.platform, arch: process.arch, glibc: glibc.slice(6) };
const tap = await readFile(tapPath, "utf8");
const read = async path => {
	assert.equal(typeof path, "string");
	const destination = resolve(root, path);
	assert.equal(relative(root, destination).startsWith(".."), false, "Record escapes retained output");
	return readFile(destination);
};
assert.equal((await read("run.tap")).toString(), tap, "Retained TAP drift");
const result = await checkDependentCheckedRecordPythonCiRecords(process.argv.slice(2), {
	tap, read, runtime
});
process.stdout.write(renderDependentCheckedRecordPythonCiVerification(result));
