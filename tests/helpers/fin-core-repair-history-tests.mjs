/**
 * Authenticate Fin Core repair history while preserving earlier execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { perlFinOptionNote, perlFinOptionNoteIds, restorePerlFinOptionNotes } from "./fin-core-repair-notes.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePhpWasmDirectPromotionSource } from "./php-wasm-direct-fin-promotion-history.mjs";
import { beforeFinCoreRepairSource, finCoreRepairChangedPaths, finCoreRepairHistoryPath, finCoreRepairPredecessor, reverseFinCoreRepairUpdate } from "./fin-core-repair-history.mjs";

test("Fin Core repair integration authenticates every transition and refuses unrecorded edits", async () => {
	const history = JSON.parse(await readFile(finCoreRepairHistoryPath, "utf8"));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "fin-core-repair-v1");
	assert.equal(history.predecessorCommit, finCoreRepairPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), finCoreRepairChangedPaths);
	for(const update of history.updates)
	{
		const current = beforePhpWasmDirectPromotionSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseFinCoreRepairUpdate(current, update);
		assert.equal(beforeFinCoreRepairSource(update.path, current), previous);
		assert.equal(beforeFinCoreRepairSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinCoreRepairSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unknown edit\n";
		assert.equal(beforeFinCoreRepairSource(update.path, changed), changed);
		assert.throws(() => reverseFinCoreRepairUpdate(changed, update));
		for(const mutation of [
			{ previousSha256: "0".repeat(64) }, { currentSha256: "0".repeat(64) }
			, { path: "unknown.mjs" }, { edits: [] }
			, { edits: [...update.edits, update.edits[0]] }
			, { edits: [{ ...update.edits[0], start: -1 }] }
			, { edits: [{ ...update.edits[0], current: "unrecorded" }] }
		]) assert.throws(() => reverseFinCoreRepairUpdate(current, { ...update, ...mutation }));
	}
	const buffer = Buffer.from("unregistered bytes");
	assert.equal(beforeFinCoreRepairSource(finCoreRepairChangedPaths[0], buffer), buffer);
	assert.equal(beforeFinCoreRepairSource("unknown.mjs", "unregistered bytes"), "unregistered bytes");
});

test("Fin Core repair integration preserves the earlier source ledgers", async () => {
	for(const [path, digest] of [
		["docs/evidence/php-wasm-fin-direct-source-history-20261010.json", "26dee560f3bab991ccbaa57cfda37b2ca1dcbec794693598b6fee57ff6f18e12"]
		, ["docs/evidence/fin-alias-closure-source-history-20261010.json", "c1454e22108e487a81bf56834e58c87578c70a712561045ecbddc6c0798a3d44"]
		, ["docs/evidence/fin-nominal-refusal-source-history-20261010.json", "cb9b7e38342da833fb20a32614901edddec7a5a96dc4436aab939c966ac8298e"]
		, ["docs/evidence/fin-record-zero-ci-source-history-20261010.json", "3dba67892bd0be4fc52053be7b10f968a56c431a95cd7811a510c35ef423e3a5"]
		, ["docs/evidence/fin-native-hosted-promotion-source-history-20261010.json", "f109bb68ee632f7a061a40ec07cfec2bdab43ca4da411c860dc67fcd434f7fc4"]
		, ["docs/evidence/fin-record-review-omission-source-history-20261010.json", "80e026cf1a13d160821a869f5be0ec96d74e9d70cbda7a248c614911354f2e46"]
		, ["docs/evidence/fin-container-foreign-source-history-20261010.json", "302e830cbfc92e23387476621dd7f440b9b6d431d90ced3d0857fe1fab3b2dc2"]
		, ["docs/evidence/fin-container-edge-ci-source-history-20261010.json", "df5b0fcaef151ea18c128b4d5d9acfbdc6f250caad88d4613b6c526308b1f42c"]
		, ["docs/evidence/fin-container-edge-integration-source-history-20261010.json", "a9fa371246d50339037ad0c1ded08f5d3c83b7802817dd93980e1669cc27a4b1"]
		, ["docs/evidence/native-fin-diagnostic-ci-source-history-20261010.json", "77d1716708d41789f6dced955d6764d3ca2c86c88a1f2eea8b8df356e1dea8c6"]
		, ["docs/evidence/native-fin-diagnostic-source-history-20261010.json", "2bc3b1217601bb0eb0c19b9f1496d00ab5df831e3a1bd1881a4429b28fd210ab"]
	]) assert.equal(sha256(await readFile(path)), digest, path);
});

test("Fin Core repair integration history writer refuses an unrelated HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-record-omission-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-fin-core-repair-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Fin Core repair history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});

test("Fin Core repair integration changes exact source pins and Perl option guidance only", async () => {
	const path = "docs/type-surface.v1.json", source = beforePhpWasmDirectPromotionSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeFinCoreRepairSource(path, source));
	const expected = restorePerlFinOptionNotes(previous), history = JSON.parse(await readFile(finCoreRepairHistoryPath, "utf8"));
	let refreshed = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; refreshed++; }
	}
	assert.ok(refreshed > 0); assert.deepEqual(current, expected);
	assert.deepEqual(current.observations, expected.observations);
	assert.equal(current.observations.length, previous.observations.length);
	const digests = new Map();
	for(const file of current.evidence.flatMap(entry => entry.files))
	{
		if(!digests.has(file.path)) digests.set(file.path, sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)));
		assert.equal(file.sha256, digests.get(file.path), file.path);
	}
});

test("historical Buffer reads stop at authenticated identities and preserve unknown bytes", async () => {
	const path = "src/analyze/NativeExports.lean", current = await readFile(path);
	const expected = "46b46cbb21fe51d166ab700cde2c41583bc3a093f67cecd07d104cdf649f61ce";
	const previous = beforeFinRefinementSource(path, current, expected);
	assert.equal(sha256(previous), expected);
	assert.notEqual(sha256(current), expected);
	assert.equal(beforeFinRefinementSource(path, current, sha256(current)), current);
	assert.equal(beforeFinRefinementSource(path, previous, expected), previous);
	for(const changed of [Buffer.concat([current, Buffer.from("\n")]), Buffer.from(current.subarray(1)), Buffer.from([0, 255, 128, 192])])
	{
		assert.equal(beforeFinRefinementSource(path, changed, expected), changed);
		assert.notEqual(sha256(changed), expected);
	}
	assert.equal(beforeFinRefinementSource("unknown.bin", current, expected), current);
	assert.notEqual(sha256(beforeFinRefinementSource(path, current, "0".repeat(64))), "0".repeat(64));
});

test("Perl option guidance repairs only four notes and refuses an altered predecessor", async () => {
	const path = "docs/type-surface.v1.json", current = JSON.parse(await readFile(path));
	const previous = JSON.parse(beforeFinCoreRepairSource(path, JSON.stringify(current, null, 2) + "\n"));
	const repaired = restorePerlFinOptionNotes(previous), restored = structuredClone(repaired);
	for(const id of perlFinOptionNoteIds)
	{
		const old = previous.observations.find(item => item.id === id), item = restored.observations.find(item => item.id === id);
		assert.equal(item.conversionNotes.fin, perlFinOptionNote);
		item.conversionNotes.fin = old.conversionNotes.fin;
		for(const edit of [observation => { observation.conversionNotes.fin += "\n"; }, observation => { observation.profiles = ["python"]; }])
		{
			const changed = structuredClone(previous);
			edit(changed.observations.find(item => item.id === id));
			assert.throws(() => restorePerlFinOptionNotes(changed));
		}
		const missing = structuredClone(previous);
		missing.observations = missing.observations.filter(item => item.id !== id);
		assert.throws(() => restorePerlFinOptionNotes(missing));
	}
	assert.deepEqual(restored, previous);
	assert.throws(() => restorePerlFinOptionNotes(repaired));
	const guide = await readFile("docs/consume/perl.md", "utf8");
	const row = guide.split("\n").find(line => line.startsWith("| `Fin n`"));
	assert.ok(row.includes(perlFinOptionNote));
});
