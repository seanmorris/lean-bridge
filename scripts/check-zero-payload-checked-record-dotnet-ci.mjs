#!/usr/bin/env node
/**
 * Validate one complete zero-payload C# record set.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	checkZeroPayloadDotnetCiRecords, parseZeroPayloadDotnetCiArgs
} from "../tests/helpers/zero-payload-checked-record-dotnet-ci-report.mjs";

const selected = parseZeroPayloadDotnetCiArgs(process.argv.slice(2));
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
const accepted = await checkZeroPayloadDotnetCiRecords(selected, {
	tap, read, paths: await nativeArtifactPaths(directory)
	, dotnetIdentity: { bytes: dotnet.length, sha256: sha256(dotnet) }
});
process.stdout.write(canonicalJson(accepted));
