/**
 * Check retained nominal npm records against the selected API and actual Node host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { parseNominalPrimitiveSubtypeNpmCiArgs, checkNominalPrimitiveSubtypeNpmCiRecords } from "../tests/helpers/nominal-primitive-subtype-npm-ci-report.mjs";

const selected = parseNominalPrimitiveSubtypeNpmCiArgs(process.argv.slice(2));
const result = await checkNominalPrimitiveSubtypeNpmCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, runtime: { platform: process.platform, arch: process.arch, node: process.version }
	, read: path => {
		assert.ok(/^[A-Za-z0-9_.+/@-]+$/u.test(path));
		assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
		return readFile(join(selected.directory, path));
	}
});
process.stdout.write(canonicalJson(result));
