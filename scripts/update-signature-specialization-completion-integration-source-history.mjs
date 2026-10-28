#!/usr/bin/env node
/**
 * Record central registration of the installed-signature completion history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	signatureSpecializationCompletionIntegrationAddedPaths
	, signatureSpecializationCompletionIntegrationBase
	, signatureSpecializationCompletionIntegrationHistoryPath
	, signatureSpecializationCompletionIntegrationImplementation
	, signatureSpecializationCompletionIntegrationPaths
} from "../tests/helpers/signature-specialization-completion-integration-source-history.mjs";
import {
	signatureSpecializationCompletionHistoryPath
} from "../tests/helpers/signature-specialization-completion-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = signatureSpecializationCompletionIntegrationBase;
const implementation = signatureSpecializationCompletionIntegrationImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Signature specialization integration history requires its exact implementation");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...signatureSpecializationCompletionIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${signatureSpecializationCompletionIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
const additionsInWorktree = names([
	"ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationCompletionIntegrationAddedPaths
]);
assert.deepEqual(additionsInWorktree
	, [...signatureSpecializationCompletionIntegrationAddedPaths].sort());

const updates = [];
for(const path of signatureSpecializationCompletionIntegrationPaths)
	updates.push(await gitSourceHistoryTransition(path, base, implementation));
const additions = [];
for(const path of signatureSpecializationCompletionIntegrationAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only", base, "--", path]).trim()
		, "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(signatureSpecializationCompletionIntegrationHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "signature-specialization-completion-integration-v1"
		, baseCommit: base
		, implementationCommit: implementation
		, baseHistory: {
			path: signatureSpecializationCompletionHistoryPath
			, sha256: sha256(await readFile(
				signatureSpecializationCompletionHistoryPath))
		}
		, scope: "Register the independently authenticated 45-cell signature-completion source history newest-first in the reversible Fin history hub and checked-JavaScript partition 10. Preserve runtime behavior, support claims, observations, evidence identities and package surfaces."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates and `
	+ `${additions.length} additions.\n`);
