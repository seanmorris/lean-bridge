/**
 * Verify fresh recursive checked-record WIT acceptance using the original complete archive and current host tools.
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
import { inspectNominalSubtypeWitTools } from "../tests/helpers/nominal-subtype-wit-tools.mjs";
import { inspectRecursiveCheckedRecordWitHandoff } from "../tests/helpers/recursive-checked-record-wit-handoff.mjs";
import { assertRecursiveCheckedRecordWitCiTap, checkRecursiveCheckedRecordWitCiRecords, parseRecursiveCheckedRecordWitCiArgs } from "../tests/helpers/recursive-checked-record-wit-ci-report.mjs";

const selected = parseRecursiveCheckedRecordWitCiArgs(process.argv.slice(2)), tap = await readFile(selected.tap, "utf8");
assertRecursiveCheckedRecordWitCiTap(tap, selected.route, selected.fixture);
const directory = await realpath(selected.directory);
const read = async path => {
	assert.ok(/^[A-Za-z0-9_.$/-]+$/u.test(path));
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
	const file = join(directory, path); assert.equal(await realpath(file), file);
	return readFile(file);
};
await verifyPackageSetReceipt({ receiptPath: join(directory, "handoff/package-set-receipt.json") });
const original = await inspectRecursiveCheckedRecordWitHandoff(read, selected.fixture);
const tools = await inspectNominalSubtypeWitTools({ cc: selected.cc
	, wasmTools: selected["wasm-tools"]
	, wasmtimeCapi: selected["wasmtime-capi"] }, directory);
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8", env: copiedCleanEnvironment });
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const result = await checkRecursiveCheckedRecordWitCiRecords(selected, { tap
	, read: async path => original.supplements.get(path) ?? read(path)
	, runtime: { platform: process.platform, arch: process.arch, glibc: version.trim().slice(6) }
	, tools, archiveSha256: original.archiveSha256 });
assert.deepEqual(await nativeArtifactPaths(directory), [...result.records.filter(path => !original.supplements.has(path)), original.archivePath].sort());
process.stdout.write(canonicalJson(result));
