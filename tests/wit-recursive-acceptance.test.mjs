/**
 * Final copied-recursive WIT acceptance without callback or resource overclaims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeWitAcceptance, reverseWitAcceptanceUpdate, witAcceptancePath } from "./helpers/wit-acceptance-source-history.mjs";
import { assertWitOrdinaryRegression, assertWitRecursiveAcceptance, witOrdinaryRegressionPath } from "./helpers/wit-recursive-acceptance.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("WIT acceptance binds all copied positions to installed, reproduced packages", async () => {
	await assertWitRecursiveAcceptance(await json(witAcceptancePath));
});

test("WIT acceptance rejects callback claims, omitted paths and changed source identities", async () => {
	const original = await json(witAcceptancePath);
	for(const mutate of [
		record => { record.scope.structuredCallbacks = true; }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.scope.paths.pop(); }
		, record => { record.scope.positions.pop(); }
		, record => { record.inventory.installed++; }
		, record => { record.execution.sha256 = "0".repeat(64); }
		, record => { record.ordinaryRegression.sha256 = "0".repeat(64); }
		, record => { record.updates.pop(); }
		, record => { record.sourceHashes["tests/native-wit.test.mjs"] = "0".repeat(64); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertWitRecursiveAcceptance(altered));
	}
});

test("ordinary WIT regression evidence requires the original failure and complete passing rerun", async () => {
	const original = await json(witOrdinaryRegressionPath);
	assertWitOrdinaryRegression(original);
	for(const mutate of [
		record => { record.fixed.text = record.fixed.text.replace("# skipped 0", "# skipped 1"); }
		, record => { record.fixed.text = record.fixed.text.replace("# pass 4", "# pass 3"); }
		, record => { record.fixed.command += " --test-name-pattern=archives"; }
		, record => { record.original.text = "# fail 1\n"; }
		, record => { record.fixed.exitCode = 1; }
	]) {
		const altered = structuredClone(original); mutate(altered);
		for(const run of [altered.original, altered.fixed]) run.sha256 = sha256(run.text);
		assert.throws(() => assertWitOrdinaryRegression(altered));
	}
});

test("WIT acceptance reverses exact edits and retains unrelated source changes", async () => {
	const record = await json(witAcceptancePath);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseWitAcceptanceUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeWitAcceptance(update.path, source)), update.previousSha256);
		assert.notEqual(sha256(beforeWitAcceptance(update.path, source + "\n// unrelated\n")), update.previousSha256);
		assert.throws(() => reverseWitAcceptanceUpdate(source + "\n// unrelated\n", update));
	}
});

test("WIT acceptance source spans preserve literal replacement tokens", () => {
	const previous = "prefix\n$& $` $' 🌿\nsuffix\n", current = "prefix\nnew $& $` $' 🌿\nsuffix\n";
	const update = { path: "docs/consume/wit-wasi.md"
		, previousSha256: sha256(previous)
		, currentSha256: sha256(current)
		, edits: [{ start: 7, previous: "$& $` $' 🌿", current: "new $& $` $' 🌿" }] };
	assert.equal(reverseWitAcceptanceUpdate(current, update), previous);
	assert.throws(() => reverseWitAcceptanceUpdate(current, { ...update, edits: [] }));
	assert.throws(() => reverseWitAcceptanceUpdate(current, { ...update, edits: [{ ...update.edits[0], start: 8 }] }));
});
