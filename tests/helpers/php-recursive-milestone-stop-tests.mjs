/**
 * Check the PHP inventory endpoint without replaying today's large inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { phpRecursiveTypeSurface } from "./php-recursive-callable-evidence.mjs";
import { phpRecursiveCallableHistoryPath } from "./php-recursive-callable-source-history.mjs";
import { sourceAtProducer } from "./producer-source.mjs";
import { sha256 } from "./source-history-digest.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const modulePath = "tests/helpers/php-recursive-callable-evidence.mjs";
const expected = "2".repeat(64);
const candidate = '{ "contractVersion": "candidate" }\n';
const accepted = '{"contractVersion":"0.105.0"}\n';
const update = {
	path: inventoryPath, previousSha256: "1".repeat(64), currentSha256: expected
};
const harness = async record => {
	const source = await readFile(modulePath, "utf8");
	const file = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const declaration = file.statements.filter(ts.isVariableStatement)
		.flatMap(statement => [...statement.declarationList.declarations])
		.find(item => item.name.getText(file) === "phpRecursiveTypeSurface");
	assert.ok(declaration && ts.isArrowFunction(declaration.initializer));
	const calls = [];
	let reads = 0;
	const context = {
		assert, JSON, phpRecursiveCallableHistoryPath
		, readFileSync: (path, encoding) => {
			assert.equal(path, phpRecursiveCallableHistoryPath);
			assert.equal(encoding, "utf8");
			reads++;
			return JSON.stringify(record);
		}
		, beforePhpWasmRecursiveCallables: (path, bytes, stop) => {
			calls.push({ path, bytes, stop });
			return bytes === candidate && stop === expected ? accepted : bytes;
		}
	};
	const invoke = runInNewContext("let inventorySha256; ("
		+ declaration.initializer.getText(file) + ")", context, { timeout: 1000 });
	return { invoke, calls, reads: () => reads };
};

test("PHP recursive inventory requests its recorded current endpoint before parsing", async () => {
	const control = await harness({ updates: [{ ...update, path: "unrelated.json" }, update] });
	assert.equal(control.invoke(candidate).contractVersion, "0.105.0");
	assert.deepEqual(control.calls, [{ path: inventoryPath, bytes: candidate, stop: expected }]);
	assert.equal(control.invoke(candidate).contractVersion, "0.105.0");
	assert.equal(control.reads(), 1, "Cache only the immutable endpoint metadata");
});

test("PHP recursive inventory leaves unknown raw bytes to the historical reader", async () => {
	const control = await harness({ updates: [update] });
	const unknown = '\n  {"contractVersion":"candidate"}  \n';
	assert.equal(control.invoke(unknown).contractVersion, "candidate");
	assert.deepEqual(control.calls, [{ path: inventoryPath, bytes: unknown, stop: expected }]);
});

test("PHP recursive inventory refuses missing, ambiguous or malformed endpoint metadata", async () => {
	for(const updates of [[], [update, update], [{ ...update, currentSha256: "invalid" }]])
	{
		const control = await harness({ updates });
		assert.throws(() => control.invoke(candidate), assert.AssertionError);
		assert.throws(() => control.invoke(candidate), assert.AssertionError);
		assert.deepEqual(control.calls, []);
	}
});

test("PHP recursive inventory preserves its original 3.5 MB producer snapshot", async () => {
	const record = JSON.parse(await readFile(phpRecursiveCallableHistoryPath, "utf8"));
	const endpoint = record.updates.find(item => item.path === inventoryPath).currentSha256;
	const source = sourceAtProducer("0af020b28bc69bb97f678a814b7b567eac13c559", inventoryPath, endpoint);
	assert.ok(Buffer.byteLength(source) < 4 * 1024 * 1024);
	assert.equal(sha256(source), endpoint);
	const document = phpRecursiveTypeSurface(source);
	assert.equal(document.contractVersion, record.inventory.version);
	assert.deepEqual(document, JSON.parse(source));
});
