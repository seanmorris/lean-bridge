/**
 * Check the rolling history pipeline without loading any inventory or ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { sha256 } from "../../src/capsule/node.mjs";
import { sourceAtProducer } from "./producer-source.mjs";

const path = "tests/helpers/fin-refinement-source-history.mjs";
const baseline = sourceAtProducer("21d0dfc7f0e487ca6937d450eed5b33198b00366", path);
const repaired = sourceAtProducer("9ce78fcac3dfff304fae9b284c2259a9b3a3c7be", path);
const kept = new Set(["text", "input", "previous"]);
const visit = (node, accept) => { accept(node); ts.forEachChild(node, child => visit(child, accept)); };
const parse = text => {
	const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	let fn;
	visit(file, node => {
		if(ts.isVariableDeclaration(node) && node.name.getText(file) === "beforeFinRefinementSource")
			fn = node.initializer;
	});
	assert.ok(fn && ts.isArrowFunction(fn));
	const stages = fn.body.statements.filter(ts.isVariableStatement)
		.flatMap(statement => statement.declarationList.declarations.map(declaration => ({ statement, declaration })))
		.filter(({ declaration }) => !kept.has(declaration.name.getText(file)));
	return { file, fn, stages };
};

test("rolling history changes only dead stage bindings and impossible stop checks", () => {
	const { file, fn, stages } = parse(baseline);
	const edits = [], names = new Set(stages.map(({ declaration }) => declaration.name.getText(file)));
	assert.equal(names.size, 288);
	for(const [index, { statement, declaration }] of stages.entries())
	{
		const name = declaration.name.getText(file), next = stages[index + 1];
		assert.equal(statement.declarationList.declarations.length, 1);
		edits.push({ start: statement.getStart(file), end: declaration.name.end
			, text: index === 0 ? "let stage" : "stage" });
		visit(fn.body, node => {
			if(!ts.isIdentifier(node) || node.text !== name || node === declaration.name) return;
			for(let parent = node.parent; parent !== fn; parent = parent.parent)
				assert.ok(!ts.isFunctionLike(parent), `${name} is captured`);
			if(next) assert.ok(node.getStart(file) < next.statement.getStart(file)
				|| (node.getStart(file) >= next.declaration.initializer.getStart(file)
					&& node.end <= next.declaration.initializer.end), `${name} remains live`);
			edits.push({ start: node.getStart(file), end: node.end, text: "stage" });
		});
	}
	let guards = 0;
	for(const statement of fn.body.statements)
	{
		if(!ts.isIfStatement(statement)) continue;
		const condition = statement.expression;
		if(!ts.isBinaryExpression(condition) || condition.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken
			|| condition.right.getText(file) !== "expected" || !ts.isCallExpression(condition.left)
			|| condition.left.expression.getText(file) !== "sha256"
			|| condition.left.arguments.length !== 1 || !names.has(condition.left.arguments[0].getText(file))) continue;
		edits.push({ start: condition.getStart(file), end: condition.getStart(file), text: "expected !== undefined && " });
		guards++;
	}
	assert.equal(guards, 282);
	let expected = baseline;
	for(const edit of edits.sort((a, b) => b.start - a.start || b.end - a.end))
		expected = expected.slice(0, edit.start) + edit.text + expected.slice(edit.end);
	assert.equal(repaired, expected, "all other bytes, calls, branches and loops must be unchanged");
});

const inventoryPath = "docs/type-surface.v1.json";
const harness = text => {
	const { file, fn } = parse(text), names = new Set();
	visit(fn, node => {
		if(ts.isCallExpression(node) && ts.isIdentifier(node.expression)) names.add(node.expression.text);
	});
	let state;
	const context = {
		finRefinementNormalizationPaths: ["tracked", inventoryPath]
		, typeSurfacePath: inventoryPath
		, sha256: value => { state.hashes++; state.hashInputs.push(value); return sha256(value); }
	};
	for(const [index, name] of [...names].entries())
	{
		if(["sha256", "beforeFinRefinementSource"].includes(name)) continue;
		context[name] = (...arguments_) => {
			const position = name === "normalizeExactTypeSurfaceHistory" ? 0 : 1;
			const source = arguments_[position], expected = arguments_[position + 1];
			state.calls.push({ name, source, expected });
			assert.ok(state.calls.length < 5000, "synthetic history must terminate");
			if(name === state.fail) throw new Error(`refused ${name}`);
			const used = state.used.get(name) ?? 0;
			state.used.set(name, used + 1);
			const limit = name === "normalizeExactTypeSurfaceHistory" ? state.planner : state.iterations;
			const result = used < limit ? `${source}|${index}.${used}` : source;
			if(result !== source) state.outputs.push(result);
			return result;
		};
	}
	context.beforeFinRefinementSource = runInNewContext(`"use strict"; (${fn.getText(file)})`, context, { timeout: 1000 });
	return (options = {}) => {
		state = { calls: [], outputs: [], hashInputs: [], hashes: 0, used: new Map(), iterations: 1, planner: 0, ...options };
		try
		{
			state.value = context.beforeFinRefinementSource(options.path ?? "tracked", options.source ?? "seed", options.expected);
		}
		catch(error)
		{ state.error = error.message; }
		return state;
	};
};
const original = harness(baseline), rolling = harness(repaired);
const sameExecution = options => {
	const before = original(options), after = rolling(options);
	assert.equal(after.value, before.value);
	assert.equal(after.error, before.error);
	assert.deepEqual(after.calls, before.calls);
	assert.deepEqual(after.outputs, before.outputs);
	return { before, after };
};

test("rolling history preserves all reachable stop points and full ordered traces", () => {
	const { before, after } = sameExecution({ iterations: 2 });
	assert.equal(before.error, undefined);
	assert.ok(before.outputs.length > 300);
	assert.ok(before.hashes - after.hashes >= 282, "stop-less stages must not hash the full source");
	for(const output of new Set(before.hashInputs))
	{
		const result = sameExecution({ iterations: 2, expected: sha256(output) });
		assert.equal(result.after.value, output);
		assert.equal(result.after.error, undefined);
	}
});

test("rolling history keeps planner handoffs, recursive settling and failures", () => {
	for(const options of [
		{ path: inventoryPath, planner: 1 }
		, { path: inventoryPath, planner: 1, expected: "unreachable" }
		, { expected: "unreachable", iterations: 2 }
	]) assert.equal(sameExecution(options).after.error, undefined);
	const calls = original().calls;
	for(const index of [0, Math.floor(calls.length / 2), calls.length - 1])
	{
		const fail = calls[index].name;
		assert.equal(sameExecution({ fail }).after.error, `refused ${fail}`);
	}
});

test("rolling history preserves unknown and unchanged buffer identity", () => {
	for(const source of [Buffer.from("seed"), Buffer.from([255, 254, 0, 128])])
		for(const options of [
			{ path: "unknown", source }
			, { source, iterations: 0 }
			, { source, expected: sha256(source.toString()) }
			, { source, iterations: 0, expected: "unreachable" }
		]) assert.equal(sameExecution(options).after.value, source);
});

test("the live history hub retains only one top-level stage binding", async () => {
	const { stages, file } = parse(await readFile(path, "utf8"));
	assert.deepEqual(stages.map(({ declaration }) => declaration.name.getText(file)), ["stage"]);
});
