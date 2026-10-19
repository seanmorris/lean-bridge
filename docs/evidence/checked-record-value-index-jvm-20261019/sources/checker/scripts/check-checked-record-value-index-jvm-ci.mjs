#!/usr/bin/env node
/**
 * Verify one fresh value-index JVM producer from retained original bytes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	verifyPackageSetReceipt
} from "../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment
} from "../tests/helpers/copied-fixture-install.mjs";
import {
	inspectCheckedRecordValueIndexJvmCiHandoff
} from "../tests/helpers/checked-record-value-index-jvm-ci-handoff.mjs";
import {
	assertCheckedRecordValueIndexJvmCiTap
	, checkCheckedRecordValueIndexJvmCiRecords
	, parseCheckedRecordValueIndexJvmCiArgs
} from "../tests/helpers/checked-record-value-index-jvm-ci-report.mjs";
import {
	measureNominalSubtypeJvmCiTools
} from "../tests/helpers/nominal-subtype-jvm-ci-tools.mjs";

const selected = parseCheckedRecordValueIndexJvmCiArgs(
	process.argv.slice(2));
const tap = await readFile(selected.tap, "utf8");
assertCheckedRecordValueIndexJvmCiTap(tap, selected.route);
const directory = await realpath(selected.directory);
const read = async path => {
	assert.ok(/^[A-Za-z0-9_.$/[\]-]+$/u.test(path));
	assert.ok(path.split("/").every(part =>
		part && part !== "." && part !== ".."));
	const file = join(directory, path);
	assert.equal(await realpath(file), file);
	return readFile(file);
};
await verifyPackageSetReceipt({
	receiptPath: join(directory, "handoff/package-set-receipt.json")
});
const original = await inspectCheckedRecordValueIndexJvmCiHandoff(read, {
	floor: selected.glibc, route: selected.route
});
const tools = await measureNominalSubtypeJvmCiTools(selected, directory);
for(const name of ["java", "javac", "kotlinc"])
	selected[name] = tools[name].command;
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], {
	encoding: "utf8", env: copiedCleanEnvironment
});
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const result = await checkCheckedRecordValueIndexJvmCiRecords(selected, {
	tap, read: original.read, tools
	, runtime: {
		platform: process.platform, arch: process.arch
		, glibc: version.trim().slice(6)
	}
	, archiveSha256: original.archiveSha256
});
assert.deepEqual(await nativeArtifactPaths(directory), [
	...result.records.filter(path => !path.startsWith("package/"))
].sort());
process.stdout.write(canonicalJson(result));
