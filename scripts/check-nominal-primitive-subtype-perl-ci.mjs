/**
 * Check retained primitive-base nominal Perl records against the selected API and actual host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { parseNominalPrimitiveSubtypePerlCiArgs, checkNominalPrimitiveSubtypePerlCiRecords } from "../tests/helpers/nominal-primitive-subtype-perl-ci-report.mjs";

const selected = parseNominalPrimitiveSubtypePerlCiArgs(process.argv.slice(2));
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8" });
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const result = await checkNominalPrimitiveSubtypePerlCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, runtime: { platform: process.platform, arch: process.arch, glibc: version.trim().slice(6) }
	, read: path => {
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path));
		assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
		return readFile(join(selected.directory, path));
	}
});
process.stdout.write(canonicalJson(result));
