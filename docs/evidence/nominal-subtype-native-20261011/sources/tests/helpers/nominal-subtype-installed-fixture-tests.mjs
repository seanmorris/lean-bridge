/**
 * Independent package fixtures and consumer-oracle controls.
 * Generated JavaScript runs against an explicit double, never reported as Wasm.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { reviewedSubtypeContracts } from "../../src/analyze/reviewed-subtypes.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { nominalSubtypeInstalledReview, nominalSubtypeInstalledConfiguration, nominalSubtypeName } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeCallerModel } from "./nominal-subtype-caller-model.mjs";
import { checkNominalSubtypes } from "../fixtures/nominal-subtype-consumers/javascript.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import "./nominal-subtype-native-caller-tests.mjs";
import "./nominal-subtype-native-installed-tests.mjs";

test("nominal package review independently matches ordinary choices and retains constructor-free results", () => {
	for(const resultOnly of [false, true])
	{
		const document = nominalSubtypeInstalledReview(resultOnly); validateBindingIr(document);
		assert.equal(document.declarations.length, resultOnly ? 13 : 26);
		const configuration = nominalSubtypeInstalledConfiguration("ordinary", ["c", "cpp", "npm"], resultOnly);
		validateExportConfiguration(configuration);
		assert.deepEqual(reviewedSubtypeContracts(document), configuration.contracts);
		const review = nominalSubtypeInstalledConfiguration("reviewed", ["npm"], resultOnly);
		validateExportConfiguration(review);
		assert.equal(Object.hasOwn(review, "contracts"), false);
		assert.equal(Object.hasOwn(review, "exports"), false);
		for(const item of document.declarations)
			assert.doesNotMatch(JSON.stringify(item.source.extensions["lean-lang.org/refinements"].result), /plusOne|plusTwo/u);
		if(resultOnly) assert.equal(Object.hasOwn(configuration, "contracts"), false);
	}
	for(const [route, profiles] of [["wrong", ["npm"]], ["ordinary", []], ["ordinary", ["npm", "npm"]], ["ordinary", ["unknown"]]])
		assert.throws(() => nominalSubtypeInstalledConfiguration(route, profiles));
});

const mockedPackage = async (t, resultOnly) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-caller-unit-"));
	t.after(() => rm(directory, { recursive: true }));
	const files = generateJavaScriptPackage(nominalSubtypeInstalledReview(resultOnly));
	for(const path of ["index.mjs", "internal/validators.mjs"]) await saveLakeFile(directory, path, files[path]);
	await saveLakeFile(directory, "internal/runtime.mjs", "export const control = { api: null, calls: 0 }; export const runtime = { call(id, args) { control.calls++; return control.api[id.split('.').at(-1)](...args); } };\n");
	const { control } = await import(pathToFileURL(join(directory, "internal/runtime.mjs")));
	control.api = nominalSubtypeCallerModel();
	return { api: await import(pathToFileURL(join(directory, "index.mjs"))), control };
};

test("nominal npm caller covers both generated selections with an explicit runtime double", async t => {
	for(const resultOnly of [false, true])
	{
		const { api } = await mockedPackage(t, resultOnly);
		const result = checkNominalSubtypes(api, { resultOnly });
		assert.deepEqual(result, resultOnly ? { checks: 2078, rejections: 0 } : { checks: 3172, rejections: 1032 });
		t.diagnostic(JSON.stringify({ resultOnly, ...result, execution: "generated-api-with-explicit-double" }));
	}
});

test("the nominal caller rejects wrong per-use constructors, lossy results and altered caller data", async t => {
	const { api, control } = await mockedPackage(t, false), original = nominalSubtypeCallerModel();
	const mutations = [
		{ first: value => value.payload }
		, { second: original.first }
		, { nested: value => original.first(value.left) * 100n + original.first(value.right) }
		, { eventFirst: original.eventSecond }
		, { eventSecond: original.eventFirst }
		, { echo: value => value }
		, { echoGroups: values => values }
		, { echoPair: value => value }
		, { echoEvent: value => value }
		, { produceEnvelope: value => ({ payload: BigInt(Number(value + 1n)), digit: 2n }) }
		, { pairValues: value => ({ left: original.groupValues(value), right: original.groupValues(value) }) }
		, { echoPair: value => {
			try
			{ return original.echoPair(value); }
			catch(error)
			{ value.left[1].value.payload = 999n; throw error; }
		} }
	];
	for(const mutation of mutations)
	{
		control.api = { ...nominalSubtypeCallerModel(), ...mutation };
		assert.throws(() => checkNominalSubtypes(api), /failed:|accepted:|wrong rejection:/u);
	}
	control.api = nominalSubtypeCallerModel();
	for(const name of ["first", "second", "eventFirst", "echoGroups", "echoPair", "plainFin"])
	{
		const changed = { ...api, [name]: () => { throw new Error("unexpected error class"); } };
		assert.throws(() => checkNominalSubtypes(changed));
	}
});

test("late Fin guards prevent mocked dispatch even when an earlier Subtype constructor would refuse", async t => {
	const { api, control } = await mockedPackage(t, false);
	const bad = { payload: 100n, digit: 2n }, later = { payload: 40n, digit: 3n };
	for(const call of [
		() => api.combine(bad, later)
		, () => api.nested({ left: bad, right: later })
		, () => api.aliases([{ tag: "some", value: bad }], [{ tag: "some", value: later }])
		, () => api.echoEvent({ kind: "box", value: later })
	]) assert.throws(call, /digit must be bigint below 3/u);
	assert.equal(control.calls, 0);
	api.eventFirst({ kind: "empty" });
	assert.equal(control.calls, 1);
});

test("strict TypeScript callers compile against full and result-only nominal declarations", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-typescript-"));
	t.after(() => rm(directory, { recursive: true }));
	for(const resultOnly of [false, true])
	{
		const root = join(directory, resultOnly ? "result-only" : "full");
		for(const [path, source] of Object.entries(generateJavaScriptPackage(nominalSubtypeInstalledReview(resultOnly))))
			await saveLakeFile(join(root, "node_modules", nominalSubtypeName), path, source);
		for(const file of resultOnly ? ["results.mts"] : ["results.mts", "index.mts"])
			await saveLakeFile(root, file, await readFile(`tests/fixtures/nominal-subtype-consumers/${file}`));
		await runCopied(process.execPath, [resolve("node_modules/typescript/lib/tsc.js")
			, "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022"
			, "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext"
			, "--moduleResolution", "NodeNext"
			, resultOnly ? "results.mts" : "index.mts"], root);
	}
});
