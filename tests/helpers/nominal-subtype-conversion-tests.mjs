/**
 * Per-site nominal constructor conversions, tested before nominal admission is opened.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { componentRefinementConversion, constructorRefinementLeaves } from "../../src/build/component-refinements.mjs";
import { generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { nominalFinConversionFixture, nominalSubtypeConversionFixture } from "./nominal-subtype-conversion-fixture.mjs";

test("nominal checked conversions distinguish full per-site trees without changing shared erasure", () => {
	const model = nominalSubtypeConversionFixture();
	const [first, second, combine] = model.exports;
	const a = first.refinements.parameters[0], b = second.refinements.parameters[0];
	assert.notEqual(componentRefinementConversion(a, "value"), componentRefinementConversion(b, "value"));
	assert.equal(componentRefinementConversion(a, "value", false), componentRefinementConversion(b, "value", false));
	assert.equal(componentRefinementConversion(b, "value"), componentRefinementConversion(combine.refinements.parameters[1], "value"));
	const reordered = Object.fromEntries(Object.entries(b).reverse());
	assert.equal(componentRefinementConversion(b, "value"), componentRefinementConversion(reordered, "value"));
	const changedBound = structuredClone(a); changedBound.arguments[1].bound = "4";
	assert.notEqual(componentRefinementConversion(a, "value"), componentRefinementConversion(changedBound, "value"));
	const generated = generateNativeLeanAdapters(model);
	assert.equal((generated.leanSource.match(/structure LbErased.NominalConversion.Envelope where/gu) ?? []).length, 1);
	assert.equal((generated.leanSource.match(/def LbErased.NominalConversion.Envelope.erase /gu) ?? []).length, 1);
	assert.equal((generated.leanSource.match(/def LbErased.NominalConversion.Envelope.via_/gu) ?? []).length, 2);
	assert.equal((generated.leanSource.match(/def LbErased.NominalConversion.Event.via_/gu) ?? []).length, 2);
	assert.doesNotMatch(generated.leanSource, /unsafeCast|sorry|_root_\.null|_root_\.undefined/u);
});

test("nominal constructor leaves retain field, case and structural positions", () => {
	const model = nominalSubtypeConversionFixture();
	const nested = model.exports.find(item => item.name.endsWith(".nested"));
	assert.deepEqual(constructorRefinementLeaves(nested.refinements.parameters[0], nested.parameters[0].type)
		.map(leaf => [leaf.suffix, leaf.refinement.constructor]), [["_0_0", "NominalConversion.plusOne"], ["_1_0", "NominalConversion.plusTwo"]]);
	const event = model.exports.find(item => item.name.endsWith(".eventFirst"));
	const leaves = constructorRefinementLeaves(event.refinements.parameters[0], event.parameters[0].type);
	assert.deepEqual(leaves.map(leaf => [leaf.suffix, leaf.refinement.constructor]), [
		["_1_0_0", "NominalConversion.plusOne"]
		, ["_2_0_0_0_0", "NominalConversion.plusOne"]
		, ["_2_0_0_0_1", "NominalConversion.plusTwo"]
	]);
	const generated = generateNativeLeanAdapters(model);
	for(const leaf of leaves) assert.ok(generated.header.includes(`nominal_eventFirst_refinement_0${leaf.suffix}(lean_object * value)`));
	const alias = { kind: "alias", target: event.parameters[0].type };
	assert.deepEqual(constructorRefinementLeaves(event.refinements.parameters[0], alias), leaves);
});

test("result-only nominal Subtypes emit shared erasure without a checked conversion", () => {
	const model = nominalSubtypeConversionFixture();
	model.exports = model.exports.filter(item => item.name.includes(".produce"));
	model.types = model.types.filter(type => type.key !== "pair");
	const source = generateNativeLeanAdapters(model).leanSource;
	assert.match(source, /def LbErased.NominalConversion.Envelope.erase/u);
	assert.match(source, /def LbErased.NominalConversion.Event.erase/u);
	assert.doesNotMatch(source, /\.via_|\.check |_root_\.null|_refinement_/u);
});

test("an input Subtype cannot reuse a result-only constructor-free tree", () => {
	const model = nominalSubtypeConversionFixture();
	model.exports[0].refinements.parameters[0].arguments[0].constructor = null;
	assert.throws(() => generateNativeLeanAdapters(model), /A Subtype input requires its site's constructor/u);
});

test("a shared nominal mirror rejects conflicting predicate layouts", () => {
	const model = nominalSubtypeConversionFixture();
	model.exports[1].refinements.parameters[0].arguments[1].bound = "4";
	assert.throws(() => generateNativeLeanAdapters(model), /Conflicting nominal refinement layouts/u);
});

test("Fin-only nominal adapter bytes remain unchanged", () => {
	const generated = generateNativeLeanAdapters(nominalFinConversionFixture());
	assert.equal(sha256(canonicalJson(generated)), "1ce38835771c829da75ad5666d4e1a2aa180be6124b6405dcdc7a9238886fa0c");
});

const enabled = process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_CONVERSION_TEST === "1"
	|| process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_EXTRACTOR_TEST === "1"
	|| (process.env.LEAN_BRIDGE_SUBTYPE_PROFILES?.split(",") ?? []).includes("c");
test("fresh Lean compiles distinct nominal conversions, active variants and result-only projection", { skip: !enabled, timeout: 180_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-conversion-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true, force: true });
		else t.diagnostic(`Failed source-check artifacts retained at ${directory}`);
	});
	const reports = process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_CONVERSION_REPORTS;
	if(reports) await mkdir(reports, { recursive: false });
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2", "bin/lean");
	const source = "tests/fixtures/nominal-subtype-conversion/NominalConversion.lean";
	await cp(source, join(directory, "NominalConversion.lean"));
	const run = async args => {
		try
		{
			return await promisify(execFile)(lean, args, {
				cwd: directory, maxBuffer: 16 * 1024 * 1024
				, env: { ...process.env, LEAN_PATH: directory, PATH: `${dirname(lean)}:${process.env.PATH ?? "/usr/bin:/bin"}` }
			});
		}
		catch(error)
		{ error.message += `\n${error.stdout ?? ""}\n${error.stderr ?? ""}`; throw error; }
	};
	await run(["-o", "NominalConversion.olean", "NominalConversion.lean"]);
	const observations = [];
	for(const route of ["forward", "reverse", "result-only"])
	{
		const model = nominalSubtypeConversionFixture();
		if(route === "reverse") model.exports.reverse();
		if(route === "result-only")
		{
			model.exports = model.exports.filter(item => item.name.includes(".produce"));
			model.types = model.types.filter(type => type.key !== "pair");
		}
		const generated = generateNativeLeanAdapters(model);
		const call = name => `${generated.module}.f_nominal_${name}`;
		const mirror = name => `${generated.module}.LbErased.NominalConversion.${name}`;
		const checks = route === "result-only" ? [] : [
			`example : ${call("first")} ⟨40, 2⟩ = some 41 := by decide`
			, `example : ${call("second")} ⟨40, 2⟩ = some 42 := by decide`
			, `example : ${call("combine")} ⟨40, 2⟩ ⟨40, 2⟩ = some 4142 := by decide`
			, `example : ${call("nested")} ⟨⟨40, 2⟩, ⟨40, 2⟩⟩ = some 4142 := by decide`
			, `example : ${call("first")} ⟨100, 2⟩ = none := by decide`
			, `example : ${call("first")} ⟨40, 3⟩ = none := by decide`
			, `example : ${call("second")} ⟨90, 2⟩ = none := by decide`
			, `example : ${call("combine")} ⟨40, 2⟩ ⟨90, 2⟩ = none := by decide`
			, `example : ${call("eventFirst")} ${mirror("Event")}.empty = some 0 := by decide`
			, `example : ${call("eventFirst")} (.box ⟨40, 2⟩) = some 41 := by decide`
			, `example : ${call("eventSecond")} (.box ⟨40, 2⟩) = some 42 := by decide`
			, `example : ${call("eventFirst")} (.choices #[none, some (.ok 95)]) = some 96 := by native_decide`
			, `example : ${call("eventFirst")} (.choices #[some (.error 95)]) = none := by native_decide`
			, `example : ${call("eventSecond")} (.choices #[some (.error 95)]) = some 96 := by native_decide`
			, `example : ((${call("echo")} ⟨40, 2⟩).map fun value => value.payload) = some 41 := by decide`
		];
		checks.push(`example : (${call("produce")} 120).payload = 121 := by decide`
			, `example : (match ${call("produceEvent")} 120 with | .box value => value.payload | _ => 0) = 121 := by decide`);
		const text = `${generated.leanSource}\n${checks.join("\n")}\n`;
		await writeFile(join(directory, "Generated.lean"), text);
		const result = await run(["Generated.lean"]);
		assert.equal(result.stderr, "");
		// Preserve the generator's existing nullary helper bytes and their two known binder warnings.
		const warnings = [...result.stdout.matchAll(/^Generated\.lean:\d+:\d+: warning: (.+)$/gmu)].map(match => match[1]);
		assert.equal(warnings.length, 4);
		assert.ok(warnings.every(warning => warning === "Variable name `unit` is not explicitly referenced."
			|| warning === "Local variable 'unit' resembles constructor 'PUnit.unit' - write '.unit' (with a dot) or 'PUnit.unit' to use the constructor."));
		observations.push({ route, checks: checks.length, sourceSha256: sha256(text), stdout: result.stdout, stderr: result.stderr });
		if(reports) await writeFile(join(reports, `${route}.lean`), text, { flag: "wx" });
	}
	if(reports)
	{
		await cp(source, join(reports, "NominalConversion.lean"));
		await writeFile(join(reports, "report.json"), JSON.stringify({ schemaVersion: 1
			, kind: "nominal-subtype-conversion-source-check", installedAcceptance: false
			, fixtureSha256: sha256(await readFile(source))
			, compilerSha256: sha256(await readFile(lean))
			, observations }, null, 2) + "\n", { flag: "wx" });
	}
	complete = true;
});
