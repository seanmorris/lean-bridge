#!/usr/bin/env node
/**
 * Validate one complete dependent checked-record C# record set.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	parseDependentCheckedRecordDotnetCiArgs
} from "../tests/helpers/dependent-checked-record-dotnet-ci-report.mjs";
import {
	dependentCheckedRecordDotnetNegativeControls
} from "../tests/helpers/dependent-checked-record-dotnet-controls.mjs";

const selected = parseDependentCheckedRecordDotnetCiArgs(process.argv.slice(2));
const directory = await realpath(selected.directory);
const read = async path => {
	assert.ok(/^[A-Za-z0-9_.+/[\]-]+$/u.test(path)
		&& path.split("/").every(part => part
			&& part !== "." && part !== ".."), path);
	const file = join(directory, path);
	assert.equal(await realpath(file), file, path);
	return readFile(file);
};
const tap = await readFile(selected.tap, "utf8");
selected.dotnet = await realpath(selected.dotnet);
const dotnet = await readFile(selected.dotnet);
const paths = await nativeArtifactPaths(directory);
const originals = new Map();
for(const path of paths) originals.set(path, await read(path));
const controlled = await dependentCheckedRecordDotnetNegativeControls(originals, {
	...selected, tapSource: tap
}, { bytes: dotnet.length, sha256: sha256(dotnet) });
const { accepted, ...controls } = controlled;
process.stdout.write(canonicalJson({ ...accepted, controls }));
