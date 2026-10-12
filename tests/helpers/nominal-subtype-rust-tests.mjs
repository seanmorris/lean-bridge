/**
 * Independent Rust caller controls. Synthetic models are not installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedRustPackage } from "../../src/backends/rust/copied-values.mjs";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeRustRoutes, nominalSubtypeRustModes, nominalSubtypeRustConfiguration, nominalSubtypeRustCaller, nominalSubtypeRustCounts, nominalSubtypeRustSelection, parseNominalSubtypeRustResult } from "./nominal-subtype-rust-fixture.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { nominalSubtypeRustApiProbe, nominalSubtypeRustInputNames } from "./nominal-subtype-rust-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const rustc = process.env.LEAN_BRIDGE_RUSTC ?? resolve(".toolchains/rust-1.90.0/bin/rustc");
const callerControls = process.env.LEAN_BRIDGE_RUSTC !== undefined || existsSync(rustc);

test("nominal Rust configurations preserve both author routes and result-only contracts", async () => {
	for(const route of nominalSubtypeRustRoutes) for(const mode of nominalSubtypeRustModes)
	{
		const actual = nominalSubtypeRustConfiguration(route, mode);
		const expected = nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only");
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { cargo: { name: "nominalsubtypes", version: "1.0.0" } });
		if(mode === "result-only") assert.equal(actual.contracts, undefined);
	}
	assert.equal(await nominalSubtypeRustCaller("reviewed"), (await nominalSubtypeRustCaller("ordinary")).replaceAll(/arg([01])/gu, "value$1"));
	assert.throws(() => nominalSubtypeRustConfiguration("unknown", "full"));
	assert.throws(() => nominalSubtypeRustConfiguration("ordinary", "unknown"));
	await assert.rejects(nominalSubtypeRustCaller("unknown"));
	for(const mode of nominalSubtypeRustModes)
	{
		const counts = nominalSubtypeRustCounts[mode];
		assert.deepEqual(parseNominalSubtypeRustResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalSubtypeRustResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalSubtypeRustResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNominalSubtypeRustResult("{}", "unknown"));
});

test("nominal Rust gates reject disabled explicit work and invalid selections", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_RUST_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalSubtypeRustSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalSubtypeRustSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2"]) assert.throws(() => nominalSubtypeRustSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`])
			assert.throws(() => nominalSubtypeRustSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalSubtypeRustSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalSubtypeRustSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	assert.throws(() => nominalSubtypeRustSelection({ [prefix + "OUTPUT"]: "explicit" }));
});

test("independent nominal Rust caller rejects faulty constructors, payloads and diagnostics", {
	skip: !callerControls && "Select LEAN_BRIDGE_RUSTC to execute Rust caller controls"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-rust-controls-"));
	t.after(() => rm(root, { recursive: true }));
	const compile = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	const flags = ["--edition=2021", "--deny=warnings", "--check-cfg", 'cfg(feature, values("result-only"))'];
	let controls = 0;
	for(const mode of nominalSubtypeRustModes)
	{
		const selected = mode === "result-only" ? ["--cfg", 'feature="result-only"'] : [];
		const library = join(root, `libnominalsubtypes-${mode}.rlib`);
		const model = await runCopied(rustc, [...flags
			, ...selected
			, "--crate-type=rlib"
			, "--crate-name=nominalsubtypes"
			, resolve("tests/helpers/nominal-subtype-rust-model.rs")
			, "-o"
			, library], root, compile);
		assert.equal(model.stderr, "");
		await saveLakeFile(root, "src/bin/api-probe.rs", nominalSubtypeRustApiProbe);
		const probe = await captureCorpusCompiler(rustc, [...flags, ...selected
			, "--extern", `nominalsubtypes=${library}`
			, "--error-format=json", "--emit=metadata"
			, "src/bin/api-probe.rs", "-o", join(root, "probe.rmeta")], root, compile);
		assert.equal(probe.stdout, "");
		if(mode === "full") assert.deepEqual(probe, { code: 0, stdout: "", stderr: "" });
		else
		{
			assert.equal(probe.code, 1);
			const errors = probe.stderr.trim().split("\n").map(line => JSON.parse(line)).filter(message => message.level === "error" && message.code);
			assert.equal(errors.length, 1); assert.equal(errors[0].code.code, "E0432");
			assert.deepEqual([...errors[0].message.matchAll(/`nominalsubtypes::([A-Za-z_0-9]+)`/gu)].map(match => match[1]).sort(), [...nominalSubtypeRustInputNames].sort());
		}
		for(const route of nominalSubtypeRustRoutes)
		{
			const source = `${route}-${mode}.rs`, executable = join(root, `${route}-${mode}`);
			await saveLakeFile(root, source, await nominalSubtypeRustCaller(route));
			const built = await runCopied(rustc, [...flags
				, ...selected
				, "--extern"
				, `nominalsubtypes=${library}`
				, source, "-o", executable], root, compile);
			assert.equal(built.stderr, "");
			const environment = { ...copiedCleanEnvironment, NOMINAL_RUST_ROUTE: route };
			const run = await runCopied(executable, [], root, environment);
			assert.equal(run.stderr, ""); parseNominalSubtypeRustResult(run.stdout, mode);
			const mutants = ["scalar"
				, "short-array"
				, "missing-pair-values"
				, "missing-event-choices"
				, "missing-event-value"
				, "truncate-envelope"
				, "wrong-choice-tag"
				, "swap-pair"
				, ...mode === "full" ? ["first", "second", "combine", "nested", "plain-fin", "wrong-error-path", "fin-after-subtype"] : []];
			for(const mutant of mutants)
			{
				await assert.rejects(runCopied(executable, [], root, { ...environment, NOMINAL_RUST_MUTANT: mutant }), error => {
					assert.match(error.details?.stderr ?? "", /failed: |accepted: /u, `${route}/${mode}/${mutant}`);
					return true;
				});
				controls++;
			}
		}
	}
	assert.equal(controls, 46);
	t.diagnostic("46 synthetic caller mutation controls; no installed-package claim");
});

test("nominal Rust declarations retain public aliases and separate result-only exports", () => {
	for(const mode of nominalSubtypeRustModes)
	{
		const review = nominalSubtypeInstalledReview(mode === "result-only"), before = structuredClone(review);
		const files = generateCopiedRustPackage(review), source = files["src/lib.rs"];
		assert.deepEqual(review, before);
		for(const name of ["Envelope", "AliasPair"])
			assert.match(source, new RegExp(`^pub struct ${name} \\{`, "mu"));
		assert.match(source, /^pub enum Event \{/mu);
		assert.match(source, /^pub type EnvelopeAlias = Envelope;/mu);
		assert.equal([...source.matchAll(/^pub fn /gmu)].length, mode === "full" ? 26 : 13);
		assert.equal(source.includes("pub fn first("), mode === "full");
		assert.equal(source.includes("pub struct Pair {"), mode === "full");
		assert.equal(JSON.parse(files["binding-manifest.json"]).generator.id, "lean-wasm/rust-copied");
	}
});
