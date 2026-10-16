/**
 * Source-only controls for the nested checked-record Rust caller. No compiled Lean
 * library or installed crate executes here; the caller runs against a Rust stand-in.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { generateCopiedRustPackage } from "../../src/backends/rust/copied-values.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nestedCheckedRecordConfiguration, nestedCheckedRecordReview } from "./nested-checked-record-fixture.mjs";
import {
	nestedCheckedRecordRustCaller
	, nestedCheckedRecordRustConfiguration
	, nestedCheckedRecordRustCounts
	, nestedCheckedRecordRustFeatures
	, nestedCheckedRecordRustModes
	, nestedCheckedRecordRustReview
	, nestedCheckedRecordRustRoutes
	, nestedCheckedRecordRustSelection
	, nestedCheckedRecordRustTarget
	, parseNestedCheckedRecordRustResult
} from "./nested-checked-record-rust-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const toolchain = process.env.LEAN_BRIDGE_RUST_TOOLCHAIN ?? resolve(".toolchains/rust-1.90.0");
const cargoHome = process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied");
const callerControls = existsSync(join(toolchain, "bin/cargo")) && existsSync(join(cargoHome, "registry"));
const rustNames = [
	"first", "second", "pair", "in_array", "in_list", "in_option"
	, "in_product", "in_except", "in_holder", "in_choice", "echo_array"
	, "produce_option", "produce_array"
];
const publicItems = source => [...source.matchAll(/^pub (fn|struct|enum) (\w+)(\([^)]*\) -> [^{]+)?/gmu)]
	.map(([, kind, name, signature]) => `${kind} ${name}${signature?.trim() ?? ""}`);
export const nestedCheckedRecordRustFaults = Object.freeze({
	result: Object.freeze(["produce-offset", "produce-array-length", "produce-absent", "produce-refused"])
	, input: Object.freeze([
		"missing-fin", "fin-after-constructor", "missing-normalization"
		, "conflated-constructor", "diagnostic-suffix", "wrong-status"
		, "wrong-error-kind", "wrong-path", "wrong-choice", "except-swapped"
		, "holder-tag", "echo-normalizes", "echo-swapped-fields"
		, "list-as-array"
	])
});

test("nested checked-record Rust keeps both author contracts and constructor-free results", async () => {
	for(const route of nestedCheckedRecordRustRoutes) for(const mode of nestedCheckedRecordRustModes)
	{
		const expected = nestedCheckedRecordConfiguration(route, ["c"], mode);
		const actual = nestedCheckedRecordRustConfiguration(route, mode); validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { cargo: { name: "nestedcheckedrecords", version: "1.0.0" } });
		const review = nestedCheckedRecordRustReview(mode), before = structuredClone(review); validateBindingIr(review);
		assert.deepEqual(review, nestedCheckedRecordReview(mode));
		const files = generateCopiedRustPackage(review, null, { ...nestedCheckedRecordRustTarget, metadata: {} });
		assert.deepEqual(review, before);
		const names = mode === "full" ? rustNames : rustNames.slice(-2);
		assert.deepEqual([...files["src/lib.rs"].matchAll(/^pub fn (\w+)\(/gmu)].map(match => match[1]), names);
		assert.match(files["src/lib.rs"], /pub struct Packet \{\n {4}pub digit: BigUint,\n {4}pub word: BigUint,\n\}/u);
		if(mode === "full")
		{
			assert.match(files["src/lib.rs"], /pub struct Holder \{\n {4}pub packet: Packet,\n {4}pub tag: BigUint,\n\}/u);
			assert.match(files["src/lib.rs"], /pub enum Choice \{\n {4}Empty,\n {4}Packet \{ value: Packet \},\n\}/u);
		}
		assert.deepEqual(nestedCheckedRecordRustFeatures(route, mode)
			, [...mode === "result-only" ? ["result-only"] : [], ...route === "reviewed" ? ["reviewed"] : []]);
		const counts = nestedCheckedRecordRustCounts[mode];
		assert.deepEqual(parseNestedCheckedRecordRustResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNestedCheckedRecordRustResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNestedCheckedRecordRustResult(JSON.stringify({ ...counts, extra: true }), mode));
	}
	// The stand-in mirrors the generated full public API exactly, so the caller compiles against both.
	const generated = generateCopiedRustPackage(nestedCheckedRecordReview("full"), null, { ...nestedCheckedRecordRustTarget, metadata: {} })["src/lib.rs"];
	const standIn = await readFile("tests/helpers/nested-checked-record-rust-model.rs", "utf8");
	assert.deepEqual(publicItems(standIn), publicItems(generated));
	assert.match(generated, /pub enum Error \{\n {4}Limit,\n {4}Allocation,\n {4}InvalidNative,\n\n {4}Load\(String\),\n {4}Native \{ code: i32, message: String \},\n\}/u);
	assert.equal(await nestedCheckedRecordRustCaller("reviewed"), await nestedCheckedRecordRustCaller("ordinary"));
	assert.throws(() => nestedCheckedRecordRustConfiguration("unknown", "full"));
	assert.throws(() => nestedCheckedRecordRustConfiguration("ordinary", "unknown"));
	assert.throws(() => nestedCheckedRecordRustFeatures("ordinary", "unknown"));
	await assert.rejects(nestedCheckedRecordRustCaller("unknown"));
	assert.throws(() => parseNestedCheckedRecordRustResult("{}", "unknown"));
});

test("nested checked-record Rust gates reject disabled, misspelled or repeated selections", () => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUST_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nestedCheckedRecordRustSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"], maxLoad: 8 });
	for(const maxLoad of [8, 12, 16, 20])
		assert.equal(nestedCheckedRecordRustSelection({ ...enabled, [prefix + "MAX_LOAD"]: String(maxLoad) }).maxLoad, maxLoad);
	for(const raw of ["6", "24", "eight", ""])
		assert.throws(() => nestedCheckedRecordRustSelection({ ...enabled, [prefix + "MAX_LOAD"]: raw }));
	for(const flag of [undefined, "0"])
		assert.throws(() => nestedCheckedRecordRustSelection({ [prefix + "TEST"]: flag, [prefix + "MAX_LOAD"]: "20" }));
	assert.equal(nestedCheckedRecordRustSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nestedCheckedRecordRustSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const value of ["", "unknown", valid + ",", valid + "," + valid, true, null])
			assert.throws(() => nestedCheckedRecordRustSelection({ ...enabled, [prefix + name]: value }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nestedCheckedRecordRustSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nestedCheckedRecordRustSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const flag of [undefined, "0"])
		assert.throws(() => nestedCheckedRecordRustSelection({ [prefix + "TEST"]: flag, [prefix + "OUTPUT"]: "explicit" }));
});

test("nested checked-record Rust caller detects every stand-in fault on all four selections", { skip: !callerControls, timeout: 900_000 }, async t => {
	assert.ok(isAbsolute(toolchain) && isAbsolute(cargoHome));
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-rust-model-")); let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true }); else t.diagnostic(`Retained failed Rust model inputs: ${root}`);
	});
	const commands = [], environment = {
		PATH: `${join(toolchain, "bin")}:/usr/bin:/bin`, LC_ALL: "C", HOME: root
		, CARGO_HOME: cargoHome, CARGO_TARGET_DIR: join(root, "target")
		, RUSTFLAGS: "-D warnings"
	};
	const run = async (command, args, extra = {}, cwd = join(root, "consumer")) => {
		const env = { ...environment, ...extra };
		const result = spawnSync(command, args, { cwd, env, encoding: "utf8", maxBuffer: 16 * 1024 ** 2, timeout: 600_000 });
		const { status, signal, stdout, stderr } = result;
		commands.push({ command, args, environment: env, status, signal, stdout, stderr });
		await saveLakeFile(root, "commands.json", canonicalJson(commands));
		assert.equal(result.error, undefined); assert.equal(result.signal, null); return commands.at(-1);
	};
	await saveLakeFile(root, "model/Cargo.toml", '[package]\nname = "nestedcheckedrecords"\nversion = "1.0.0"\nedition = "2021"\n\n[dependencies]\nnum-bigint = "=0.4.6"\n');
	await saveLakeFile(root, "model/src/lib.rs", await readFile("tests/helpers/nested-checked-record-rust-model.rs"));
	await saveLakeFile(root, "consumer/Cargo.toml", '[package]\nname = "nested-consumer"\nversion = "0.0.0"\nedition = "2021"\n\n[features]\nresult-only = []\nreviewed = []\n\n[dependencies]\nnestedcheckedrecords = { path = "../model" }\n');
	await saveLakeFile(root, "consumer/src/main.rs", await nestedCheckedRecordRustCaller("ordinary"));
	const binary = join(root, "target/debug/nested-consumer");
	let rejected = 0;
	for(const mode of nestedCheckedRecordRustModes) for(const route of nestedCheckedRecordRustRoutes)
	{
		const features = nestedCheckedRecordRustFeatures(route, mode);
		const build = await run(join(toolchain, "bin/cargo"), ["build", "--offline", "--quiet", ...features.length ? ["--features", features.join(",")] : []]);
		assert.equal(build.status, 0, build.stderr); assert.equal(build.stderr, "");
		const prefix = { NESTED_RUST_PREFIX: route === "reviewed" ? "value" : "arg" };
		const baseline = await run(binary, [], prefix);
		assert.equal(baseline.status, 0, baseline.stderr); assert.equal(baseline.stderr, "");
		parseNestedCheckedRecordRustResult(baseline.stdout, mode);
		const faults = [...nestedCheckedRecordRustFaults.result, ...mode === "full" ? nestedCheckedRecordRustFaults.input : []];
		for(const fault of faults)
		{
			const changed = await run(binary, [], { ...prefix, NESTED_RUST_FAULT: fault });
			assert.equal(changed.status, 101, fault); assert.equal(changed.stdout, ""); assert.match(changed.stderr, /failed: /u, fault);
			rejected++;
		}
		if(mode === "full")
		{
			// Diagnostics name the selected route's parameters.
			const swapped = await run(binary, [], { NESTED_RUST_PREFIX: route === "reviewed" ? "arg" : "value" });
			assert.equal(swapped.status, 101); assert.match(swapped.stderr, /failed: exact refusal/u); rejected++;
		}
	}
	t.diagnostic(`${rejected} incorrect stand-ins rejected; no compiled Lean or installed crate claim`);
	complete = true;
});
