#!/usr/bin/env node
/**
 * Check one retained inherited checked-record native CI selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkInheritedCheckedRecordNativeCiRecords, parseInheritedCheckedRecordNativeCiArgs
} from "../tests/helpers/inherited-checked-record-native-ci-report.mjs";

const selected = parseInheritedCheckedRecordNativeCiArgs(process.argv.slice(2));
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"]
	, { encoding: "utf8" });
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const result = await checkInheritedCheckedRecordNativeCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, runtime: {
		platform: process.platform, arch: process.arch, glibc: version.trim().slice(6)
	}
	, read: path => {
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path));
		assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
		return readFile(join(selected.directory, path));
	}
});
process.stdout.write(canonicalJson(result));
