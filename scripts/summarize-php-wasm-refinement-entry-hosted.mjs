#!/usr/bin/env node
/**
 * Recheck a complete directory of extracted hosted PHP-Wasm entry artifacts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkPhpWasmRefinementEntryVerifier
	, phpWasmRefinementEntryArtifactNames
	, summarizePhpWasmRefinementEntryHostedArtifacts
} from "../tests/helpers/php-wasm-refinement-entry-hosted-summary.mjs";

const usage = "Usage: summarize-php-wasm-refinement-entry-hosted.mjs --producer <full-commit> --directory <absolute-extracted-artifact-root>";
const args = process.argv.slice(2), selected = {};
assert.equal(args.length, 4, usage);
for(let index = 0; index < args.length; index += 2)
{
	const option = args[index], value = args[index + 1];
	assert.ok(["--producer", "--directory"].includes(option), usage);
	assert.ok(typeof value === "string" && value.length > 0
		&& !value.startsWith("--") && !Object.hasOwn(selected, option), usage);
	selected[option] = value;
}
assert.match(selected["--producer"], /^[a-f0-9]{40}$/u);
assert.ok(isAbsolute(selected["--directory"])
	&& resolve(selected["--directory"]) === selected["--directory"], usage);
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const git = args => execFileSync("git", args, {
	cwd: repositoryRoot, encoding: "utf8"
}).trim();
assert.equal(resolve(git(["rev-parse", "--show-toplevel"])), repositoryRoot
	, "hosted verifier script must belong to the checked repository root");
const gitLines = args => git(args)
	.split("\n").filter(Boolean);
const verification = checkPhpWasmRefinementEntryVerifier(selected["--producer"], {
	verifierCommit: git(["rev-parse", "HEAD"])
	, modifiedSourcePaths: gitLines(["diff", "--name-only", "HEAD", "--"
		, "src", "tests", "scripts"])
	, untrackedSourcePaths: gitLines(["ls-files", "--others", "--exclude-standard"
		, "--", "src", "tests", "scripts"])
	, verifierNodeVersion: process.versions.node
});
const names = phpWasmRefinementEntryArtifactNames(selected["--producer"]);
const entries = await readdir(selected["--directory"], { withFileTypes: true });
assert.deepEqual(entries.map(item => item.name).sort(), [...names].sort()
	, "extracted artifact directory closure");
assert.ok(entries.every(item => item.isDirectory()), "every artifact must be a directory");
const artifacts = [];
for(const name of names)
{
	const root = join(selected["--directory"], name);
	artifacts.push({
		name, paths: await nativeArtifactPaths(root)
		, read: path => readFile(join(root, path))
	});
}
const summary = await summarizePhpWasmRefinementEntryHostedArtifacts(
	selected["--producer"], artifacts, verification
);
process.stdout.write(canonicalJson(summary));
