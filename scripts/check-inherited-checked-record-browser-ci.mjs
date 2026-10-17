#!/usr/bin/env node
/**
 * Verify one complete hosted inherited checked-record browser selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import {
	checkInheritedCheckedRecordBrowserCiRecords,
	parseInheritedCheckedRecordBrowserCiArgs
} from "../tests/helpers/inherited-checked-record-browser-ci-report.mjs";

const selected = parseInheritedCheckedRecordBrowserCiArgs(process.argv.slice(2));
const result = await checkInheritedCheckedRecordBrowserCiRecords(selected, {
	npmTap: await readFile(selected["npm-tap"], "utf8")
	, browserTap: await readFile(selected["browser-tap"], "utf8")
	, controlsTap: await readFile(selected["controls-tap"], "utf8")
	, runtime: JSON.parse(await readFile(selected.runtime))
	, paths: await nativeArtifactPaths(selected.directory)
	, read: path => {
		assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
		assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
		return readFile(join(selected.directory, path));
	}
});
process.stdout.write(canonicalJson(result));
