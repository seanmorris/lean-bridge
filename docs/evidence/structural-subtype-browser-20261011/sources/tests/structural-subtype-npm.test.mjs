/**
 * Independent npm caller controls and strict declarations for structural Subtypes.
 * Mock execution and generated declarations are not installed Wasm acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { structuralSubtypeReview } from "./helpers/structural-subtype-installed-fixture.mjs";
import { checkStructuralSubtypes, structuralValueSnapshot } from "./fixtures/structural-subtype-consumers/javascript.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { structuralSubtypeNpmPackageName } from "./helpers/structural-subtype-npm-package.mjs";
import "./helpers/structural-subtype-browser-tests.mjs";

test("structural snapshots distinguish host types, holes, absent properties and complete text", () => {
	const pairs = [
		[123n, "123n"], [123n, 123], [255, "255"], [0, -0]
		, [NaN, null], [Infinity, null], [undefined, null], [false, 0]
		, [[undefined], [null]], [Array(1), [undefined]], [[], {}]
		, [{}, { value: undefined }], [{ value: 1n }, { value: "1n" }]
		, ["héllo\0tail🙂", "héllo\0changed🙂"], ["héllo\0tail🙂", "hello\0tail🙂"]
		, ["\uD800", "\uFFFD"], [{ tag: "some", value: 1n }, { tag: "none" }]
		, [Object.assign(Object.create(null), { value: 1n }), { value: 1n }]
	];
	for(const [left, right] of pairs) assert.notEqual(structuralValueSnapshot(left), structuralValueSnapshot(right));
	const shared = { tag: "none" };
	assert.equal(structuralValueSnapshot([shared, shared]), structuralValueSnapshot([{ tag: "none" }, { tag: "none" }]));
	assert.equal(structuralValueSnapshot({ b: 2n, a: 1n }), structuralValueSnapshot({ a: 1n, b: 2n }));
	let invoked = false;
	const getter = { /** Fail if snapshotting executes an input getter. */ get value() { invoked = true; return 1n; } };
	const serializable = { /** Fail if snapshotting executes custom serialization. */ toJSON() { invoked = true; return "1n"; } };
	const cycle = {}; cycle.self = cycle;
	for(const value of [getter, serializable, cycle, new Date(), { [Symbol("hidden")]: 1 }])
		assert.throws(() => structuralValueSnapshot(value), /snapshot/iu);
	assert.equal(invoked, false);
});

test("npm installed-tree names come from archive manifests authenticated against receipt package identities", () => {
	for(const name of ["structuralsubtypes", "@lean-bridge/runtime"])
	{
		const entry = { package: `${name}@1.0.0`, archive: "release.tgz", sha256: "0".repeat(64) };
		const manifest = { name, version: "1.0.0" };
		assert.equal(structuralSubtypeNpmPackageName(entry, manifest, name), name);
		assert.throws(() => structuralSubtypeNpmPackageName(entry, { ...manifest, name: "different" }, name));
		assert.throws(() => structuralSubtypeNpmPackageName(entry, { ...manifest, version: "2.0.0" }, name));
		assert.throws(() => structuralSubtypeNpmPackageName(entry, { version: "1.0.0" }, name));
		assert.throws(() => structuralSubtypeNpmPackageName(entry, { name }, name));
		assert.throws(() => structuralSubtypeNpmPackageName({ name }, manifest, name));
	}
});

const failure = () => { throw new Error("Component recursive call failed (5)"); };
const positive = value => value > 0n ? value : failure();
const option = (value, make) => value.tag === "none" ? { tag: "none" } : { tag: "some", value: make(value.value) };
const group = (values, normalize = false) => values.map(value => option(value, n => positive(n) + (normalize ? 1n : 0n)));
const mockedApi = () => ({
	scalar: positive
	, arrays: values => values.map(positive)
	, lists: values => values.map(positive)
	, specialized: values => values.map(positive)
	, options: value => option(value, positive)
	, product: ([value, text]) => [positive(value), text.length ? text : failure()]
	, branch: value => Object.hasOwn(value, "ok") ? { ok: positive(value.ok) } : { error: value.error.length ? value.error : failure() }
	, byteBranches: values => values.map(value => option(value, ([byte, nat]) => [byte ? byte : failure(), positive(nat)]))
	, nested: values => {
		const leaves = values.flat().filter(value => value.tag === "some").map(value => value.value);
		if(leaves.some(([, fin]) => fin >= 184467440737095516170n)) throw new Error("nested.arg0[2][0].value[1] must be bigint below 184467440737095516170");
		leaves.forEach(([value]) => positive(value));
		return BigInt(values.length);
	}
	, aliasPair: ([left, right]) => [group(left), group(right, true)]
	, aliasArguments: (left, right) => [...group(left), ...group(right, true)]
	, plainFin: values => {
		if(values.some(value => value.tag === "some" && value.value >= 10n)) throw new Error("plainFin.arg0[0].value must be bigint below 10");
		return BigInt(values.length);
	}
});

test("the structural npm caller detects skipped checks, wrong constructors, NUL loss and input mutation", () => {
	const original = mockedApi();
	assert.deepEqual(checkStructuralSubtypes(original), { checks: 3028, rejections: 1020 });
	const mutations = [
		{ arrays: values => values }
		, { lists: values => values.map(value => positive(value) + 1n) }
		, { aliasPair: values => values }
		, { product: ([value, text]) => [positive(value), text.split("\0")[0]] }
		, { arrays: values => original.arrays(values).map(value => `${value}n`) }
		, { lists: values => original.lists(values).map(value => Number(value)) }
		, { options: value => ({ ...original.options(value), extra: undefined }) }
		, { product: values => ({ ...original.product(values) }) }
		, { byteBranches: values => original.byteBranches(values).map(value => value.tag === "none" ? value : { tag: "some", value: [String(value.value[0]), value.value[1]] }) }
		, { nested: values => { values.flat().forEach(value => { if(value.tag === "some") positive(value.value[0]); }); return BigInt(values.length); } }
		, { plainFin: values => {
			if(values.some(value => value.tag === "some" && value.value >= 10n)) throw new Error("plainFin.arg0[1].value must be bigint below 10");
			return original.plainFin(values);
		} }
		, { aliasArguments: (left, right) => {
			if(right.some(value => value.tag === "some" && value.value === 0n))
			{ left[0].value = 999n; return failure(); }
			return original.aliasArguments(left, right);
		} }
	];
	for(const mutation of mutations) assert.throws(() => checkStructuralSubtypes({ ...mockedApi(), ...mutation }), /accepted:|failed:|wrong rejection:/u);
});

test("strict TypeScript represents structural Subtypes as their exact erased containers", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-subtype-typescript-"));
	t.after(() => rm(root, { recursive: true }));
	for(const [path, source] of Object.entries(generateJavaScriptPackage(structuralSubtypeReview())))
		await saveLakeFile(join(root, "node_modules/structuralsubtypes"), path, source);
	await saveLakeFile(root, "index.mts", await readFile("tests/fixtures/structural-subtype-consumers/index.mts"));
	const compiler = resolve("node_modules/typescript/lib/tsc.js");
	await runCopied(process.execPath, [compiler
		, "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022"
		, "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext"
		, "--moduleResolution", "NodeNext", "index.mts"], root);
});
