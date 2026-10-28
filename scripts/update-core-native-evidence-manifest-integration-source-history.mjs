#!/usr/bin/env node
/**
 * Record integration of the Core native evidence-manifest repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	coreNativeEvidenceManifestIntegrationAddedPaths
	, coreNativeEvidenceManifestIntegrationBase
	, coreNativeEvidenceManifestIntegrationHistoryPath
	, coreNativeEvidenceManifestIntegrationImplementation
	, coreNativeEvidenceManifestIntegrationPaths
	, reverseCoreNativeEvidenceManifestIntegrationUpdate
} from "../tests/helpers/core-native-evidence-manifest-integration-source-history.mjs";
import { coreNativeEvidenceManifestHistoryPath } from "../tests/helpers/core-native-evidence-manifest-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 32 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = coreNativeEvidenceManifestIntegrationBase;
const implementation = coreNativeEvidenceManifestIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...coreNativeEvidenceManifestIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${coreNativeEvidenceManifestIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreNativeEvidenceManifestIntegrationAddedPaths])
, [...coreNativeEvidenceManifestIntegrationAddedPaths].sort());

const updates = [];
for(const path of coreNativeEvidenceManifestIntegrationPaths)
{
	const update = await gitSourceHistoryTransition(path, base, implementation);
	const current = git(["show", `${implementation}:${path}`]);
	const previous = git(["show", `${base}:${path}`]);
	assert.equal(reverseCoreNativeEvidenceManifestIntegrationUpdate(
		current, update), previous, path);
	updates.push(update);
}
const additions = [];
for(const path of coreNativeEvidenceManifestIntegrationAddedPaths)
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
await writeFile(coreNativeEvidenceManifestIntegrationHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "core-native-evidence-manifest-integration-v1"
		, baseCommit: base, implementationCommit: implementation
		, baseHistory: { path: coreNativeEvidenceManifestHistoryPath
			, sha256: sha256(await readFile(
				coreNativeEvidenceManifestHistoryPath)) }
		, scope: "Register the native-specialization evidence-manifest repair newest-first in the reversible Fin history hub and checked-JavaScript partition 10."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration transitions.\n`);
