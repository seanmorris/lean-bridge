#!/usr/bin/env node
/**
 * Independently check one hosted value-index Rust record set.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	checkedRecordValueIndexRustCiReader, checkCheckedRecordValueIndexRustCiRecords
	, parseCheckedRecordValueIndexRustCiArgs
} from "../tests/helpers/checked-record-value-index-rust-ci-report.mjs";
import { copiedCleanEnvironment, runCopied } from "../tests/helpers/copied-fixture-install.mjs";

const selected = parseCheckedRecordValueIndexRustCiArgs(process.argv.slice(2));
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], {
	encoding: "utf8", env: copiedCleanEnvironment
});
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const toolchain = {};
for(const name of ["rustc", "cargo"])
{
	const command = await realpath(selected[name]), bytes = await readFile(command);
	selected[name] = command;
	toolchain[name] = { command, bytes: bytes.length, sha256: sha256(bytes)
		, run: await runCopied(command, ["--version"], process.cwd()) };
}
const read = await checkedRecordValueIndexRustCiReader(path => {
	assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path));
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
	return readFile(join(selected.directory, path));
});
const result = await checkCheckedRecordValueIndexRustCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8"), read, toolchain
	, runtime: { platform: process.platform, arch: process.arch, glibc: version.trim().slice(6) }
});
process.stdout.write(canonicalJson(result));
