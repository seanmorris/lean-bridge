/**
 * Bind receiver history callers to exact recorded inventory endpoints.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { bytesAtProducer } from "./producer-source.mjs";
import { sha256 } from "./source-history-digest.mjs";

const cases = [
	{
		label: "Ruby", name: "Ruby", slug: "ruby"
		, producer: "7f1a432b5cffb9a0cddfa2fef30440f9847afc39"
	}
	, {
		label: "Rust", name: "Rust", slug: "rust"
		, producer: "18324f5a302fb99238b8a503114b3f5a5294d3cd"
	}
	, {
		label: "JavaScript", name: "JavaScript", slug: "javascript"
		, producer: "3195b47fc2ef224a6b4d92501e0dadefb3b9a1f0"
	}
];

test("Core receiver history callers stop at their exact recorded predecessors", async () => {
	const violations = [];
	let calls = 0;
	for(const item of cases)
	{
		const path = `tests/owned-${item.slug}-receiver-evidence.test.mjs`;
		const source = await readFile(path, "utf8");
		const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest
			, true, ts.ScriptKind.JS);
		const visit = node => {
			if(ts.isCallExpression(node) && ts.isIdentifier(node.expression)
				&& node.expression.text === `beforeOwned${item.name}Receiver`) {
				const input = node.arguments[1]?.getText(tree);
				const prior = ts.isVariableDeclaration(node.parent)
					&& node.parent.name.getText(tree) === "prior";
				const expected = input === "current" ? "previous.sources[path]"
					: input === "prior" || (input === "source" && prior)
						? "update.previousSha256" : undefined;
				if(expected)
				{
					calls++;
					if(node.arguments.length !== 3
						|| node.arguments[2].getText(tree) !== expected)
						violations.push(path + ": " + node.getText(tree));
				}
				}
			ts.forEachChild(node, visit);
		};
		visit(tree);
	}
	assert.equal(calls, 9, "Inspect reconstruction, idempotence and inventory calls");
	assert.deepEqual(violations, []);
});

for(const item of cases)
	test("Core receiver recorded endpoint: " + item.label, async () => {
		const history = await import(`./owned-${item.slug}-receiver-history.mjs`);
		const receipt = history[`owned${item.name}ReceiverPath`];
		const bytes = await readFile(receipt);
		assert.deepEqual(bytesAtProducer(item.producer, receipt), bytes
			, "Keep the original acceptance receipt unchanged");
		const record = JSON.parse(bytes);
		const previousBytes = await readFile(record.previous.path);
		assert.equal(sha256(previousBytes), record.previous.sha256);
		const path = "docs/type-surface.v1.json";
		const update = record.updates.find(entry => entry.path === path);
		assert.ok(update);
		assert.equal(update.currentSha256, record.sources[path]);
		assert.equal(update.previousSha256, JSON.parse(previousBytes).sources[path]);
		const currentBytes = bytesAtProducer(item.producer, path, update.currentSha256);
		assert.ok(currentBytes.length < 8 * 1024 * 1024
			, "Use the small recorded snapshot, never today's full inventory");
		const current = currentBytes.toString("utf8");
		const reader = history[`beforeOwned${item.name}Receiver`];
		const reverse = history[`reverseOwned${item.name}ReceiverUpdate`];
		assert.equal(reader(path, current, update.currentSha256), current);
		const previous = reader(path, current, update.previousSha256);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(reader(path, previous, update.previousSha256), previous);
		assert.equal(reverse(current, update), previous);
		const unknown = current + "\n/* unrecorded edit */\n";
		assert.equal(reader(path, unknown, update.previousSha256), unknown);
		assert.throws(() => reverse(unknown, update));
		assert.throws(() => reverse(current, {
			...update, previousSha256: "0".repeat(64)
		}));
		assert.throws(() => reverse(current, {
			...update, edits: [...update.edits, update.edits[0]]
		}));
		assert.throws(() => reverse(current, { ...update, path: "unknown.mjs" }));
		const expected = JSON.parse(previous);
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
			, "Receiver staging changes only source pins, not support cells");
	});
