#!/usr/bin/env node
/**
 * Authenticate one downloaded hosted nominal entry-measurement artifact and print its summary.
 *
 * Run it as: summarize-nominal-subtype-entry-hosted.mjs --lane <native|browser> --producer <commit> --name <artifact-name> --directory <extracted-artifact>.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { summarizeNominalSubtypeEntryHostedRun } from "../tests/helpers/nominal-subtype-entry-hosted-summary.mjs";

const usage = "Usage: summarize-nominal-subtype-entry-hosted.mjs --lane <native|browser> --producer <commit> --name <artifact-name> --directory <extracted-artifact>";
const args = process.argv.slice(2), allowed = ["lane", "producer", "name", "directory"], selected = {};
assert.ok(args.length === 2 * allowed.length, usage);
for(let index = 0; index < args.length; index += 2)
{
	const flag = args[index], value = args[index + 1];
	assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
	assert.ok(!Object.hasOwn(selected, flag.slice(2)) && typeof value === "string" && value && !value.startsWith("--"), usage);
	selected[flag.slice(2)] = value;
}
const paths = await nativeArtifactPaths(selected.directory);
const summary = await summarizeNominalSubtypeEntryHostedRun(selected.lane, {
	name: selected.name, producer: selected.producer, paths
	, read: path => readFile(join(selected.directory, path))
});
process.stdout.write(canonicalJson(summary));
