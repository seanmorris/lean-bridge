#!/usr/bin/env node
/**
 * Verify one fresh inherited checked-record Perl producer from original
 * records and independently selected interpreters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	copiedCleanEnvironment, runCopied
} from "../tests/helpers/copied-fixture-install.mjs";
import {
	checkedRecordPerlConfigurations, checkedRecordPerlExecutables
} from "../tests/helpers/checked-record-perl-install.mjs";
import {
	checkInheritedCheckedRecordPerlCiRecords
	, parseInheritedCheckedRecordPerlCiArgs
} from "../tests/helpers/inherited-checked-record-perl-ci-report.mjs";

const selected = parseInheritedCheckedRecordPerlCiArgs(process.argv.slice(2));
const tap = await readFile(selected.tap, "utf8");
const directory = await realpath(selected.directory);
const read = async path => {
	assert.ok(/^(?:[A-Za-z0-9_.:-]+\/)*[A-Za-z0-9_.:-]+$/u.test(path));
	assert.ok(path.split("/").every(part =>
		part && part !== "." && part !== ".."));
	const file = join(directory, path);
	assert.equal(await realpath(file), file);
	return readFile(file);
};
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], {
	encoding: "utf8", env: copiedCleanEnvironment
});
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const executables = checkedRecordPerlExecutables();
const interpreters = [];
for(const configuration of checkedRecordPerlConfigurations)
{
	const command = await realpath(executables[configuration]);
	const bytes = await readFile(command);
	const run = await runCopied(command, [
		"-MConfig", "-MJSON::PP", "-e"
		, "print JSON::PP->new->canonical->encode({map { $_ => $Config{$_} } qw(version archname useithreads usemultiplicity ivsize ptrsize)})"
	], directory);
	assert.equal(run.stderr, "");
	interpreters.push({
		configuration, command
		, executable: { bytes: bytes.length, sha256: sha256(bytes) }
		, identity: JSON.parse(run.stdout)
	});
}
const result = await checkInheritedCheckedRecordPerlCiRecords({
	...selected, tap, read, interpreters
	, paths: await nativeArtifactPaths(directory)
	, runtime: {
		platform: process.platform, arch: process.arch
		, glibc: version.trim().slice(6)
	}
});
process.stdout.write(canonicalJson(result));
