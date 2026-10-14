/**
 * Verify one complete installed nominal browser selection from its original files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { parseNominalSubtypeBrowserCiArgs, checkNominalSubtypeBrowserCiRecords } from "../tests/helpers/nominal-subtype-browser-ci-report.mjs";

const selected = parseNominalSubtypeBrowserCiArgs(process.argv.slice(2));
const result = await checkNominalSubtypeBrowserCiRecords(selected, {
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
