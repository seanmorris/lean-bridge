/**
 * Verify one original structural Subtype installed CI run and its complete retained records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { parseStructuralSubtypeCiArgs, checkStructuralSubtypeCiRecords } from "../tests/helpers/structural-subtype-ci-report.mjs";

const selected = parseStructuralSubtypeCiArgs(process.argv.slice(2));
const result = await checkStructuralSubtypeCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, read: path => {
		assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
		assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
		return readFile(join(selected.directory, path));
	}
});
process.stdout.write(canonicalJson(result));
