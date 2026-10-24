/**
 * Bind the structured callback acceptance chain to exact recorded endpoints.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { bytesAtProducer } from "./producer-source.mjs";
import { sha256 } from "./source-history-digest.mjs";

const inventory = "docs/type-surface.v1.json";
const cases = [
	{
		label: "npm", slug: "npm-structured-callable"
		, producer: "073ccdf8eb399e419bdafd233f40d9c55273ebb0"
		, test: "component-structured-callable-evidence"
		, next: "php-structured-callable-source-history"
		, reader: "beforePhpStructuredCallables"
		, ownReader: "beforeNpmStructuredCallables"
		, reverse: "reverseNpmStructuredCallableUpdate"
	}
	, {
		label: "native PHP", slug: "php-structured-callable"
		, producer: "89c43a33eb639bc8a2ca19df697ba56e9cfacae9"
		, test: "php-structured-callable-evidence"
		, next: "php-wasm-structured-callable-source-history"
		, reader: "beforePhpWasmStructuredCallables"
		, ownReader: "beforePhpStructuredCallables"
		, reverse: "reversePhpStructuredCallableUpdate"
	}
	, {
		label: "PHP-Wasm", slug: "php-wasm-structured-callable"
		, producer: "7294b0cc57153e53e118789ed83a300d43236f18"
		, test: "php-wasm-structured-callable-evidence"
		, next: "wit-structured-callable-source-history"
		, reader: "beforeWitStructuredCallables"
		, ownReader: "beforePhpWasmStructuredCallables"
		, reverse: "reversePhpWasmStructuredCallableUpdate"
	}
	, {
		label: "WIT", slug: "wit-structured-callable"
		, producer: "136e4942ed32bd923cb721eb80aa038cfaa07f74"
		, test: "wit-structured-callable-evidence"
		, next: "native-recursive-callable-source-history"
		, reader: "beforeNativeRecursiveCallables"
		, ownReader: "beforeWitStructuredCallables"
		, reverse: "reverseWitStructuredCallableUpdate"
	}
];

test("Core structured callback chain supplies every exact source stop", async () => {
	const violations = [];
	let calls = 0;
	const inspect = async (path, expectedFor) => {
		const tree = ts.createSourceFile(path, await readFile(path, "utf8")
			, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		const visit = node => {
			if(ts.isCallExpression(node) && ts.isIdentifier(node.expression))
			{
				const expected = expectedFor(node, tree);
				if(expected)
				{
					calls++;
					const index = node.expression.text === "priorSource" ? 1 : 2;
					if(node.arguments.length !== index + 1
						|| node.arguments[index].getText(tree) !== expected)
						violations.push(path + ": " + node.getText(tree));
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(tree);
	};
	for(const item of cases)
	{
		await inspect(`tests/helpers/${item.slug}-evidence.mjs`, (node, tree) => {
			if(node.expression.text === item.reader)
			{
				assert.ok(ts.isArrowFunction(node.parent));
				const parameters = node.parent.parameters.map(p => p.name.getText(tree));
				if(JSON.stringify(parameters) !== JSON.stringify(["path", "expected"]))
					violations.push(item.label + ": wrapper must accept the stop digest");
				return "expected";
			}
			if(node.expression.text !== "priorSource") return;
			const path = node.arguments[0].getText(tree);
			if(path === "path") return "record.sourceHashes[path]";
			if(path === "update.path") return "update.currentSha256";
			if(path === '"tests/fixtures/structured-callable-consumers/php-faults.php"')
				return "record.report.reports[0].faults.sourceSha256";
			assert.equal(path, JSON.stringify(inventory));
			return `record.sourceHashes[${JSON.stringify(inventory)}]`;
		});
		await inspect(`tests/${item.test}.test.mjs`, (node, tree) => {
			if(node.expression.text === item.reader) return "update.currentSha256";
			if(node.expression.text !== item.ownReader) return;
			const input = node.arguments[1].getText(tree);
			if(["altered", "changed"].includes(input)) return;
			assert.equal(input, "source");
			return "update.previousSha256";
		});
	}
	assert.equal(calls, 25, "Inspect four wrappers, thirteen source reads and eight history test stops");
	assert.deepEqual(violations, []);
});

for(const item of cases)
	test("Core structured callback recorded endpoint: " + item.label, async () => {
		const history = await import(`./${item.slug}-source-history.mjs`);
		const next = await import(`./${item.next}.mjs`);
		const receipt = `docs/evidence/${item.slug}-integration-20260925.json`;
		const bytes = await readFile(receipt);
		assert.deepEqual(bytesAtProducer(item.producer, receipt), bytes
			, "Preserve the original receipt");
		const record = JSON.parse(bytes);
		const previousBytes = await readFile(record.previous.path);
		assert.equal(sha256(previousBytes), record.previous.sha256);
		const previousRecord = JSON.parse(previousBytes);
		const update = record.updates.find(entry => entry.path === inventory);
		assert.ok(update);
		assert.equal(update.currentSha256, record.sourceHashes[inventory]);
		assert.equal(update.previousSha256, previousRecord.sourceHashes[inventory]);
		const currentBytes = bytesAtProducer(item.producer, inventory, update.currentSha256);
		assert.ok(currentBytes.length < 8 * 1024 * 1024
			, "Read the original small inventory, never the full current inventory");
		const current = currentBytes.toString("utf8");
		assert.equal(sha256(next[item.reader](inventory, current, update.currentSha256)), update.currentSha256);
		const reader = history[item.ownReader], reverse = history[item.reverse];
		assert.equal(sha256(reader(inventory, current, update.currentSha256)), update.currentSha256);
		const prior = reader(inventory, current, update.previousSha256);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(sha256(reader(inventory, prior, update.previousSha256)), update.previousSha256);
		assert.equal(sha256(reverse(current, update)), update.previousSha256);
		const unknown = current + "\n/* unrecorded edit */\n";
		assert.equal(sha256(reader(inventory, unknown, update.previousSha256)), sha256(unknown));
		assert.throws(() => reverse(unknown, update));
		for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unknown.mjs" }])
			assert.throws(() => reverse(current, forged));
	});
