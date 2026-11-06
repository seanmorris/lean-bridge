#!/usr/bin/env node
/**
 * Record the focused documentation, ABI-control and WIT repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	assertCoreFocusedRootRepair
	, coreFocusedRootRepairHistoryAdditions as historyAdditions
	, coreFocusedRootRepairHistoryPath as historyPath
	, coreFocusedRootRepairImplementation as implementation
	, coreFocusedRootRepairImplementationPaths as implementationPaths
	, coreFocusedRootRepairIntegrationPaths as integrationPaths
	, coreFocusedRootRepairPredecessor as predecessor
} from "../tests/helpers/core-focused-root-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-focused-root-repair-source-history.mjs");
assert.equal(existsSync(historyPath), false
	, "Focused root repair history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation
	, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);
const sources = Object.fromEntries(implementationPaths.map(path => [
	path, git(["show", `${implementation}:${path}`])
]));
assert.deepEqual(assertCoreFocusedRootRepair(sources), {
	generatedGuides: 6, compilerPagesChecked: 8, repairedControls: 3
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});
const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [predecessor, implementation].map(commit =>
	git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactModels[0]);

const directory = await mkdtemp(join(tmpdir(), "lean-core-focused-root-history-"));
try
{
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, {
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate focused Core root repairs\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1, milestone: "core-focused-root-repair-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			run: 41385913296
			, jobs: [306, 494, 534]
			, observed: "Raw CommonMark tags broke six generated consumer guides; two mutation controls targeted boundaries earlier than the production contracts they intended to test"
		}
		, rootCause: "Generated conversion-note prose copied markup-like host types outside code spans, so the site compiler parsed Option<T> as forbidden inline HTML. The Fin no-op mutant failed during private ABI derivation, before selection, and the WIT dependency mutant removed the first wasi-consumer edge instead of specifically exercising support-summary."
		, repair: "Render markup-like leading host types as Markdown code and reject any remaining raw tag outside code spans; test the no-op Fin mutant at ABI derivation while retaining a valid-ABI smuggling control at selection; and mutate both WIT aggregate dependencies independently."
		, behavior: {
			generatedGuides: 6, compilerPagesChecked: 8, repairedControls: 3
		}
		, exactModel: {
			sha256: sha256(exactModels[0])
			, bytes: Buffer.byteLength(exactModels[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
