/**
 * Authenticate the directional callback Subtype foundation and its repaired
 * current-source pointers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeCallbackSubtypeNpmAcceptanceSource } from "./callback-subtype-npm-acceptance-source-history.mjs";
import { beforeCallbackSubtypeNpmBrowserSource } from "./callback-subtype-npm-browser-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeCallbackSubtypeFoundationSource
	, callbackSubtypeFoundationChangedPaths
	, callbackSubtypeFoundationHistoryPath
	, callbackSubtypeFoundationImplementation
	, callbackSubtypeFoundationPredecessor
	, reverseCallbackSubtypeFoundationUpdate
} from "./callback-subtype-foundation-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const original = path => execFileSync("git", ["show"
	, `${callbackSubtypeFoundationPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("callback Subtype foundation history restores every source and pointer", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeFoundationHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-subtype-foundation-source-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeFoundationPredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeFoundationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeFoundationChangedPaths);
	for(const update of record.updates)
	{
		const latest = await readFile(update.path, "utf8");
		const current = beforeFinRefinementSource(
			update.path, latest, update.currentSha256
		);
		const accepted = beforeCallbackSubtypeNpmAcceptanceSource(
			update.path, current
		);
		const milestone = beforeCallbackSubtypeNpmBrowserSource(
			update.path, accepted, update.currentSha256
		);
		const previous = reverseCallbackSubtypeFoundationUpdate(
			milestone, update
		);
		assert.equal(previous, original(update.path));
		assert.equal(beforeCallbackSubtypeFoundationSource(
			update.path, milestone), previous);
		assert.equal(beforeCallbackSubtypeFoundationSource(
			update.path, milestone, update.currentSha256), milestone);
		assert.equal(beforeCallbackSubtypeFoundationSource(
			update.path, latest + "unknown"), latest + "unknown");
	}
	for(const addition of record.additions)
	{
		const current = beforeFinRefinementSource(
			addition.path, await readFile(addition.path, "utf8")
			, addition.currentSha256
		);
		const accepted = beforeCallbackSubtypeNpmAcceptanceSource(
			addition.path, current
		);
		const milestone = beforeCallbackSubtypeNpmBrowserSource(
			addition.path, accepted, addition.currentSha256
		);
		assert.equal(sha256(milestone), addition.currentSha256, addition.path);
	}
	for(const pin of record.pinContainers)
	{
		const latest = await readFile(pin.path, "utf8");
		const currentSource = beforeFinRefinementSource(
			pin.path, latest, pin.currentSha256
		);
		const accepted = beforeCallbackSubtypeNpmAcceptanceSource(
			pin.path, currentSource
		);
		let current = beforeCallbackSubtypeNpmBrowserSource(
			pin.path, accepted, pin.currentSha256
		);
		assert.equal(sha256(current), pin.currentSha256, pin.path);
		for(const replacement of [...pin.replacements].reverse())
		{
			assert.equal(current.split(replacement.current).length - 1
				, replacement.count, `${pin.path}: ${replacement.sourcePath}`);
			current = current.replaceAll(
				replacement.current, replacement.previous
			);
		}
		assert.equal(sha256(current), pin.previousSha256, pin.path);
	}
});

test("callback Subtype history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-subtype-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-subtype-foundation-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
