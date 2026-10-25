/**
 * Bind the historical PHP and closure receipts to their exact producer bytes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { bytesAtProducer, typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import { historicalTypeSurfaceCells } from "./historical-type-surface-cells.mjs";
import { sha256 } from "./source-history-digest.mjs";

const cases = [
	{
		label: "PHP CI", producer: "53ccb05a9ad93cebf37c17a5b4ea2415275ee287"
		, file: "tests/helpers/php-ci-regression-evidence.mjs"
		, module: "./php-ci-regression-evidence.mjs"
		, reader: "phpCiProducerSource"
		, receipt: "docs/evidence/php-ci-regression-integration-20260925.json"
		, history: "./php-ci-regression-source-history.mjs"
		, reverse: "reversePhpCiUpdate"
	}
	, {
		label: "closure thread", producer: "f61063252acf464ba4306885ddbf141b29bbdf73"
		, file: "tests/helpers/closure-thread-evidence.mjs"
		, module: "./closure-thread-evidence.mjs"
		, reader: "closureThreadProducerSource"
		, receipt: "docs/evidence/closure-thread-lifetime-integration-20260925.json"
		, history: "./closure-thread-source-history.mjs"
		, reverse: "reverseClosureThreadUpdate"
	}
];

test("PHP and closure history callers require exact source identities", async () => {
	const violations = [];
	let calls = 0;
	for(const item of cases)
	{
		const source = await readFile(item.file, "utf8");
		const tree = ts.createSourceFile(item.file, source, ts.ScriptTarget.Latest
			, true, ts.ScriptKind.JS);
		const visit = node => {
			if(ts.isCallExpression(node) && ts.isIdentifier(node.expression)
				&& node.expression.text === "priorSource") {
				calls++;
				if(node.arguments.length !== 2)
					violations.push(item.file + ": " + node.getText(tree));
				}
			ts.forEachChild(node, visit);
		};
		visit(tree);
		assert.equal(/\breadTypeSurface\b/u.test(source), false
			, "Receipt verifiers must use their producer's independent contracts");
	}
	assert.ok(calls >= 10);
	assert.deepEqual(violations, []);
});

for(const item of cases)
{
	test(item.label + " authenticates every original source at its producer", async () => {
		const bytes = await readFile(item.receipt);
		assert.deepEqual(bytesAtProducer(item.producer, item.receipt), bytes);
		const record = JSON.parse(bytes);
		const reader = (await import(item.module))[item.reader];
		assert.equal(typeof reader, "function");
		assert.ok(Object.keys(record.sourceHashes).length > 600);
		for(const [path, expected] of Object.entries(record.sourceHashes))
		{
			const source = reader(path, expected);
			assert.equal(sha256(source), expected, path);
			assert.equal(source, bytesAtProducer(item.producer, path).toString("utf8"));
		}
		for(const expected of [undefined, "", "0".repeat(64)])
			assert.throws(() => reader("docs/type-surface.v1.json", expected));
		assert.throws(() => reader("../package.json", "0".repeat(64)));
	});

	test(item.label + " preserves both endpoints and rejects altered transitions", async () => {
		const record = JSON.parse(await readFile(item.receipt, "utf8"));
		const reader = (await import(item.module))[item.reader];
		assert.equal(typeof reader, "function");
		const history = await import(item.history);
		for(const update of record.updates)
		{
			const source = reader(update.path, update.currentSha256);
			const previous = history[item.reverse](source, update);
			assert.equal(sha256(previous), update.previousSha256);
			assert.equal(previous, bytesAtProducer(record.baselineRevision
				, update.path, update.previousSha256).toString("utf8"));
			const altered = source + "\n/* unrelated */\n";
			assert.throws(() => history[item.reverse](altered, update));
			assert.throws(() => history[item.reverse](source
				, { ...update, previousSha256: "0".repeat(64) }));
		}
		const path = "docs/type-surface.v1.json";
		const current = JSON.parse(reader(path, record.sourceHashes[path]));
		const previous = JSON.parse(bytesAtProducer(record.baselineRevision, path));
		const contracts = typeSurfaceContractsAtProducer(item.producer);
		const cells = historicalTypeSurfaceCells(current, contracts);
		assert.deepEqual(cells, historicalTypeSurfaceCells(previous, contracts));
		assert.equal(cells.length, 6562);
		assert.equal(cells.filter(cell =>
			cell.stages.installedExecution.state === "passed").length, 4790);
	});
}
