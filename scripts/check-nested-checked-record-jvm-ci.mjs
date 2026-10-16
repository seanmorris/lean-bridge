/**
 * Verify one fresh nested checked-record JVM CI producer from its complete original JAR and records.
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
import { assertNestedCheckedRecordJvmCiTap, checkNestedCheckedRecordJvmCiRecords, parseNestedCheckedRecordJvmCiArgs } from "../tests/helpers/nested-checked-record-jvm-ci-report.mjs";
import { inspectNestedCheckedRecordJvmCiHandoff } from "../tests/helpers/nested-checked-record-jvm-ci-handoff.mjs";
import { measureNominalSubtypeJvmCiTools } from "../tests/helpers/nominal-subtype-jvm-ci-tools.mjs";

const selected = parseNestedCheckedRecordJvmCiArgs(process.argv.slice(2));
const tap = await readFile(selected.tap, "utf8");
assertNestedCheckedRecordJvmCiTap(tap, selected.route, selected.mode);
const directory = await realpath(selected.directory);
const read = async path => {
	assert.ok(/^[A-Za-z0-9_.$/[\]-]+$/u.test(path));
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
	const file = join(directory, path); assert.equal(await realpath(file), file);
	return readFile(file);
};
await verifyPackageSetReceipt({ receiptPath: join(directory, "handoff/package-set-receipt.json") });
const original = await inspectNestedCheckedRecordJvmCiHandoff(read, { floor: selected.glibc, mode: selected.mode });
const tools = await measureNominalSubtypeJvmCiTools(selected, directory);
for(const name of ["java", "javac", "kotlinc"]) selected[name] = tools[name].command;
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8", env: copiedCleanEnvironment });
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const result = await checkNestedCheckedRecordJvmCiRecords(selected, {
	tap, read: original.read, tools
	, runtime: { platform: process.platform, arch: process.arch, glibc: version.trim().slice(6) }
	, archiveSha256: original.archiveSha256 });
assert.deepEqual(await nativeArtifactPaths(directory), [...result.records.filter(path => !path.startsWith("package/")), original.archivePath].sort());
process.stdout.write(canonicalJson(result));
