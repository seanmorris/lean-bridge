/**
 * Verify one complete recurring nominal npm/browser entry selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { parseNominalSubtypeEntryBrowserCiArgs, checkNominalSubtypeEntryBrowserCiRecords } from "../tests/helpers/nominal-subtype-entry-browser-ci-report.mjs";

const selected = parseNominalSubtypeEntryBrowserCiArgs(process.argv.slice(2));
const result = await checkNominalSubtypeEntryBrowserCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, runtime: JSON.parse(await readFile(selected.runtime))
	, paths: await nativeArtifactPaths(selected.directory)
	, read: path => {
		assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
		assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
		return readFile(join(selected.directory, path));
	}
});
process.stdout.write(canonicalJson(result));
