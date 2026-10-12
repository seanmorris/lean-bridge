/**
 * Check retained nominal CPAN records against the required selection and actual host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { nominalSubtypePerlSafePath } from "../tests/helpers/nominal-subtype-perl-package-records.mjs";
import { parseNominalSubtypePerlCiArgs, checkNominalSubtypePerlCiRecords } from "../tests/helpers/nominal-subtype-perl-ci-report.mjs";

const selected = parseNominalSubtypePerlCiArgs(process.argv.slice(2));
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8" });
assert.match(version, /^glibc 2\.[0-9]+\n$/u);
const result = await checkNominalSubtypePerlCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, runtime: { platform: process.platform, arch: process.arch, glibc: version.trim().slice(6) }
	, read: path => {
		nominalSubtypePerlSafePath(path);
		return readFile(join(selected.directory, path));
	}
});
process.stdout.write(canonicalJson(result));
