/**
 * Test npm primitive-base selection and handoff guards without running a compiler.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nominalPrimitiveNpmHandoffRecords, assertNominalPrimitiveNpmHandoff } from "./nominal-primitive-subtype-npm-package.mjs";

const flag = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST";
const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_";
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_") && key !== "NODE_TEST_CONTEXT"));
const run = variables => {
	const args = ["--test", "--test-concurrency=1", "--test-reporter=tap"
		, "tests/helpers/nominal-primitive-subtype-npm-installed-tests.mjs"];
	return spawnSync(process.execPath, args, { env: { ...clean, ...variables }
		, encoding: "utf8", timeout: 15_000, maxBuffer: 1024 * 1024 });
};

test("primitive npm acceptance is explicitly opt-in and retains all four default selections", () => {
	const result = run({});
	assert.equal(result.status, 0); assert.equal(result.signal, null); assert.equal(result.stderr, "");
	assert.match(result.stdout, /^# tests 4$/mu); assert.match(result.stdout, /^# skipped 4$/mu);
	assert.match(result.stdout, /^# pass 0$/mu); assert.match(result.stdout, /^# fail 0$/mu);
	for(const route of ["ordinary", "reviewed"]) for(const mode of ["full", "result-only"])
		assert.ok(result.stdout.includes(`installed npm primitive-base nominal Subtypes reproduce and relocate ${route} ${mode} # SKIP\n`));
	const selected = run({ [flag]: "0", [prefix + "ROUTES"]: "reviewed", [prefix + "MODES"]: "result-only" });
	assert.equal(selected.status, 0); assert.equal(selected.signal, null); assert.equal(selected.stderr, "");
	assert.match(selected.stdout, /^# tests 1$/mu); assert.match(selected.stdout, /^# skipped 1$/mu);
	assert.match(selected.stdout, /reviewed result-only # SKIP\n/u);
});

test("primitive npm selection refuses unknown, empty and duplicate values before any compiler work", () => {
	for(const value of ["", "true", "2"])
	{
		const result = run({ [flag]: value });
		assert.equal(result.status, 1); assert.equal(result.signal, null);
		assert.ok((result.stdout + result.stderr).includes(`Invalid ${flag}`));
	}
	for(const [name, choices] of [["ROUTES", ["", "other", "ordinary,other", "ordinary,ordinary"]]
		, ["MODES", ["", "other", "full,other", "full,full"]]])
		for(const choice of choices)
		{
			const result = run({ [flag]: "1", [prefix + name]: choice });
			assert.equal(result.status, 1); assert.equal(result.signal, null);
			assert.match(result.stdout + result.stderr, new RegExp(`(?:Invalid|Duplicate) ${prefix + name}`, "u"));
		}
});

test("primitive npm test registration keeps caller, package and installed checks together", async () => {
	const entry = await readFile("tests/helpers/nominal-primitive-subtype-tests.mjs", "utf8");
	for(const name of ["caller-tests", "npm-tests", "npm-installed-tests"])
		assert.ok(entry.includes(`import "./nominal-primitive-subtype-${name}.mjs";`));
	const root = await readFile("tests/component-refinement-mirrors.test.mjs", "utf8");
	assert.ok(root.includes('import "./helpers/nominal-primitive-subtype-tests.mjs";'));
});

test("primitive npm handoff paths reject malformed receipts before reading artifacts", async () => {
	// This earlier receipt is only schema input for rejection controls, not primitive-base evidence.
	const seed = JSON.parse(await readFile("docs/evidence/nominal-subtype-npm-20261011/ordinary/full/records/build-0/component-package-receipt.json"));
	assert.deepEqual(nominalPrimitiveNpmHandoffRecords(seed), [
		"handoff/component-package-receipt.json"
		, "handoff/verify-component-package-receipt.mjs"
		, "handoff/" + seed.runtime.archive
		, "handoff/" + seed.package.archive
	]);
	for(const role of ["runtime", "package"]) for(const path of ["../outside.tgz", "/outside.tgz", "archive.zip", "bad\0.tgz"])
	{
		const receipt = structuredClone(seed); receipt[role].archive = path;
		assert.throws(() => nominalPrimitiveNpmHandoffRecords(receipt));
		let reads = 0;
		const noRead = async () => { reads++; throw new Error("Unexpected artifact read"); };
		await assert.rejects(assertNominalPrimitiveNpmHandoff(noRead, { receipt }, noRead));
		assert.equal(reads, 0);
	}
});
