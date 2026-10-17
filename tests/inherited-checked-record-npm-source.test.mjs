/**
 * Source-only contract for inherited checked-record npm callers and selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import "./helpers/inherited-checked-record-npm-installed-tests.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import {
	checkInheritedCheckedRecords
	, inheritedCheckedRecordConstructorRefusal
} from "./fixtures/inherited-checked-record-consumers/javascript.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	inheritedCheckedRecordNpmExpected
	, inheritedCheckedRecordNpmPositions
	, inheritedCheckedRecordNpmRoutes
	, inheritedCheckedRecordNpmSelection
} from "./helpers/inherited-checked-record-npm-fixture.mjs";

const shape = () => {
	throw new TypeError("value does not match the declared copied fields");
};
const exact = (value, keys) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)
		|| Object.getPrototypeOf(value) !== Object.prototype
		|| JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort()))
		shape();
	return value;
};
const nat = value => {
	if(typeof value !== "bigint" || value < 0n) shape();
	return value;
};
const rejected = (path, constructor) => {
	throw new TypeError(`${path} was rejected by InheritedCheckedRecords.${constructor}`);
};
const checkedSpan = (value, path, normalize) => {
	const source = exact(value, ["lo", "hi"]), lo = nat(source.lo), hi = nat(source.hi);
	if(normalize) return { lo: 0n, hi: lo + hi };
	if(lo > hi) rejected(path, "mkSpan");
	return { lo, hi };
};
const checkedTicket = (value, path, choices) => {
	const source = exact(value, ["toSpan", "word"]);
	const toSpan = checkedSpan(source.toSpan, `${path}.toSpan`, choices.span);
	const rawWord = nat(source.word);
	const word = choices.word ? rawWord + 1n
		: rawWord > 0n ? rawWord : rejected(`${path}.word`, "mkWord");
	if(choices.ticket) return { toSpan, word: toSpan.hi + 1n };
	if(toSpan.hi > word) rejected(path, "mkTicket");
	return { toSpan, word };
};
const checkedStamped = (value, path) => {
	const source = exact(value, ["toTicket", "mark"]);
	const toTicket = checkedTicket(source.toTicket, `${path}.toTicket`, {
		span: false, word: false, ticket: false
	});
	const mark = nat(source.mark);
	if(mark >= 8n) throw new TypeError(`${path}.mark must be bigint below 8`);
	if(mark > toTicket.word) rejected(path, "mkStamped");
	return { toTicket, mark };
};
const resultApi = {
	produce: value => ({ toSpan: { lo: nat(value), hi: value }, word: value + 1n })
	, produceStamped: value => ({
		toTicket: { toSpan: { lo: nat(value), hi: value }, word: value + 1n }
		, mark: 0n
	})
};
const fullApi = {
	...resultApi
	, first: value => {
		const ticket = checkedTicket(value, "first.arg0", {
			span: false, word: false, ticket: false
		});
		return ticket.toSpan.lo + ticket.toSpan.hi + ticket.word;
	}
	, normalized: value => {
		const ticket = checkedTicket(value, "normalized.arg0", {
			span: true, word: true, ticket: true
		});
		return ticket.toSpan.lo + ticket.toSpan.hi + ticket.word;
	}
	, pair: (left, right) => checkedTicket(left, "pair.arg0", {
		span: false, word: false, ticket: false
	}).word + checkedTicket(right, "pair.arg1", {
		span: true, word: true, ticket: true
	}).word
	, aliased: value => checkedTicket(value, "aliased.arg0", {
		span: true, word: true, ticket: false
	}).word
	, nested: value => {
		const stamped = checkedStamped(value, "nested.arg0");
		return stamped.toTicket.word + stamped.mark;
	}
	, echo: value => checkedTicket(value, "echo.arg0", {
		span: false, word: true, ticket: true
	})
};

test("inherited checked-record npm selections retain both author routes and API modes"
	, async () => {
	assert.deepEqual(inheritedCheckedRecordNpmRoutes, [
		"ordinary-full", "ordinary-result-only"
		, "reviewed-full", "reviewed-result-only"
	]);
	for(const route of inheritedCheckedRecordNpmRoutes)
	{
		const selection = inheritedCheckedRecordNpmSelection(route);
		validateExportConfiguration(selection.configuration);
		validateBindingIr(selection.expected);
		await assertJsonSchema("lean-export-configuration", selection.configuration);
		assert.deepEqual(Object.keys(selection.configuration.targets), ["npm"]);
		assert.equal(selection.configuration.exports === undefined, selection.reviewed);
		assert.equal(selection.expected.declarations.length
			, selection.resultOnly ? 2 : 8);
		assert.deepEqual(inheritedCheckedRecordNpmPositions[selection.mode]
			, selection.resultOnly
				? ["produce.result", "produceStamped.result"]
				: ["first.arg0", "normalized.arg0", "pair.arg0", "pair.arg1"
					, "aliased.arg0", "nested.arg0", "echo.arg0", "echo.result"
					, "produce.result", "produceStamped.result"]);
	}
	assert.throws(() => inheritedCheckedRecordNpmSelection("unknown"));
	}
);

test("the independent npm caller fixes full and result-only behavior and counts", () => {
	for(const route of inheritedCheckedRecordNpmRoutes)
	{
		const selection = inheritedCheckedRecordNpmSelection(route);
		assert.deepEqual(checkInheritedCheckedRecords(
			selection.resultOnly ? resultApi : fullApi
			, { resultOnly: selection.resultOnly }
		), inheritedCheckedRecordNpmExpected(route));
	}
});

test("the npm caller accepts only exact ordinary and reviewed diagnostics", () => {
	for(const [name, suffix, constructor, parameter = 0] of [
		["first", ".toSpan", "mkSpan"], ["first", ".word", "mkWord"]
		, ["first", "", "mkTicket"], ["pair", ".toSpan", "mkSpan"]
		, ["pair", "", "mkTicket"], ["nested", "", "mkStamped"]
		, ["aliased", "", "mkTicket"]
	]) {
		const pattern = inheritedCheckedRecordConstructorRefusal(
			name, suffix, constructor, parameter
		);
		for(const root of ["arg", "value"])
			assert.match(`${name}.${root}${parameter}${suffix} was rejected by InheritedCheckedRecords.${constructor}`
				, pattern);
		assert.doesNotMatch(`${name}.arg${parameter + 1}${suffix} was rejected by InheritedCheckedRecords.${constructor}`
			, pattern);
	}
});

test("strict TypeScript callers compile against both generated npm surfaces", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-inherited-npm-types-"));
	t.after(() => rm(root, { recursive: true }));
	for(const mode of ["full", "result-only"])
	{
		const directory = join(root, mode);
		const module = join(directory, "node_modules/inheritedcheckedrecords");
		const selection = inheritedCheckedRecordNpmSelection(`ordinary-${mode}`);
		const generated = generateJavaScriptPackage(selection.expected);
		await saveLakeFile(module, "index.d.ts", generated["index.d.ts"]);
		await saveLakeFile(module, "package.json", JSON.stringify({
			name: "inheritedcheckedrecords", version: "1.0.0", type: "module"
			, types: "./index.d.ts"
		}));
		await saveLakeFile(directory, "index.mts", await readFile(
			`tests/fixtures/inherited-checked-record-consumers/${mode}.mts`
		));
		const compiled = await runCopied(process.execPath, [
			join(process.cwd(), "node_modules/typescript/lib/tsc.js")
			, "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022"
			, "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext"
			, "--moduleResolution", "NodeNext", "index.mts"
		], directory);
		assert.deepEqual(compiled, { code: 0, stdout: "", stderr: "" });
	}
});
