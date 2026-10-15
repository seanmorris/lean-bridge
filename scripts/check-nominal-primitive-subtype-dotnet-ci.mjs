/**
 * Validate complete original C# CI output and independently observed host inputs.
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
import { parseNominalPrimitiveSubtypeDotnetCiArgs, assertNominalPrimitiveSubtypeDotnetCiTap, checkNominalPrimitiveSubtypeDotnetCiRecords } from "../tests/helpers/nominal-primitive-subtype-dotnet-ci-report.mjs";
import { inspectNominalPrimitiveSubtypeDotnetCiHandoff } from "../tests/helpers/nominal-primitive-subtype-dotnet-ci-handoff.mjs";
import { measureNominalPrimitiveSubtypeDotnetCiTools } from "../tests/helpers/nominal-primitive-subtype-dotnet-ci-tools.mjs";
import { nominalPrimitiveSubtypeDotnetRecords } from "../tests/helpers/nominal-primitive-subtype-dotnet-report.mjs";

const selected = parseNominalPrimitiveSubtypeDotnetCiArgs(process.argv.slice(2));
const tap = await readFile(selected.tap, "utf8");
assertNominalPrimitiveSubtypeDotnetCiTap(tap, selected.route, selected.mode);
const directory = await realpath(selected.directory);
const read = async path => {
	assert.ok(/^[A-Za-z0-9_.+/[\]-]+$/u.test(path));
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
	const file = join(directory, path); assert.equal(await realpath(file), file);
	return readFile(file);
};
await verifyPackageSetReceipt({ receiptPath: join(directory, "handoff/package-set-receipt.json") });
const original = await inspectNominalPrimitiveSubtypeDotnetCiHandoff(read);
const nuget = JSON.parse(await read("nuget.json")), context = JSON.parse(await read("installation.json"));
assert.deepEqual(await nativeArtifactPaths(directory), [...nominalPrimitiveSubtypeDotnetRecords(selected.route, selected.mode, nuget, context)
	, "handoff/package-set-receipt.json", "handoff/package-set-receipt.json.sha256"
	, "handoff/archives/Nominalprimitivesubtypes.Api.1.0.0.nupkg"].sort());
selected.dotnet = await realpath(selected.dotnet);
const measured = await measureNominalPrimitiveSubtypeDotnetCiTools(selected.dotnet, read, original.members);
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8", env: copiedCleanEnvironment });
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const result = await checkNominalPrimitiveSubtypeDotnetCiRecords(selected, {
	tap, read
	, ...measured
	, runtime: { platform: process.platform, arch: process.arch, glibc: version.trim().slice(6) }
	, archiveSha512: original.archiveSha512 });
process.stdout.write(canonicalJson({ ...result, archiveSha256: original.archiveSha256 }));
