#!/usr/bin/env node
/**
 * Verify one complete hosted value-index npm and browser selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexBrowserCiRecords
	, checkedRecordValueIndexBrowserControlContracts
	, parseCheckedRecordValueIndexBrowserCiArgs
} from "../tests/helpers/checked-record-value-index-browser-ci-report.mjs";

const selected = parseCheckedRecordValueIndexBrowserCiArgs(process.argv.slice(2));
const result = await checkCheckedRecordValueIndexBrowserCiRecords(selected, {
	acceptanceTap: await readFile(selected["acceptance-tap"], "utf8")
	, controlsTap: await readFile(selected["controls-tap"], "utf8")
	, runtime: JSON.parse(await readFile(selected.runtime))
	, paths: await nativeArtifactPaths(selected.directory)
	, read: path => {
		assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
		assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
		return readFile(join(selected.directory, path));
	}
}, checkedRecordValueIndexBrowserControlContracts.live);
process.stdout.write(canonicalJson(result));
