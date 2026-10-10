/**
 * Authenticate PHP-Wasm Subtype installed probe harness history while preserving earlier execution evidence.
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
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePhpWasmEntryHarnessSource, phpWasmEntryHarnessChangedPaths, phpWasmEntryHarnessHistoryPath, phpWasmEntryHarnessPredecessor, reversePhpWasmEntryHarnessUpdate } from "./php-wasm-entry-harness-history.mjs";

test("PHP-Wasm Subtype installed probe harness integration authenticates every transition and refuses unrecorded edits", async () => {
	const history = JSON.parse(await readFile(phpWasmEntryHarnessHistoryPath, "utf8"));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "php-wasm-entry-harness-v1");
	assert.equal(history.predecessorCommit, phpWasmEntryHarnessPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), phpWasmEntryHarnessChangedPaths);
	for(const update of history.updates)
	{
		const current = await readFile(update.path, "utf8"), previous = reversePhpWasmEntryHarnessUpdate(current, update);
		assert.equal(beforePhpWasmEntryHarnessSource(update.path, current), previous);
		assert.equal(beforePhpWasmEntryHarnessSource(update.path, current, update.currentSha256), current);
		assert.equal(beforePhpWasmEntryHarnessSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unknown edit\n";
		assert.equal(beforePhpWasmEntryHarnessSource(update.path, changed), changed);
		assert.throws(() => reversePhpWasmEntryHarnessUpdate(changed, update));
		for(const mutation of [
			{ previousSha256: "0".repeat(64) }, { currentSha256: "0".repeat(64) }
			, { path: "unknown.mjs" }, { edits: [] }
			, { edits: [...update.edits, update.edits[0]] }
			, { edits: [{ ...update.edits[0], start: -1 }] }
			, { edits: [{ ...update.edits[0], current: "unrecorded" }] }
		]) assert.throws(() => reversePhpWasmEntryHarnessUpdate(current, { ...update, ...mutation }));
	}
	const buffer = Buffer.from("unregistered bytes");
	assert.equal(beforePhpWasmEntryHarnessSource(phpWasmEntryHarnessChangedPaths[0], buffer), buffer);
	assert.equal(beforePhpWasmEntryHarnessSource("unknown.mjs", "unregistered bytes"), "unregistered bytes");
});

test("PHP-Wasm Subtype installed probe harness integration preserves the earlier source ledgers", async () => {
	for(const [path, digest] of [
		["docs/evidence/php-wasm-subtype-entry-source-history-20261010.json", "21629834a6b9bde05f5ba26557bd016375c9e89470e4991179e1ea6c12ada84d"]
		, ["docs/evidence/fin-jvm-diagnostics-source-history-20261010.json", "00bb8d625c48b4e0db115a9dca3d78905420fa6f2a1da562fb5681b1a683cb9a"]
		, ["docs/evidence/fin-dotnet-sdk-source-history-20261010.json", "e1589698e97e00d01d1c72702a04ceb360693b5244d11086f3bcfd56811b6e72"]
		, ["docs/evidence/php-wasm-subtype-promotion-source-history-20261010.json", "e15bcc8b90174b20163bc9e04ae46eb6da68887998d313db2ad41e3aa2ae7af0"]
		, ["docs/evidence/php-wasm-subtype-acceptance-source-history-20261010.json", "8ece9a966dee723f1dd88a396656661fba75bfa32cf79c1358a3a920c9c1256b"]
		, ["docs/evidence/php-wasm-subtype-source-history-20261010.json", "4c620679ca2b753d21fe0b1d0b9537c25af8e24d0c001a320b500ae5230cd636"]
		, ["docs/evidence/php-wasm-direct-fin-promotion-source-history-20261010.json", "edac06a7645178f71b0eb2231bf00adb52ec53955f02ae5332677346a9ddd203"]
		, ["docs/evidence/fin-core-repair-source-history-20261010.json", "96be754959edb58f5c9085bf78530902ecd837246fb5a9c2d248c212804e02e4"]
		, ["docs/evidence/php-wasm-fin-direct-source-history-20261010.json", "26dee560f3bab991ccbaa57cfda37b2ca1dcbec794693598b6fee57ff6f18e12"]
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

test("PHP-Wasm Subtype installed probe harness changes source pins without changing any support claim", async () => {
	const history = JSON.parse(await readFile(phpWasmEntryHarnessHistoryPath, "utf8"));
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforePhpWasmEntryHarnessSource(path, text));
	const expected = structuredClone(previous); let refreshed = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; refreshed++; }
	}
	assert.ok(refreshed > 0);
	assert.deepEqual(current, expected);
	assert.deepEqual(current.observations, previous.observations);
	assert.equal(current.evidence.length, 407); assert.equal(current.observations.length, 509);
	const digests = new Map();
	for(const file of current.evidence.flatMap(entry => entry.files))
	{
		if(!digests.has(file.path)) digests.set(file.path, sha256(await readFile(file.path)));
		assert.equal(digests.get(file.path), file.sha256, file.path);
	}
});

test("PHP-Wasm Subtype installed probe harness integration history writer refuses an unrelated HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-record-omission-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-php-wasm-entry-harness-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /PHP-Wasm Subtype installed probe harness history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
