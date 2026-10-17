/**
 * Source-only controls for the inherited checked-record Rust caller. No compiled
 * Lean library or installed crate executes here; the caller runs against a model.
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
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { generateCopiedRustPackage } from "../../src/backends/rust/copied-values.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	inheritedCheckedRecordConfiguration
} from "./inherited-checked-record-fixture.mjs";
import {
	inheritedCheckedRecordRustCaller
	, inheritedCheckedRecordRustConfiguration
	, inheritedCheckedRecordRustCounts
	, inheritedCheckedRecordRustFeatures
	, inheritedCheckedRecordRustModes
	, inheritedCheckedRecordRustReview
	, inheritedCheckedRecordRustRoutes
	, inheritedCheckedRecordRustSelection
	, inheritedCheckedRecordRustTarget
	, parseInheritedCheckedRecordRustResult
} from "./inherited-checked-record-rust-fixture.mjs";
import {
	assertInheritedCheckedRecordRustResources
} from "./inherited-checked-record-rust-resources.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const toolchain = process.env.LEAN_BRIDGE_RUST_TOOLCHAIN
	?? resolve(".toolchains/rust-1.90.0");
const cargoHome = process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied");
const callerControls = existsSync(join(toolchain, "bin/cargo"))
	&& existsSync(join(cargoHome, "registry"));
const names = [
	"first", "normalized", "pair", "aliased", "nested", "echo"
	, "produce", "produce_stamped"
];
const publicItems = source => source.split("\n")
	.map(line => line.trim())
	.filter(line => /^pub (?:enum|fn|struct|type) /u.test(line));
const generatedFiles = mode => generateCopiedRustPackage(
	inheritedCheckedRecordRustReview(mode), null
	, { ...inheritedCheckedRecordRustTarget, metadata: {} }
);

export const inheritedCheckedRecordRustFaults = Object.freeze({
	result: Object.freeze([
		"produce-offset", "produce-stamped-mark", "produce-refused"
	])
	, input: Object.freeze([
		"missing-normalization", "missing-span", "missing-word"
		, "missing-ticket", "conflated-constructor", "diagnostic-suffix"
		, "wrong-status", "wrong-error-kind", "wrong-path", "missing-fin"
		, "missing-stamped", "echo-raw"
	])
});

test("inherited checked-record Rust preserves parent subobjects and result-only erasure", async () => {
	for(const route of inheritedCheckedRecordRustRoutes)
		for(const mode of inheritedCheckedRecordRustModes)
		{
			const expected = inheritedCheckedRecordConfiguration(route, ["c"]);
			if(mode === "result-only")
			{
				const selected = new Set([
					"InheritedCheckedRecords.produce"
					, "InheritedCheckedRecords.produceStamped"
				]);
				if(expected.exports)
					expected.exports = expected.exports.filter(name => selected.has(name));
				if(expected.contracts)
				{
					expected.contracts = Object.fromEntries(Object.entries(expected.contracts)
						.filter(([name]) => selected.has(name)));
					if(!Object.keys(expected.contracts).length) delete expected.contracts;
				}
			}
			const actual = inheritedCheckedRecordRustConfiguration(route, mode);
			validateExportConfiguration(actual);
			assert.deepEqual({ ...actual, targets: expected.targets }, expected);
			assert.deepEqual(actual.targets, {
				cargo: { name: "inheritedcheckedrecords", version: "1.0.0" }
			});

			const review = inheritedCheckedRecordRustReview(mode);
			const before = structuredClone(review);
			validateBindingIr(review);
			const files = generatedFiles(mode), source = files["src/lib.rs"];
			assert.deepEqual(review, before);
			assert.deepEqual([...source.matchAll(/^pub fn (\w+)\(/gmu)]
				.map(match => match[1]), mode === "full" ? names : names.slice(-2));
			assert.match(source, /pub struct Span \{\n {4}pub lo: BigUint,\n {4}pub hi: BigUint,\n\}/u);
			assert.match(source, /pub struct Ticket \{\n {4}pub to_span: Span,\n {4}pub word: BigUint,\n\}/u);
			assert.match(source, /pub struct Stamped \{\n {4}pub to_ticket: Ticket,\n {4}pub mark: BigUint,\n\}/u);
			assert.equal(/pub type TicketAlias = Ticket;/u.test(source), mode === "full");
			assert.deepEqual(inheritedCheckedRecordRustFeatures(route, mode), [
				...mode === "result-only" ? ["result-only"] : []
				, ...route === "reviewed" ? ["reviewed"] : []
			]);
			const counts = inheritedCheckedRecordRustCounts[mode];
			assert.deepEqual(parseInheritedCheckedRecordRustResult(
				JSON.stringify(counts), mode), counts);
			for(const key of Object.keys(counts)) assert.throws(() =>
				parseInheritedCheckedRecordRustResult(JSON.stringify({
					...counts, [key]: counts[key] + 1
				}), mode)
			);
			assert.throws(() => parseInheritedCheckedRecordRustResult(
				JSON.stringify({ ...counts, extra: true }), mode));
		}

	const generated = generatedFiles("full")["src/lib.rs"];
	const model = await readFile(
		"tests/helpers/inherited-checked-record-rust-model.rs", "utf8"
	);
	assert.deepEqual(publicItems(model), publicItems(generated));
	assert.match(generated, /pub enum Error \{\n {4}Limit,\n {4}Allocation,\n {4}InvalidNative,/u);
	assert.equal(await inheritedCheckedRecordRustCaller("ordinary")
		, await inheritedCheckedRecordRustCaller("reviewed"));
	assert.throws(() => inheritedCheckedRecordRustConfiguration("unknown", "full"));
	assert.throws(() => inheritedCheckedRecordRustConfiguration("ordinary", "unknown"));
	assert.throws(() => inheritedCheckedRecordRustFeatures("ordinary", "unknown"));
	await assert.rejects(inheritedCheckedRecordRustCaller("unknown"));
	assert.throws(() => parseInheritedCheckedRecordRustResult("{}", "unknown"));
});

test("inherited checked-record Rust gates close selections and resource ceilings", () => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUST_";
	const enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(inheritedCheckedRecordRustSelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"]
		, modes: ["full", "result-only"], maxLoad: 8
	});
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => inheritedCheckedRecordRustSelection({
			[prefix + "TEST"]: flag
		}));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => inheritedCheckedRecordRustSelection({
				...enabled, [prefix + name]: raw
			}));
		for(const flag of [undefined, "0"])
			assert.throws(() => inheritedCheckedRecordRustSelection({
				[prefix + "TEST"]: flag, [prefix + name]: valid
			}));
	}
	for(const maxLoad of [8, 12, 16, 20])
		assert.equal(inheritedCheckedRecordRustSelection({
			...enabled, [prefix + "MAX_LOAD"]: String(maxLoad)
		}).maxLoad, maxLoad);
	for(const maxLoad of ["", "6", "10", "24", "Infinity", "eight", null])
		assert.throws(() => inheritedCheckedRecordRustSelection({
			...enabled, [prefix + "MAX_LOAD"]: maxLoad
		}));
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		for(const flag of [undefined, "0"])
			assert.throws(() => inheritedCheckedRecordRustSelection({
				[prefix + "TEST"]: flag, [name]: "explicit"
			}));

	const GiB = 1024 ** 3;
	const admitted = {
		freeBytes: 3 * GiB, availableBytes: 4 * GiB, load: 7.5
	};
	assertInheritedCheckedRecordRustResources({ observations: [admitted], waits: 0 }, 8);
	assertInheritedCheckedRecordRustResources({
		observations: [{ ...admitted, load: 20.5 }, admitted], waits: 1
	}, 20);
	for(const changed of [
		{ observations: [{ ...admitted, freeBytes: GiB }], waits: 0 }
		, { observations: [{ ...admitted, availableBytes: GiB }], waits: 0 }
		, { observations: [{ ...admitted, load: 8 }], waits: 0 }
		, { observations: [admitted], waits: 1 }
		, { observations: [admitted], waits: 0, extra: true }
	]) assert.throws(() => assertInheritedCheckedRecordRustResources(changed, 8));
});

test("inherited checked-record Rust caller detects every model fault on all four selections", {
	skip: !callerControls, timeout: 900_000
}, async t => {
	assert.ok(isAbsolute(toolchain) && isAbsolute(cargoHome));
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-inherited-rust-model-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Retained failed inherited Rust model inputs: ${root}`);
	});
	const commands = [];
	const environment = {
		PATH: `${join(toolchain, "bin")}:/usr/bin:/bin`, LC_ALL: "C", HOME: root
		, CARGO_HOME: cargoHome, CARGO_TARGET_DIR: join(root, "target")
		, RUSTFLAGS: "-D warnings"
	};
	const run = async (command, args, extra = {}, cwd = join(root, "consumer")) => {
		const env = { ...environment, ...extra };
		const result = spawnSync(command, args, {
			cwd, env, encoding: "utf8", maxBuffer: 16 * 1024 ** 2
			, timeout: 600_000
		});
		const { status, signal, stdout, stderr } = result;
		commands.push({ command, args, environment: env, status, signal, stdout, stderr });
		await saveLakeFile(root, "commands.json", canonicalJson(commands));
		assert.equal(result.error, undefined);
		assert.equal(result.signal, null);
		return commands.at(-1);
	};
	await saveLakeFile(root, "model/Cargo.toml", `[package]\nname = "inheritedcheckedrecords"\nversion = "1.0.0"\nedition = "2021"\n\n[dependencies]\nnum-bigint = "=0.4.6"\n`);
	await saveLakeFile(root, "model/src/lib.rs"
		, await readFile("tests/helpers/inherited-checked-record-rust-model.rs"));
	await saveLakeFile(root, "consumer/Cargo.toml", `[package]\nname = "inherited-consumer"\nversion = "0.0.0"\nedition = "2021"\n\n[features]\nresult-only = []\nreviewed = []\n\n[dependencies]\ninheritedcheckedrecords = { path = "../model" }\n`);
	const caller = await inheritedCheckedRecordRustCaller("ordinary");
	await saveLakeFile(root, "consumer/src/main.rs", caller);
	const binary = join(root, "target/debug/inherited-consumer");
	let rejected = 0;
	for(const mode of inheritedCheckedRecordRustModes)
		for(const route of inheritedCheckedRecordRustRoutes)
		{
			const features = inheritedCheckedRecordRustFeatures(route, mode);
			const build = await run(join(toolchain, "bin/cargo"), [
				"build", "--offline", "--quiet"
				, ...features.length ? ["--features", features.join(",")] : []
			]);
			assert.equal(build.status, 0, build.stderr);
			assert.equal(build.stderr, "");
			const prefix = {
				INHERITED_RUST_PREFIX: route === "reviewed" ? "value" : "arg"
			};
			const baseline = await run(binary, [], prefix);
			assert.equal(baseline.status, 0, baseline.stderr);
			assert.equal(baseline.stderr, "");
			parseInheritedCheckedRecordRustResult(baseline.stdout, mode);
			const faults = [
				...inheritedCheckedRecordRustFaults.result
				, ...mode === "full" ? inheritedCheckedRecordRustFaults.input : []
			];
			for(const fault of faults)
			{
				const changed = await run(binary, [], {
					...prefix, INHERITED_RUST_FAULT: fault
				});
				assert.equal(changed.status, 101, `${route}/${mode}/${fault}`);
				assert.equal(changed.stdout, "", fault);
				assert.match(changed.stderr, /failed: /u, fault);
				rejected++;
			}
			if(mode === "full")
			{
				const swapped = await run(binary, [], {
					INHERITED_RUST_PREFIX: route === "reviewed" ? "arg" : "value"
				});
				assert.equal(swapped.status, 101);
				assert.match(swapped.stderr, /failed: exact refusal/u);
				rejected++;
			}
		}
	assert.equal(await readFile(join(root, "consumer/src/main.rs"), "utf8"), caller);
	t.diagnostic(`${rejected} incorrect inherited Rust models rejected; no installed Lean crate executed`);
	complete = true;
});
