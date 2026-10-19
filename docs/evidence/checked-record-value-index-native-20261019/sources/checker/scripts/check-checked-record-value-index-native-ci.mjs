#!/usr/bin/env node
/**
 * Validate one hosted value-index C/C++ route from immutable retained files.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexNativeCiRecords
	, parseCheckedRecordValueIndexNativeCiArgs
} from "../tests/helpers/checked-record-value-index-native-ci-report.mjs";

const selected = parseCheckedRecordValueIndexNativeCiArgs(process.argv.slice(2));
const directory = resolve(selected.directory);
const result = await checkCheckedRecordValueIndexNativeCiRecords(selected, {
	acceptanceTap: await readFile(resolve(selected["acceptance-tap"]), "utf8")
	, controlsTap: await readFile(resolve(selected["controls-tap"]), "utf8")
	, runtime: JSON.parse(await readFile(resolve(selected.runtime)))
	, paths: await nativeArtifactPaths(directory)
	, read: path => readFile(resolve(directory, path))
});
process.stdout.write(canonicalJson(result));
