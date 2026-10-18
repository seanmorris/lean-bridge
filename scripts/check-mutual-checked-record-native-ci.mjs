#!/usr/bin/env node
/**
 * Validate one hosted recursive checked-record C/C++ route.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkMutualCheckedRecordNativeCiRecords
	, parseMutualCheckedRecordNativeCiArgs
} from "../tests/helpers/mutual-checked-record-native-ci-report.mjs";
import {
	assertMutualCheckedRecordNativeRecordPaths
} from "../tests/helpers/mutual-checked-record-native-report.mjs";

const selected = parseMutualCheckedRecordNativeCiArgs(process.argv.slice(2));
assert.equal(process.platform, "linux");
assert.equal(process.arch, "x64");
const observed = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"]
	, { encoding: "utf8" });
assert.match(observed, /^glibc 2\.[0-9]+\n$/u);
const runtime = {
	platform: process.platform, arch: process.arch
	, glibc: observed.trim().split(" ")[1]
};
const paths = async (root, prefix = "") => {
	const result = [];
	for(const entry of await readdir(root, { withFileTypes: true }))
	{
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isDirectory()) result.push(...await paths(join(root, entry.name), relative));
		else if(entry.isFile()) result.push(relative);
		else assert.fail(`Unexpected native record entry: ${relative}`);
	}
	return result.sort();
};
const checked = await checkMutualCheckedRecordNativeCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, read: path => readFile(join(selected.directory, path))
	, runtime
});
assertMutualCheckedRecordNativeRecordPaths(
	await paths(selected.directory), checked.route
	, JSON.parse(await readFile(join(selected.directory
		, "build-0/package-set-receipt.json"))));
assert.equal((await readFile(join(selected.directory, "controls.json"))).toString()
	, canonicalJson(checked));
process.stdout.write(canonicalJson(checked));
