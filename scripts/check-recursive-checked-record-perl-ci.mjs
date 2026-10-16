#!/usr/bin/env node
/**
 * Verify one fresh recursive checked-record Perl CI producer from original records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { copiedCleanEnvironment } from "../tests/helpers/copied-fixture-install.mjs";
import {
	checkRecursiveCheckedRecordPerlCiRecords
	, parseRecursiveCheckedRecordPerlCiArgs
} from "../tests/helpers/recursive-checked-record-perl-ci-report.mjs";

const selected = parseRecursiveCheckedRecordPerlCiArgs(process.argv.slice(2));
const tap = await readFile(selected.tap, "utf8"), directory = await realpath(selected.directory);
const read = async path => {
	assert.ok(/^(?:[A-Za-z0-9_.:-]+\/)*[A-Za-z0-9_.:-]+$/u.test(path));
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
	const file = join(directory, path); assert.equal(await realpath(file), file);
	return readFile(file);
};
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], {
	encoding: "utf8", env: copiedCleanEnvironment
});
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const result = await checkRecursiveCheckedRecordPerlCiRecords({
	...selected, tap, read, paths: await nativeArtifactPaths(directory)
	, runtime: { platform: process.platform, arch: process.arch, glibc: version.trim().slice(6) }
});
process.stdout.write(canonicalJson(result));
