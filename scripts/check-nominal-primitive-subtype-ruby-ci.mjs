/**
 * Check original nominal Ruby records against the selected API and actual toolchain.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "../tests/helpers/copied-fixture-install.mjs";
import { parseNominalPrimitiveSubtypeRubyCiArgs, checkNominalPrimitiveSubtypeRubyCiRecords } from "../tests/helpers/nominal-primitive-subtype-ruby-ci-report.mjs";

const selected = parseNominalPrimitiveSubtypeRubyCiArgs(process.argv.slice(2));
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8", env: copiedCleanEnvironment });
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const command = await realpath(selected.ruby), bytes = await readFile(command);
const interpreter = { command
	, identity: { bytes: bytes.length, sha256: sha256(bytes) }
	, run: await runCopied(command, ["--disable-gems", "-rjson", "-e", "print JSON.generate({engine: RUBY_ENGINE, version: RUBY_VERSION, platform: RUBY_PLATFORM})"], process.cwd()) };
const result = await checkNominalPrimitiveSubtypeRubyCiRecords({ ...selected, ruby: command }, {
	tap: await readFile(selected.tap, "utf8"), interpreter
	, runtime: { platform: process.platform, arch: process.arch, glibc: version.trim().slice(6) }
	, read: path => {
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path));
		assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
		return readFile(join(selected.directory, path));
	}
});
process.stdout.write(canonicalJson(result));
