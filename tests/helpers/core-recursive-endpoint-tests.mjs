/**
 * Authenticate recursive history stops against the original small inventories.
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
		label: "Ruby", slug: "ruby-recursive-callable"
		, producer: "7cf6ee0bf049502eb9b581c8cc6efb88dc9aeddc"
		, next: "perl-recursive-callable-source-history"
		, reader: "beforePerlRecursiveCallables"
		, ownReader: "beforeRubyRecursiveCallables"
		, reverse: "reverseRubyRecursiveCallableUpdate"
	}
	, {
		label: "Rust", slug: "rust-recursive-callable"
		, producer: "8dcaf9b69beb73b756743e36c075f58c2bc82f86"
		, next: "ruby-recursive-callable-source-history"
		, reader: "beforeRubyRecursiveCallables"
		, ownReader: "beforeRustRecursiveCallables"
		, reverse: "reverseRustRecursiveCallableUpdate"
	}
	, {
		label: "Python", slug: "python-recursive-callable"
		, producer: "172baa67067a549454fb79449d205f939474e58b"
		, next: "rust-recursive-callable-source-history"
		, reader: "beforeRustRecursiveCallables"
		, ownReader: "beforePythonRecursiveCallables"
		, reverse: "reversePythonRecursiveCallableUpdate"
	}
	, {
		label: "C/C++", slug: "native-recursive-callable"
		, producer: "2273d357fc959cf88bf7b0e1aea70e908ba1ba4d"
		, next: "closure-thread-source-history"
		, reader: "beforeClosureThreadLifetime"
		, ownReader: "beforeNativeRecursiveCallables"
		, reverse: "reverseNativeRecursiveCallableUpdate"
	}
];

const stopDigestViolations = (path, source, reader) => {
	const tree = ts.createSourceFile(path, source
		, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const violations = [];
	const enclosingArrow = node => {
		for(let current = node.parent; current; current = current.parent)
			if(ts.isArrowFunction(current)) return current;
	};
	let calls = 0;
	const visit = node => {
		const tracked = ts.isCallExpression(node) && ts.isIdentifier(node.expression)
			&& [reader, "priorSource"].includes(node.expression.text);
		if(tracked)
		{
			calls++;
			const wrapper = node.expression.text === reader;
			if(wrapper)
			{
				const arrow = enclosingArrow(node);
				assert.ok(arrow);
				if(JSON.stringify(arrow.parameters.map(p => p.name.getText(tree)))
					!== JSON.stringify(["path", "expected"]))
					violations.push("Wrapper must accept the expected digest");
			}
			const path = node.arguments[0].getText(tree);
			const expected = wrapper ? "expected" : path === "path"
				? "record.sourceHashes[path]" : path === "update.path"
					? "update.currentSha256"
					: path === JSON.stringify(inventory) ? `record.sourceHashes[${JSON.stringify(inventory)}]` : undefined;
			assert.ok(expected, "Unexpected historical source call: " + node.getText(tree));
			const index = wrapper ? 2 : 1;
			if(node.arguments.length !== index + 1
				|| node.arguments[index].getText(tree) !== expected)
				violations.push(node.getText(tree));
		}
		ts.forEachChild(node, visit);
	};
	visit(tree);
	assert.equal(calls, 4, "One wrapper and three independently authenticated source reads");
	return violations;
};

test("Core recursive source callers preserve each recorded stop digest", async () => {
	for(const item of cases)
	{
		const path = `tests/helpers/${item.slug}-evidence.mjs`;
		const source = await readFile(path, "utf8");
		assert.deepEqual(stopDigestViolations(path, source, item.reader), [], path);
		for(const [before, after] of [
			["async (path, expected)", "async path"]
			, [`${item.reader}(path, source, expected)`
				, `${item.reader}(path, source)`]
			, ["priorSource(path, record.sourceHashes[path])", "priorSource(path)"]
			, ["priorSource(update.path, update.currentSha256)", "priorSource(update.path)"]
			, [`priorSource("${inventory}", record.sourceHashes["${inventory}"])`
				, `priorSource("${inventory}")`]
		]) {
			assert.equal(source.split(before).length, 2, before);
			assert.ok(stopDigestViolations(path, source.replace(before, after), item.reader).length > 0);
		}
	}
});

for(const item of cases)
	test("Core recursive exact historical endpoint: " + item.label, async () => {
		const receipt = `docs/evidence/${item.slug}-integration-20260925.json`;
		const bytes = await readFile(receipt);
		assert.deepEqual(bytesAtProducer(item.producer, receipt), bytes
			, "The original receipt must remain unchanged");
		const record = JSON.parse(bytes);
		const previous = await readFile(record.previous.path);
		assert.equal(sha256(previous), record.previous.sha256);
		const update = record.updates.find(entry => entry.path === inventory);
		assert.ok(update);
		assert.equal(update.currentSha256, record.sourceHashes[inventory]);
		assert.equal(update.previousSha256, JSON.parse(previous).sourceHashes[inventory]);
		const sourceBytes = bytesAtProducer(item.producer, inventory, update.currentSha256);
		assert.ok(sourceBytes.length < 4 * 1024 * 1024);
		const source = sourceBytes.toString("utf8");
		const next = await import("./" + item.next + ".mjs");
		const own = await import("./" + item.slug + "-source-history.mjs");
		const reader = own[item.ownReader], reverse = own[item.reverse];
		assert.equal(sha256(next[item.reader](inventory, source))
			, "f8e255a8b7787aaa41c586ad5965068e1701e06887074113de680b71aeb0c72e"
			, "Reproduce the original unbounded history traversal");
		assert.notEqual(sha256(next[item.reader](inventory, source)), update.currentSha256);
		assert.equal(next[item.reader](inventory, source, update.currentSha256), source);
		assert.equal(reader(inventory, source, update.currentSha256), source);
		const prior = reader(inventory, source, update.previousSha256);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(reader(inventory, prior, update.previousSha256), prior);
		assert.equal(reverse(source, update), prior);
		const unknown = source + "\nunknown edit\n";
		assert.equal(reader(inventory, unknown, update.previousSha256), unknown);
		for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, edits: [] }, { ...update, path: "unknown.mjs" }])
			assert.throws(() => reverse(source, forged));
		assert.throws(() => reverse(unknown, update));
	});
