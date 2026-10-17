/**
 * Check original inherited checked-record Rust records against the selected API and actual tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "../tests/helpers/copied-fixture-install.mjs";
import { parseInheritedCheckedRecordRustCiArgs, inheritedCheckedRecordRustCiReader, checkInheritedCheckedRecordRustCiRecords } from "../tests/helpers/inherited-checked-record-rust-ci-report.mjs";

const selected = parseInheritedCheckedRecordRustCiArgs(process.argv.slice(2));
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8", env: copiedCleanEnvironment });
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const toolchain = {};
for(const name of ["rustc", "cargo"])
{
	const command = await realpath(selected[name]), bytes = await readFile(command);
	selected[name] = command;
	toolchain[name] = { command, bytes: bytes.length, sha256: sha256(bytes)
		, run: await runCopied(command, ["--version"], process.cwd()) };
}
const read = await inheritedCheckedRecordRustCiReader(path => {
	assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path));
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
	return readFile(join(selected.directory, path));
});
const result = await checkInheritedCheckedRecordRustCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8"), toolchain, read
	, runtime: { platform: process.platform, arch: process.arch, glibc: version.trim().slice(6) }
});
process.stdout.write(canonicalJson(result));
