#!/usr/bin/env node
/**
 * Preserve the independently checked local C/C++/Perl callback Subtype reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	checkCallbackSubtypeNativeReport
	, checkCallbackSubtypePerlReport
} from "../tests/helpers/callback-subtype-native-ci.mjs";

const producerCommit = "a031522d08d2130cb0d54ae33c39d0525bf1ee0c";
const destination = "docs/evidence/callback-subtype-native-20261020";
const reports = Object.freeze({
	native: {
		path: "build/callback-subtypes/native.json"
		, sha256: "31d541c019fd1589c82c2e198144b017b124b4ca9a58c9568fb5500a4921d18f"
	}
	, perl: {
		path: "build/callback-subtypes/perl.json"
		, sha256: "8c41f0f48e36f0293e1e85e40b98d246879c7e02214f1449471d49bb5bd0ed4a"
	}
});

assert.deepEqual(process.argv.slice(2), []);
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
	, producerCommit, "Archive only the implementation revision that produced these reports");

const pending = [], checked = {};
for(const [kind, source] of Object.entries(reports))
{
	const bytes = await readFile(source.path);
	assert.equal(sha256(bytes), source.sha256, source.path);
	const report = JSON.parse(bytes);
	checked[kind] = kind === "native"
		? checkCallbackSubtypeNativeReport(report)
		: checkCallbackSubtypePerlReport(report);
	pending.push({ path: `${destination}/${kind}.json`, bytes });
}

const reportEntries = Object.entries(reports).map(([kind, report]) => [kind, {
	path: `${destination}/${kind}.json`
	, sha256: report.sha256
	, ...checked[kind]
}]);
const receipt = {
	schemaVersion: 1
	, planNodes: [1682]
	, execution: "local"
	, producerCommit
	, commands: {
		native: "LEAN_BRIDGE_CALLBACK_SUBTYPE_NATIVE_PROFILES=c,cpp node --test tests/callback-subtype-native-installed.test.mjs"
		, perl: "LEAN_BRIDGE_CALLBACK_SUBTYPE_PERL_TEST=1 node --test tests/callback-subtype-perl-installed.test.mjs"
	}
	, reports: Object.fromEntries(reportEntries)
	, environment: {
		platform: "linux-x64"
		, glibcFloor: "2.36"
		, perl: ["5.36.3-threaded", "5.36.3-unthreaded"
			, "5.38.2-threaded", "5.38.2-unthreaded"]
	}
	, retention: "The original machine-readable reports are retained. The local terminal TAP and package bytes were not retained. The Perl report retains package archive identities; recurring hosted workflows retain their original TAP and reports."
};
pending.push({ path: `${destination}/receipt.json`
	, bytes: Buffer.from(canonicalJson(receipt)) });

await mkdir(destination, { recursive: true });
for(const item of pending)
{
	try
	{ await writeFile(item.path, item.bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.deepEqual(await readFile(item.path), item.bytes, item.path);
	}
}
process.stdout.write(`Archived ${checked.native.reports} native and ${checked.perl.reports} Perl reports. Receipt SHA-256 ${sha256(pending.at(-1).bytes)}\n`);
