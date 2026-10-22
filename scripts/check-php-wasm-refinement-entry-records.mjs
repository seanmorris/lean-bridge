/**
 * Recheck one installed nominal/recursive PHP-Wasm graph-entry record closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkPhpWasmRefinementEntryReport, parsePhpWasmRefinementEntryReportArgs
} from "../tests/helpers/php-wasm-refinement-entry-report.mjs";

const { directory, ...selection } = parsePhpWasmRefinementEntryReportArgs(process.argv.slice(2));
const result = await checkPhpWasmRefinementEntryReport({
	paths: await nativeArtifactPaths(directory)
	, read: path => {
		assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
		assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
		return readFile(join(directory, path));
	}
}, selection);
process.stdout.write(canonicalJson(result));
