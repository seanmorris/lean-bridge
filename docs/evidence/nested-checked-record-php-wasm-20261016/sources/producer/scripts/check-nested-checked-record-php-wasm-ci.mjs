/**
 * Require one complete installed nested checked-record PHP-Wasm selection and independent host evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { parseNestedCheckedRecordPhpWasmCiArgs, checkNestedCheckedRecordPhpWasmCiRecords } from "../tests/helpers/nested-checked-record-php-wasm-ci-report.mjs";

const selected = parseNestedCheckedRecordPhpWasmCiArgs(process.argv.slice(2));
const result = await checkNestedCheckedRecordPhpWasmCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, runtime: JSON.parse(await readFile(selected.runtime, "utf8"))
	, paths: await nativeArtifactPaths(selected.directory)
	, read: path => {
		assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
		assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
		return readFile(join(selected.directory, path));
	}
});
process.stdout.write(canonicalJson(result));
