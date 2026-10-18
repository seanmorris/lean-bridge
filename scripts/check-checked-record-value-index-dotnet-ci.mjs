#!/usr/bin/env node
/**
 * Validate complete value-index C# records and replay every negative control.
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
	inspectCheckedRecordValueIndexDotnetCiHandoff
} from "../tests/helpers/checked-record-value-index-dotnet-ci-handoff.mjs";
import {
	assertCheckedRecordValueIndexDotnetCiTap
	, checkCheckedRecordValueIndexDotnetCiRecords
	, parseCheckedRecordValueIndexDotnetCiArgs
} from "../tests/helpers/checked-record-value-index-dotnet-ci-report.mjs";
import {
	measureCheckedRecordValueIndexDotnetCiTools
} from "../tests/helpers/checked-record-value-index-dotnet-ci-tools.mjs";
import {
	checkCheckedRecordValueIndexDotnetControls
} from "../tests/helpers/checked-record-value-index-dotnet-controls.mjs";
import {
	checkedRecordValueIndexDotnetRecords
} from "../tests/helpers/checked-record-value-index-dotnet-report.mjs";
import {
	copiedCleanEnvironment
} from "../tests/helpers/copied-fixture-install.mjs";

const selected = parseCheckedRecordValueIndexDotnetCiArgs(
	process.argv.slice(2)
);
const tap = await readFile(selected.tap, "utf8");
assertCheckedRecordValueIndexDotnetCiTap(tap, selected.route);
const directory = await realpath(selected.directory);
const read = async path => {
	assert.ok(/^[A-Za-z0-9_.+/[\]-]+$/u.test(path)
		&& path.split("/").every(part => part
			&& part !== "." && part !== ".."), path);
	const file = join(directory, path);
	assert.equal(await realpath(file), file, path);
	return readFile(file);
};
await verifyPackageSetReceipt({
	receiptPath: join(directory, "handoff/package-set-receipt.json")
});
const original = await inspectCheckedRecordValueIndexDotnetCiHandoff(read);
const nuget = JSON.parse(await read("nuget.json"));
const context = JSON.parse(await read("installation.json"));
assert.deepEqual(await nativeArtifactPaths(directory)
	, checkedRecordValueIndexDotnetRecords(
		selected.route, nuget, context
	).sort(), "Closed value-index .NET record inventory");
selected.dotnet = await realpath(selected.dotnet);
const measured = await measureCheckedRecordValueIndexDotnetCiTools(
	selected.dotnet, read, original.members
);
const version = execFileSync(
	"/usr/bin/getconf", ["GNU_LIBC_VERSION"], {
		encoding: "utf8", env: copiedCleanEnvironment
	}
);
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const runtime = {
	platform: process.platform, arch: process.arch
	, glibc: version.trim().slice(6)
};
const originalOptions = {
	route: selected.route, producer: selected.producer
	, consumer: selected.consumer, directory, tap: selected.tap
	, glibc: selected.glibc, dotnet: selected.dotnet
};
const accepted = await checkCheckedRecordValueIndexDotnetCiRecords(
	originalOptions, {
		tap, read, ...measured, runtime
		, archiveSha512: original.archiveSha512
	}
);
const controlled = await checkCheckedRecordValueIndexDotnetControls(read, {
	route: selected.route, producerCommit: selected.producer
	, consumerCommit: selected.consumer, runtime, floor: selected.glibc
	, toolchain: measured.toolchain, framework: measured.framework
	, archiveSha512: original.archiveSha512
});
assert.deepEqual(controlled.accepted, accepted
	, "Controls begin and end at the accepted record set");
const controls = Object.fromEntries(Object.entries(controlled)
	.filter(([key]) => key !== "accepted"));
process.stdout.write(canonicalJson({
	...accepted, archiveSha256: original.archiveSha256, controls
}));
