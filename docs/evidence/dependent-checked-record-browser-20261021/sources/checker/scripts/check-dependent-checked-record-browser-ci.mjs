#!/usr/bin/env node
/**
 * Recheck one retained dependent npm/browser route without trusting its
 * producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkDependentCheckedRecordBrowserCiRecords
	, parseDependentCheckedRecordBrowserCiArgs
} from "../tests/helpers/dependent-checked-record-browser-ci-report.mjs";

const selected = parseDependentCheckedRecordBrowserCiArgs(
	process.argv.slice(2)
);
const directory = await realpath(selected.directory);
const read = async path => {
	assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
	const file = join(directory, path);
	assert.equal(await realpath(file), file);
	return readFile(file);
};
process.stdout.write(canonicalJson(
	await checkDependentCheckedRecordBrowserCiRecords(selected, {
		tap: await readFile(selected.tap, "utf8")
		, paths: await nativeArtifactPaths(directory), read
	})
));
