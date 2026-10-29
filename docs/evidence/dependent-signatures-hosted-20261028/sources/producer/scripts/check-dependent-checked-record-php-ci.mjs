#!/usr/bin/env node
/**
 * Recheck one complete hosted dependent checked-record native-PHP route from original
 * retained records, without trusting the producer process's success status.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copiedCleanEnvironment } from "../tests/helpers/copied-fixture-install.mjs";
import {
	checkDependentCheckedRecordPhpCiRecords, parseDependentCheckedRecordPhpCiArgs
} from "../tests/helpers/dependent-checked-record-php-ci-report.mjs";
import { inspectNominalSubtypePhpTools } from "../tests/helpers/nominal-subtype-php-tools.mjs";

const selected = parseDependentCheckedRecordPhpCiArgs(process.argv.slice(2));
const tap = await readFile(selected.tap, "utf8"), directory = await realpath(selected.directory);
const read = async path => {
	assert.ok(/^[A-Za-z0-9_.$/-]+$/u.test(path));
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
	const file = join(directory, path); assert.equal(await realpath(file), file); return readFile(file);
};
await verifyPackageSetReceipt({ receiptPath: join(directory, "handoff/package-set-receipt.json") });
const tools = await inspectNominalSubtypePhpTools({
	php: selected.php
	, composer: selected.composer
	, phpVersion: selected["php-version"]
	, composerVersion: selected["composer-version"]
}, directory);
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], {
	encoding: "utf8", env: copiedCleanEnvironment
});
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const result = await checkDependentCheckedRecordPhpCiRecords(process.argv.slice(2), {
	tap
	, read
	, tools
	, runtime: {
		platform: process.platform, arch: process.arch, glibc: version.trim().slice(6)
	}
});
assert.deepEqual(await nativeArtifactPaths(directory), result.records);
process.stdout.write(canonicalJson(result));
