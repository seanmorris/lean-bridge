/**
 * Source-only controls for recursive checked-record Rust packages. No compiled Lean
 * library or installed crate executes here; the immutable caller runs against a model.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { generateCopiedRustGraphPackage } from "../../src/backends/rust/copied-graph-package.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { mutualCheckedRecordConfiguration } from "./mutual-checked-record-fixture.mjs";
import { recursiveCheckedRecordConfiguration } from "./recursive-checked-record-fixture.mjs";
import {
	loadRecursiveCheckedRecordRustCaller, parseRecursiveCheckedRecordRustResult
	, recursiveCheckedRecordRustConfiguration, recursiveCheckedRecordRustCounts
	, recursiveCheckedRecordRustFeatures, recursiveCheckedRecordRustFixtures
	, recursiveCheckedRecordRustPackage, recursiveCheckedRecordRustReview
	, recursiveCheckedRecordRustRoutes, recursiveCheckedRecordRustSelection
} from "./recursive-checked-record-rust-fixture.mjs";
import { assertRecursiveCheckedRecordRustResources } from "./recursive-checked-record-rust-resources.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const toolchain = process.env.LEAN_BRIDGE_RUST_TOOLCHAIN ?? resolve(".toolchains/rust-1.90.0");
const cargoHome = process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied");
const callerControls = existsSync(join(toolchain, "bin/cargo")) && existsSync(join(cargoHome, "registry"));
const base = { recursive: recursiveCheckedRecordConfiguration, mutual: mutualCheckedRecordConfiguration };
const functions = ["first", "second", "echo", "groups", "echo_groups", "produce"];

export const recursiveCheckedRecordRustFaults = Object.freeze([
	"produce-offset", "produce-single", "produce-digits", "missing-fin"
	, "missing-normalization", "conflated-constructor", "diagnostic-suffix"
	, "wrong-status", "wrong-error-kind", "wrong-path", "root-only"
	, "echo-drops-tail", "depth-unbounded", "limit-as-native"
	, "groups-drop-none", "echo-groups-drops-none", "poison-after-reject"
]);
export const recursiveCheckedRecordRustModuleFaults = Object.freeze({
	recursive: Object.freeze(["second-normalizes-root-only"])
	, mutual: Object.freeze(["stop-as-none"])
});

const generatedFiles = fixture => generateCopiedRustGraphPackage(
	recursiveCheckedRecordRustReview(fixture), null
	, { ...recursiveCheckedRecordRustPackage(fixture), metadata: {} }
	, { refinementDiagnostics: true },
);

test("recursive checked-record Rust keeps both author contracts and exact recursive carriers", async () => {
	const caller = await loadRecursiveCheckedRecordRustCaller();
	for(const route of recursiveCheckedRecordRustRoutes)
		for(const fixture of recursiveCheckedRecordRustFixtures)
		{
			const expected = base[fixture](route);
			const actual = recursiveCheckedRecordRustConfiguration(route, fixture);
			validateExportConfiguration(actual);
			assert.deepEqual({ ...actual, targets: expected.targets }, expected);
			const pkg = recursiveCheckedRecordRustPackage(fixture);
			assert.deepEqual(actual.targets, { cargo: { name: pkg.name, version: pkg.version } });
			const review = recursiveCheckedRecordRustReview(fixture), before = structuredClone(review);
			validateBindingIr(review);
			const files = generatedFiles(fixture), source = files["src/lib.rs"];
			assert.deepEqual(review, before);
			assert.deepEqual([...source.matchAll(/^pub fn (\w+)\(/gmu)].map(match => match[1]), functions);
			assert.match(source, /pub enum Error \{\n {4}Limit,\n {4}Allocation,\n {4}InvalidNative,/u);
			const diagnostic = `${pkg.name}_graph_error`;
			assert.equal(files["src/__runtime.rs"].split(diagnostic).length - 1, 1);
			assert.match(files["src/__runtime.rs"], new RegExp(
				`diagnostic: symbol!\\("${diagnostic}"`, "u"));
			if(fixture === "recursive")
			{
				assert.match(source, /pub struct Packet \{\n {4}pub value: BigUint,\n {4}pub digit: BigUint,\n {4}pub tail: [^,]+,\n\}/u);
				assert.match(source, /pub type PacketAlias = Packet;/u);
				assert.match(source, /pub type Graph[^ ]+ = Option<Box<Packet>>;/u);
			}
			else
			{
				assert.match(source, /pub struct Envelope \{\n {4}pub value: BigUint,\n {4}pub mode: BigUint,\n {4}pub next: Option<Box<Step>>,\n\}/u);
				assert.match(source, /pub enum Step \{\n {4}Stop,\n {4}More \{ packet: Box<Envelope> \},\n\}/u);
				assert.match(source, /pub type EnvelopeAlias = Envelope;/u);
			}
			assert.deepEqual(recursiveCheckedRecordRustFeatures(route, fixture), [
				...fixture === "mutual" ? ["mutual"] : []
				, ...route === "reviewed" ? ["reviewed"] : []
			]);
			const counts = recursiveCheckedRecordRustCounts[fixture];
			assert.deepEqual(parseRecursiveCheckedRecordRustResult(JSON.stringify(counts), fixture), counts);
			for(const key of Object.keys(counts).filter(key => key !== "module"))
				assert.throws(() => parseRecursiveCheckedRecordRustResult(
					JSON.stringify({ ...counts, [key]: counts[key] + 1 }), fixture));
			assert.throws(() => parseRecursiveCheckedRecordRustResult(
				JSON.stringify({ ...counts, extra: true }), fixture));
		}
	assert.equal(await loadRecursiveCheckedRecordRustCaller(), caller);
	assert.throws(() => recursiveCheckedRecordRustConfiguration("unknown", "recursive"));
	assert.throws(() => recursiveCheckedRecordRustConfiguration("ordinary", "unknown"));
	assert.throws(() => recursiveCheckedRecordRustFeatures("ordinary", "unknown"));
	assert.throws(() => recursiveCheckedRecordRustPackage("unknown"));
	assert.throws(() => parseRecursiveCheckedRecordRustResult("{}", "unknown"));
});

test("recursive checked-record Rust gates close selections and resource ceilings", () => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUST_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(recursiveCheckedRecordRustSelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"]
		, fixtures: ["recursive", "mutual"], maxLoad: 8
	});
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => recursiveCheckedRecordRustSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["FIXTURES", "mutual"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => recursiveCheckedRecordRustSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => recursiveCheckedRecordRustSelection({ [prefix + "TEST"]: flag
				, [prefix + name]: valid }));
	}
	for(const maxLoad of [8, 12, 16, 20])
		assert.equal(recursiveCheckedRecordRustSelection({ ...enabled
			, [prefix + "MAX_LOAD"]: String(maxLoad) }).maxLoad, maxLoad);
	for(const maxLoad of ["", "6", "10", "24", "Infinity", "eight", null])
		assert.throws(() => recursiveCheckedRecordRustSelection({ ...enabled
			, [prefix + "MAX_LOAD"]: maxLoad }));
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		for(const flag of [undefined, "0"])
			assert.throws(() => recursiveCheckedRecordRustSelection({ [prefix + "TEST"]: flag
				, [name]: "explicit" }));
	const GiB = 1024 ** 3, admitted = { freeBytes: 3 * GiB, availableBytes: 4 * GiB, load: 7.5 };
	assertRecursiveCheckedRecordRustResources({ observations: [admitted], waits: 0 }, 8);
	assertRecursiveCheckedRecordRustResources({ observations: [{ ...admitted, load: 20.5 }, admitted]
		, waits: 1 }, 20);
	for(const changed of [
		{ observations: [{ ...admitted, freeBytes: GiB }], waits: 0 }
		, { observations: [{ ...admitted, availableBytes: GiB }], waits: 0 }
		, { observations: [{ ...admitted, load: 8 }], waits: 0 }
		, { observations: [admitted], waits: 1 }
		, { observations: [admitted], waits: 0, extra: true }
	]) assert.throws(() => assertRecursiveCheckedRecordRustResources(changed, 8));
});

test("recursive checked-record Rust caller detects model faults on all four selections", { skip: !callerControls, timeout: 900_000 }, async t => {
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-rust-model-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed recursive Rust model inputs: ${root}`);
		});
		const commands = [], environment = {
			PATH: `${join(toolchain, "bin")}:/usr/bin:/bin`, LC_ALL: "C", HOME: root
			, CARGO_HOME: cargoHome, CARGO_TARGET_DIR: join(root, "target")
			, RUSTFLAGS: "-D warnings"
		};
		const run = async (command, args, extra = {}, cwd = join(root, "consumer")) => {
			const env = { ...environment, ...extra };
			const result = spawnSync(command, args, {
				cwd, env, encoding: "utf8", maxBuffer: 16 * 1024 ** 2, timeout: 600_000
			});
			const { status, signal, stdout, stderr } = result;
			commands.push({ command, args, environment: env, status, signal, stdout, stderr });
			await saveLakeFile(root, "commands.json", canonicalJson(commands));
			assert.equal(result.error, undefined);
			assert.equal(result.signal, null);
			return commands.at(-1);
		};
		await saveLakeFile(root, "model/Cargo.toml", `[package]\nname = "recursive-checked-record-model"\nversion = "0.0.0"\nedition = "2021"\n\n[features]\nmutual = []\n\n[dependencies]\nnum-bigint = "=0.4.6"\n`);
		await saveLakeFile(root, "model/src/lib.rs"
			, await readFile("tests/helpers/recursive-checked-record-rust-model.rs"));
		await saveLakeFile(root, "consumer/Cargo.toml", `[package]\nname = "recursive-checked-record-consumer"\nversion = "0.0.0"\nedition = "2021"\n\n[features]\nmutual = ["checkedrecords/mutual"]\nreviewed = []\n\n[dependencies]\ncheckedrecords = { package = "recursive-checked-record-model", path = "../model" }\n`);
		const caller = await loadRecursiveCheckedRecordRustCaller();
		await saveLakeFile(root, "consumer/src/main.rs", caller);
		const binary = join(root, "target/debug/recursive-checked-record-consumer");
		let rejected = 0;
		for(const fixture of recursiveCheckedRecordRustFixtures)
			for(const route of recursiveCheckedRecordRustRoutes)
			{
				const features = recursiveCheckedRecordRustFeatures(route, fixture);
				const build = await run(join(toolchain, "bin/cargo"), [
					"build"
					, "--offline"
					, "--quiet"
					, ...features.length ? ["--features", features.join(",")] : []]);
				assert.equal(build.status, 0, build.stderr);
				assert.equal(build.stderr, "");
				const baseline = await run(binary, []);
				assert.equal(baseline.status, 0, baseline.stderr);
				assert.equal(baseline.stderr, "");
				parseRecursiveCheckedRecordRustResult(baseline.stdout, fixture);
				for(const fault of [...recursiveCheckedRecordRustFaults
					, ...recursiveCheckedRecordRustModuleFaults[fixture]]) {
					const changed = await run(binary, [], { RECURSIVE_RUST_FAULT: fault });
					assert.equal(changed.status, 101, `${fixture}/${route}/${fault}`);
					assert.equal(changed.stdout, "", fault);
					assert.match(changed.stderr, /failed: /u, fault);
					rejected++;
					}
			}
		assert.equal(await readFile(join(root, "consumer/src/main.rs"), "utf8"), caller);
		t.diagnostic(`${rejected} incorrect recursive Rust models rejected; no installed Lean crate executed`);
		complete = true;
});

test("recursive checked-record Rust caller type-checks against generated crates and rejects malformed safe-Rust values", { skip: !callerControls, timeout: 900_000 }, async t => {
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-rust-surface-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed recursive Rust surface inputs: ${root}`);
		});
		const environment = {
			PATH: `${join(toolchain, "bin")}:/usr/bin:/bin`, LC_ALL: "C", HOME: root
			, CARGO_HOME: cargoHome, CARGO_TARGET_DIR: join(root, "target")
			, RUSTFLAGS: "-D warnings"
		};
		const cargo = (args, cwd) => spawnSync(join(toolchain, "bin/cargo"), args, {
			cwd
			, env: environment
			, encoding: "utf8"
			, maxBuffer: 16 * 1024 ** 2
			, timeout: 600_000
		});
		const caller = await loadRecursiveCheckedRecordRustCaller();
		for(const fixture of recursiveCheckedRecordRustFixtures)
		{
			const generated = join(root, `generated-${fixture}`);
			for(const [path, source] of Object.entries(generatedFiles(fixture)))
				await saveLakeFile(generated, path, source);
			const consumer = join(root, `consumer-${fixture}`), pkg = recursiveCheckedRecordRustPackage(fixture);
			await saveLakeFile(consumer, "Cargo.toml", `[package]\nname = "surface-${fixture}"\nversion = "0.0.0"\nedition = "2021"\n\n[features]\nmutual = []\nreviewed = []\n\n[dependencies]\ncheckedrecords = { package = "${pkg.name}", path = "../generated-${fixture}" }\n`);
			await saveLakeFile(consumer, "src/main.rs", caller);
			const features = recursiveCheckedRecordRustFeatures("reviewed", fixture);
			const checked = cargo([
				"check"
				, "--offline"
				, "--quiet"
				, ...features.length ? ["--features", features.join(",")] : []], consumer);
			assert.equal(checked.error, undefined);
			assert.equal(checked.signal, null);
			assert.equal(checked.status, 0, checked.stderr);
			assert.equal(checked.stderr, "");

			const probes = fixture === "recursive" ? [
				"use checkedrecords as api; fn main() { let _ = api::produce(&api::BigInt::from(1)); }"
				, "use checkedrecords as api; fn main() { let _ = api::Packet { value: true, digit: api::BigUint::from(0u8), tail: None }; }"
				, "use checkedrecords as api; fn main() { let mut value = api::Packet { value: 1u8.into(), digit: 0u8.into(), tail: None }; value.tail = Some(Box::new(value)); let _ = value; }"
			] : [
				"use checkedrecords as api; fn main() { let _ = api::produce(&api::BigInt::from(1)); }"
				, "use checkedrecords as api; fn main() { let _ = api::Envelope { value: true, mode: api::BigUint::from(0u8), next: None }; }"
				, "use checkedrecords as api; fn main() { let mut value = api::Envelope { value: 1u8.into(), mode: 0u8.into(), next: None }; value.next = Some(Box::new(api::Step::More { packet: Box::new(value) })); let _ = value; }"
			];
			for(const [index, probe] of probes.entries())
			{
				await saveLakeFile(consumer, "src/main.rs", probe);
				const refused = cargo([
					"check"
					, "--offline"
					, "--quiet"
					, ...features.length ? ["--features", features.join(",")] : []], consumer);
				assert.equal(refused.error, undefined);
				assert.equal(refused.signal, null);
				assert.notEqual(refused.status, 0, `${fixture} malformed probe ${index} compiled`);
			}
		}
		t.diagnostic("Generated recursive crates accept the immutable caller; safe Rust rejects wrong Nat types and owned cycles before dispatch.");
		complete = true;
});
