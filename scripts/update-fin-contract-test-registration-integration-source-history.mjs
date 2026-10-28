#!/usr/bin/env node
/**
 * Record central registration of the final Fin contract-test history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	finContractTestRegistrationIntegrationAddedPaths
	, finContractTestRegistrationIntegrationBase
	, finContractTestRegistrationIntegrationHistoryPath
	, finContractTestRegistrationIntegrationImplementation
	, finContractTestRegistrationIntegrationPaths
} from "../tests/helpers/fin-contract-test-registration-integration-source-history.mjs";
import {
	finContractTestRegistrationHistoryPath
} from "../tests/helpers/fin-contract-test-registration-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = finContractTestRegistrationIntegrationBase;
const implementation = finContractTestRegistrationIntegrationImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Final Fin test-registration integration history requires its exact implementation");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...finContractTestRegistrationIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${finContractTestRegistrationIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
const additionsInWorktree = names([
	"ls-files", "--others", "--exclude-standard", "--"
	, ...finContractTestRegistrationIntegrationAddedPaths
]);
assert.deepEqual(additionsInWorktree
	, [...finContractTestRegistrationIntegrationAddedPaths].sort());

const updates = [];
for(const path of finContractTestRegistrationIntegrationPaths)
	updates.push(await gitSourceHistoryTransition(path, base, implementation));
const additions = [];
for(const path of finContractTestRegistrationIntegrationAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only", base, "--", path]).trim()
		, "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(finContractTestRegistrationIntegrationHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "fin-contract-test-registration-integration-v1"
		, baseCommit: base
		, implementationCommit: implementation
		, baseHistory: {
			path: finContractTestRegistrationHistoryPath
			, sha256: sha256(await readFile(
				finContractTestRegistrationHistoryPath))
		}
		, scope: "Register the independently authenticated final Fin contract-test registration in the newest-first reversible Fin source-history hub and one checked-JavaScript partition. Preserve all runtime behavior, type-surface claims, observations, evidence identities and package surfaces."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates and `
	+ `${additions.length} additions.\n`);
