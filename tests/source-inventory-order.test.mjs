/**
 * A source inventory sort must preserve membership and immutable predecessor hashes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { verifyAddedSourceRegistrations } from "./helpers/source-registration-history.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";
import { assertInventoryOrderVerification, beforeInventoryOrderVerification, reverseInventoryFileOrder } from "./helpers/source-inventory-order.mjs";

const manifest = files => JSON.stringify({ name: "inventory-fixture", files, scripts: { test: "node --test" } }, null, 2) + "\n";
const files = ["src/backends/php/z.mjs", "src/backends/php/a.mjs"];
const original = manifest(files), sorted = manifest([...files].sort());
const step = path => ({ path, kind: "reorder-files", previousFiles: files
	, previousSha256: sha256(original), currentSha256: sha256(sorted) });

test("inventory ordering reverses only a sorted permutation and composes with later additions", () => {
	for(const path of ["package.json", "config/cli-package.v1.json"])
	{
		const update = step(path);
		assert.equal(reverseInventoryFileOrder(path, sorted, update), original);
		verifyAddedSourceRegistrations(path, sorted, sha256(original), [update]);
		const line = '    "src/backends/php/new.mjs",';
		const added = sorted.replace('    "src/backends/php/z.mjs"', line + '\n    "src/backends/php/z.mjs"');
		const addition = { path, addedLines: [line], previousSha256: sha256(sorted), currentSha256: sha256(added) };
		verifyAddedSourceRegistrations(path, added, sha256(original), [addition, update]);
	}
});

test("inventory ordering rejects new paths, omissions, duplicates and unrelated manifest edits", () => {
	const path = "package.json", update = step(path);
	for(const source of [
		manifest([files[0]])
		, manifest([...files].sort().concat("src/backends/php/extra.mjs"))
		, manifest([files[0], files[0]])
		, sorted + "\n"
		, sorted.replace("inventory-fixture", "different-package")
		, sorted.replace("node --test", "node --test || true")
	]) {
		const changed = { ...update, currentSha256: sha256(source) };
		assert.throws(() => verifyAddedSourceRegistrations(path, source, sha256(original), [changed]));
	}
	assert.throws(() => reverseInventoryFileOrder(path, original, { ...update, currentSha256: sha256(original) }));
	verifyAddedSourceRegistrations(path, original, sha256(original), []);
	for(const changed of [
		{ ...update, previousFiles: [...files, files[0]] }
		, { ...update, previousFiles: [...files].sort() }
		, { ...update, previousFiles: [1, 2] }
		, { ...update, addedLines: ["unrelated"] }
		, { ...update, path: "config/cli-package.v1.json" }
		, { ...update, previousSha256: "0".repeat(64) }
	]) assert.throws(() => reverseInventoryFileOrder(path, sorted, changed));
	assert.throws(() => reverseInventoryFileOrder(".github/workflows/consumer-matrix.yml", sorted, update));
	assert.throws(() => reverseInventoryFileOrder("src/build/native-project.mjs", sorted, update));
	assert.equal(assertInventoryOrderVerification("src/build/native-project.mjs", sorted, sha256(original)), false);
});

test("inventory ordering retains original receipts and exact verifier predecessors", async () => {
	const record = JSON.parse(await readFile("docs/evidence/source-inventory-order-20260924.json", "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "source-inventory-order");
	assert.deepEqual(Object.keys(record.inventories).sort(), ["config/cli-package.v1.json", "package.json"]);
	for(const [path, before] of Object.entries(record.inventories))
	{
		const source = await readFile(path, "utf8"), files = JSON.parse(source).files;
		assert.equal(before.files.length, 441); assert.equal(new Set(before.files).size, 441);
		assert.equal(new Set(files).size, files.length);
		assert.deepEqual(files, [...files].sort());
		assert.ok(before.files.every(file => files.includes(file)));
		await assertAdministrativeSourceUpdate(path, before.sha256);
	}
	for(const [path, before] of Object.entries(record.verifiers))
	{
		const source = await readFile(path, "utf8");
		assert.equal(sha256(beforeInventoryOrderVerification(path, source)), before);
		assert.equal(assertInventoryOrderVerification(path, source, before), true);
		assert.equal(assertInventoryOrderVerification(path, source + "\n", before), false);
		await assertAdministrativeSourceUpdate(path, before);
	}
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	for(const [path, hash] of Object.entries(record.originalReceipts)) assert.equal(sha256(await readFile(path)), hash);
	assert.equal(sha256(record.executionLog.text), record.executionLog.sha256);
	assert.match(record.executionLog.text, /ok \d+ - the development package has the same explicit safe source allowlist\n/);
	assert.match(record.executionLog.text, /# fail 0\n# cancelled 0\n# skipped 0/);
});
