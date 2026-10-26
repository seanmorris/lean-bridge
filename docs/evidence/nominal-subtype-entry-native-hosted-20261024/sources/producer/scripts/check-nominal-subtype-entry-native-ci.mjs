/**
 * Verify one complete recurring native nominal entry selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { parseNominalSubtypeEntryNativeCiArgs, checkNominalSubtypeEntryNativeCiRecords } from "../tests/helpers/nominal-subtype-entry-native-ci-report.mjs";

const selected = parseNominalSubtypeEntryNativeCiArgs(process.argv.slice(2));
const result = await checkNominalSubtypeEntryNativeCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, paths: await nativeArtifactPaths(selected.directory)
	, read: path => {
		assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
		assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
		return readFile(join(selected.directory, path));
	}
});
process.stdout.write(canonicalJson(result));
