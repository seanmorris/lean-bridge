/**
 * Pin Perl and consumer-CI history reads to their recorded endpoints.
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
		label: "Perl structured", slug: "perl-structured-callable"
		, producer: "8538d3f67b0cdfffabf35b95153a15ecd56d84f5"
		, receipt: "docs/evidence/perl-structured-callable-integration-20260925.json"
		, history: "perl-structured-callable-source-history"
		, next: "npm-structured-callable-source-history"
		, reader: "beforeNpmStructuredCallables"
		, ownReader: "beforePerlStructuredCallables"
		, reverse: "reversePerlStructuredCallableUpdate", sources: "sourceHashes"
	}
	, {
		label: "Perl recursive", slug: "perl-recursive-callable"
		, producer: "a8a255329c102155add79169d71a05246190b8fd"
		, receipt: "docs/evidence/perl-recursive-callable-integration-20260925.json"
		, history: "perl-recursive-callable-source-history"
		, next: "dotnet-recursive-callable-source-history"
		, reader: "beforeDotnetRecursiveCallables"
		, ownReader: "beforePerlRecursiveCallables"
		, reverse: "reversePerlRecursiveCallableUpdate", sources: "sourceHashes"
	}
	, {
		label: "Owned consumer CI"
		, producer: "008b0ae88d43beaa82c27b60d8ab65c8755a602a"
		, receipt: "docs/evidence/owned-consumer-ci-repair-20260929.json"
		, history: "owned-consumer-ci-repair-history"
		, next: "owned-python-transfer-history"
		, reader: "beforeOwnedPythonTransfer"
		, ownReader: "beforeOwnedConsumerCi"
		, reverse: "reverseOwnedConsumerCiUpdate", sources: "sources"
	}
];

test("Core Perl and consumer history callers supply exact stop digests", async () => {
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
	for(const item of cases.filter(entry => entry.slug))
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
			assert.equal(path, JSON.stringify(inventory));
			return `record.sourceHashes[${JSON.stringify(inventory)}]`;
		});
	await inspect("tests/owned-consumer-ci-repair.test.mjs", (node, tree) => {
		const name = node.expression.text;
		if(!["beforeOwnedPythonTransfer", "beforeOwnedConsumerCi"
			, "ownedPythonTransferHistoricalBytes"].includes(name)) return;
		const path = node.arguments[0].getText(tree);
		const input = node.arguments[1].getText(tree);
		if(name === "ownedPythonTransferHistoricalBytes")
			return path === "path" ? "digest" : "record.sources[file.path] ?? file.sha256";
		if(name === "beforeOwnedPythonTransfer")
			return path === "update.path" ? "update.currentSha256"
				: `record.sources[${JSON.stringify(inventory)}]`;
		if(input === "unknown") return;
		if(path === JSON.stringify(inventory))
			return `previous.sources[${JSON.stringify(inventory)}]`;
		const prior = ts.isVariableDeclaration(node.parent)
			&& node.parent.name.getText(tree) === "prior";
		return prior || input === "prior" ? "update.previousSha256" : "update.currentSha256";
	});
	assert.equal(calls, 17, "Inspect both wrappers, six wrapper calls and nine consumer reads");
	assert.deepEqual(violations, []);
});

for(const item of cases)
	test("Core Perl/consumer recorded endpoint: " + item.label, async () => {
		const history = await import(`./${item.history}.mjs`);
		const next = await import(`./${item.next}.mjs`);
		const bytes = await readFile(item.receipt);
		assert.deepEqual(bytesAtProducer(item.producer, item.receipt), bytes
			, "Do not rewrite the original receipt");
		const record = JSON.parse(bytes);
		const previousBytes = await readFile(record.previous.path);
		assert.equal(sha256(previousBytes), record.previous.sha256);
		const previousRecord = JSON.parse(previousBytes);
		const update = record.updates.find(entry => entry.path === inventory);
		assert.ok(update);
		assert.equal(update.currentSha256, record[item.sources][inventory]);
		assert.equal(update.previousSha256, previousRecord[item.sources][inventory]);
		const currentBytes = bytesAtProducer(item.producer, inventory, update.currentSha256);
		assert.ok(currentBytes.length < 8 * 1024 * 1024
			, "Use the original small inventory, not the live inventory");
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
		if(item.slug) return;
		const expected = JSON.parse(prior);
		const updates = new Map(record.updates.map(entry => [entry.path, entry]));
		let changedPins = 0;
		for(const evidence of expected.evidence) for(const file of evidence.files)
		{
			const change = updates.get(file.path);
			if(change)
			{
				assert.equal(file.sha256, change.previousSha256);
				file.sha256 = change.currentSha256;
				changedPins++;
			}
		}
		assert.ok(changedPins > 0);
		assert.deepEqual(JSON.parse(current), expected
			, "Consumer CI repair changes source pins without changing support");
	});
