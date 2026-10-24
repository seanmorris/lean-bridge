/**
 * Bind structured source history to exact endpoints and preserve unknown bytes.
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
		slug: "c", name: "C", next: "cpp", nextName: "Cpp"
		, producer: "9e6eb510535a6907c37d63f89ecbe0ac66927c32", date: "20260924"
	}
	, {
		slug: "cpp", name: "Cpp", next: "rust", nextName: "Rust"
		, producer: "646aceda428705779adc34a2b96a0c0dcd7356b5", date: "20260924"
	}
	, {
		slug: "rust", name: "Rust", next: "python", nextName: "Python"
		, producer: "8f17be5ad5262670b8853d96736f19333fdebe39", date: "20260924"
	}
	, {
		slug: "python", name: "Python", next: "ruby", nextName: "Ruby"
		, producer: "cbb6fecce821a9a9fef3c06ab93b9c46786c9323", date: "20260924"
	}
	, {
		slug: "ruby", name: "Ruby", next: "dotnet", nextName: "Dotnet"
		, producer: "35d11c8f9a623faaf294e2e475f82ef847f831ed", date: "20260924"
	}
	, {
		slug: "dotnet", name: "Dotnet", next: "jvm", nextName: "Jvm"
		, producer: "594287dd2e4ab9550de349f9414b3d0ecf9d0c22", date: "20260924"
	}
	, {
		slug: "jvm", name: "Jvm", next: "perl", nextName: "Perl"
		, producer: "aecdcd13d9caffed826aa79ae09af006803da650", date: "20260925"
	}
	, {
		slug: "perl", name: "Perl", next: "npm", nextName: "Npm"
		, producer: "8538d3f67b0cdfffabf35b95153a15ecd56d84f5", date: "20260925"
	}
];

test("Core structured source tests request current and predecessor identities", async () => {
	const violations = [];
	let calls = 0;
	for(const item of cases)
	{
		const path = `tests/${item.slug}-structured-callable-evidence.test.mjs`;
		const tree = ts.createSourceFile(path, await readFile(path, "utf8")
			, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		const visit = node => {
			if(ts.isCallExpression(node) && ts.isIdentifier(node.expression))
			{
				const name = node.expression.text;
				let expected;
				if(name === `before${item.nextName}StructuredCallables`)
					expected = "update.currentSha256";
				else if(name === "sourceAtProducer")
					expected = "update.currentSha256";
				else if(name === `before${item.name}StructuredCallables`
					&& node.arguments[1].getText(tree) === "source")
					expected = "update.previousSha256";
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
	assert.equal(calls, 16, "Inspect both recorded endpoints in eight language tests");
	assert.deepEqual(violations, []);
});

for(const item of cases)
	test("Core structured authenticated history: " + item.slug, async () => {
		const history = await import(`./${item.slug}-structured-callable-source-history.mjs`);
		const next = await import(`./${item.next}-structured-callable-source-history.mjs`);
		const receipt = `docs/evidence/${item.slug}-structured-callable-integration-${item.date}.json`;
		const bytes = await readFile(receipt);
		assert.deepEqual(bytesAtProducer(item.producer, receipt), bytes
			, "Preserve the original receipt");
		const record = JSON.parse(bytes);
		const previousBytes = await readFile(record.previous.path);
		assert.equal(sha256(previousBytes), record.previous.sha256);
		const update = record.updates.find(entry => entry.path === inventory);
		assert.ok(update);
		assert.equal(update.currentSha256, record.sourceHashes[inventory]);
		const currentBytes = bytesAtProducer(item.producer, inventory, update.currentSha256);
		assert.ok(currentBytes.length < 8 * 1024 * 1024
			, "Read the original small inventory, never the full current inventory");
		const current = currentBytes.toString("utf8");
		assert.equal(sha256(next[`before${item.nextName}StructuredCallables`](
			inventory, current, update.currentSha256)), update.currentSha256);
		const reader = history[`before${item.name}StructuredCallables`];
		const reverse = history[`reverse${item.name}StructuredCallableUpdate`];
		assert.equal(sha256(reader(inventory, current, update.currentSha256)), update.currentSha256);
		const prior = reader(inventory, current, update.previousSha256);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(sha256(reader(inventory, prior, update.previousSha256)), update.previousSha256);
		assert.equal(sha256(reverse(current, update)), update.previousSha256);
		const unknown = current + "\n/* unrecorded edit */\n";
		assert.equal(sha256(reader(inventory, unknown, update.previousSha256)), sha256(unknown)
			, "An unrelated suffix must not be partially normalized");
		assert.equal(sha256(reader(inventory, unknown)), sha256(unknown));
		assert.throws(() => reverse(unknown, update));
		for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unknown.mjs" }])
			assert.throws(() => reverse(current, forged));
	});
