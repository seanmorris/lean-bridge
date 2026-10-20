#!/usr/bin/env node
/**
 * Recheck one retained hosted value-index Ruby route.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "../tests/helpers/copied-fixture-install.mjs";
import {
	checkCheckedRecordValueIndexRubyCiRecords, parseCheckedRecordValueIndexRubyCiArgs
} from "../tests/helpers/checked-record-value-index-ruby-ci-report.mjs";

const selected = parseCheckedRecordValueIndexRubyCiArgs(process.argv.slice(2));
const root = await realpath(selected.directory), tapPath = await realpath(selected.tap);
assert.equal(relative(root, tapPath).startsWith(".."), false, "TAP must remain in retained records");
const glibc = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8", env: copiedCleanEnvironment }).trim();
assert.match(glibc, /^glibc 2\.[0-9]+$/u);
const command = await realpath(selected.ruby), bytes = await readFile(command);
const interpreter = {
	command
	, identity: { bytes: bytes.length, sha256: sha256(bytes) }
	, run: await runCopied(command, [
		"--disable-gems"
		, "-rjson"
		, "-e"
		, "print JSON.generate({engine: RUBY_ENGINE, version: RUBY_VERSION, platform: RUBY_PLATFORM})"
	], process.cwd())
};
const read = async path => {
	assert.match(path, /^(?:[A-Za-z0-9_.+@-]+\/)*[A-Za-z0-9_.+@-]+$/u);
	const destination = resolve(root, path);
	assert.equal(relative(root, destination).startsWith(".."), false, "Record escapes retained output");
	return readFile(destination);
};
const tap = await readFile(tapPath, "utf8");
assert.equal((await read("run.tap")).toString(), tap, "Retained TAP drift");
const options = Object.entries({ ...selected, ruby: command }).flatMap(([key, value]) => [`--${key}`, value]);
const result = await checkCheckedRecordValueIndexRubyCiRecords(options, {
	tap
	, read
	, runtime: { platform: process.platform, arch: process.arch, glibc: glibc.slice(6) }
	, interpreter
});
process.stdout.write(canonicalJson(result));
