/**
 * Rust source/runtime controls use actual generated embedded assets and the unmodified Rust loader.
 * They do not replace the separately required installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, link, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { copiedRustLock, generateCopiedRustPackage } from "../src/backends/rust/copied-values.mjs";
import { compileFinContainerEdgeSplitFixture, finContainerEdgeCompilerModel } from "./helpers/fin-container-edge-compiled-fixture.mjs";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeWireSymbols } from "./helpers/fin-container-edge-dispatch.mjs";
import { finContainerEntryInitializer } from "./helpers/fin-container-entry-dispatch.mjs";
import { finContainerEdgeDefinitions } from "./helpers/fin-container-edge-observer.mjs";
import { finContainerEdgeRustExpected, finContainerEdgeRustProbe, readFinContainerEdgeRust } from "./helpers/fin-container-edge-rust.mjs";
import { finContainerEdgeRustInterposer } from "./helpers/fin-container-edge-rust-loader.mjs";
import { finContainerEdgeConsumer } from "./helpers/fin-container-edges.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const text = rows => rows.map(([step, method, status, counts]) => `edge-rust ${step} ${method} ${status} ${counts.join(" ")}\n`).join("") + "fin-container-ok:14078\n";
const totals = [[1001, 1003], [1001, 1003], [1001, 1003], [1003, 1003], [1003, 1004], [1003, 1010]];

test("Rust expected calls include all representable edge cases and all six thousand recovery pairs", () => {
	assert.equal(finContainerEdgeRustExpected.length, 12038);
	assert.deepEqual(finContainerEdgeRustExpected.at(-1)[3], [1003, 1003, 1001, 1001, 1001, 1003, 1003, 1003]);
	for(const [index, method] of finContainerEdgeEntries.entries())
	{
		const rows = finContainerEdgeRustExpected.filter(row => row[1] === method);
		assert.deepEqual([0, 1].map(status => rows.filter(row => row[2] === status).length), totals[index], method);
	}
	assert.throws(() => { finContainerEdgeRustExpected[0][3][0]++; });
});

test("Rust transcript refuses altered, missing or reordered calls even with compensated totals", () => {
	const valid = text(finContainerEdgeRustExpected);
	assert.deepEqual(readFinContainerEdgeRust(valid), finContainerEdgeRustExpected);
	for(const mutate of [
		rows => { rows[1][3][0]++; }
		, rows => { rows[0][3][6]--; }
		, rows => { rows[1][2] = 0; }
		, rows => { rows[0][1] = "flatten"; }
		, rows => { [rows[0], rows[1]] = [rows[1], rows[0]]; }
		, rows => { rows.pop(); }
		, rows => { rows.push(rows.at(-1)); }
		, rows => { rows.at(-1)[3][5]--; }
	]) {
		const rows = structuredClone(finContainerEdgeRustExpected); mutate(rows);
		assert.throws(() => readFinContainerEdgeRust(text(rows)), assert.AssertionError);
	}
	for(const changed of [valid.trimEnd(), valid + "\n", valid.replace("fin-container-ok:14078", "fin-container-ok:2027"), valid.replace(" 1 present", " 01 present")])
		assert.throws(() => readFinContainerEdgeRust(changed), assert.AssertionError);
});

test("Rust instrumentation preserves the original consumer and requires a closed library/definition map", async () => {
	const model = finContainerEdgeCompilerModel(), columns = finContainerEdgeColumns(model, model.component);
	const original = await finContainerEdgeConsumer("rust"), source = await finContainerEdgeRustProbe(model, model.component);
	assert.ok(source.endsWith(original.slice(original.indexOf("    let mut checks"))));
	assert.ok(source.includes(original.slice(original.indexOf("use api::{BigUint, Error};"), original.indexOf("fn main() {"))));
	const symbols = [...columns, "lean_bridge_native_component_initialize", finContainerEntryInitializer(model.component.id), ...finContainerEdgeWireSymbols];
	const libraries = ["/verified/lib/libcomponent.so"], definitions = Object.fromEntries(symbols.map(symbol => [symbol, libraries[0]]));
	for(const mutate of [
		value => { delete value.definitions[columns[0]]; }
		, value => { value.definitions.unknown = libraries[0]; }
		, value => { value.definitions[columns[0]] = "/foreign/libcomponent.so"; }
		, value => { value.libraries.push(libraries[0]); }
		, value => { value.libraries.push("/other/lib/another.so"); }
		, value => { value.libraries[0] = "relative.so"; }
		, value => { value.libraries[0] += "\0"; }
	]) {
		const changed = structuredClone({ libraries, definitions }); mutate(changed);
		assert.throws(() => finContainerEdgeRustInterposer(model, model.component, changed), assert.AssertionError);
	}
	const instrument = finContainerEdgeRustInterposer(model, model.component, { libraries, definitions });
	assert.ok(instrument.includes("RTLD_DI_LINKMAP"));
	assert.ok(instrument.includes("equal_files(path, libraries[owner])"));
	assert.ok(instrument.includes("RTLD_NOLOAD"));
	assert.doesNotMatch(instrument, /\b(unlink|remove|rename)\(/u);
});

test("full Rust consumer measures actual Lean through verified extracted-and-unlinked libraries", { skip: process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST !== "1" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-rust-public-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const { model, environment, prefix } = await compileFinContainerEdgeSplitFixture(root, lean);
	const crate = join(root, "package"), directory = join(crate, "native/linux-x64");
	await mkdir(directory, { recursive: true });
	const libraries = {};
	for(const name of ["libedge-source.so", "liblean_bridge_native.so", "libleanshared.so", "libleanshared_1.so", "libleanshared_2.so"])
	{
		const path = join(name.startsWith("libleanshared") ? join(prefix, "lib/lean") : root, name);
		await copyFile(path, join(directory, name)); libraries[name] = sha256(await readFile(path));
	}
	const evidence = { componentId: model.component.id, runtimeIdentity: sha256("synthetic source-test Rust runtime"), componentReceiptSha256: sha256("synthetic source-test component identity"), library: "libedge-source.so", libraries };
	for(const [path, source] of Object.entries(generateCopiedRustPackage(model.bindingIr, evidence, { name: "fincontainers", version: "1.0.0" })))
		await saveLakeFile(crate, path, source);
	await saveLakeFile(crate, "Cargo.lock", await copiedRustLock("fincontainers", "1.0.0"));
	await saveLakeFile(root, "Cargo.toml", '[package]\nname="fin-edge-public-rust"\nversion="0.0.0"\nedition="2021"\n[dependencies]\nfincontainers={path="package"}\n[profile.dev]\ndebug=0\nincremental=false\n');
	const source = await finContainerEdgeRustProbe(model, model.component);
	await saveLakeFile(root, "src/main.rs", source);
	const cargo = resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo"), rustc = resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc");
	await runCopied(cargo, ["build", "--offline", "--quiet"], root, { ...process.env, RUSTC: rustc, RUSTFLAGS: "-D warnings", CARGO_NET_OFFLINE: "true", CARGO_TARGET_DIR: join(root, "target") });
	const command = join(root, "target/debug/fin-edge-public-rust"), columns = finContainerEdgeColumns(model, model.component);
	const definitions = await finContainerEdgeDefinitions({ model, columns, directory, libraries }, { publicWire: true });
	const identity = { definitions, libraries: Object.keys(libraries).map(name => join(directory, name)) };
	const instrument = finContainerEdgeRustInterposer(model, model.component, identity);
	await saveLakeFile(root, "interposer.c", instrument);
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC"];
	const compile = name => runCopied("/usr/bin/cc", [...strict, `${name}.c`, "-ldl", "-o", `${name}.so`], root, environment);
	await compile("interposer");
	const registry = async () => (await readdir("/tmp")).filter(name => /^lean-bridge-rust-(?:v1|assets)-/u.test(name)).sort();
	const before = await registry();
	await assert.rejects(() => runCopied(command, [], root, copiedCleanEnvironment)
		, error => /exited with status 2:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === "edge interposer is not loaded\n");
	const runtime = { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1", LD_PRELOAD: join(root, "interposer.so") };
	const observed = await runCopied(command, [], root, runtime);
	assert.equal(observed.stderr, ""); assert.deepEqual(readFinContainerEdgeRust(observed.stdout), finContainerEdgeRustExpected);
	const repeat = await runCopied(command, [], root, runtime);
	assert.equal(repeat.stdout, observed.stdout); assert.equal(repeat.stderr, "");
	assert.deepEqual(await registry(), before, "normal loader cleanup remains unchanged");
	for(const [label, from, to, status, message] of [
		["missing-adapter", "++counts[6];", "/* omitted adapter */", 5, "wrong Rust edge dispatch count"]
		, ["missing-source", "++counts[0];", "/* omitted source */", 5, "wrong Rust edge dispatch count"]
		, ["extra-source", "++counts[2];", "++counts[2]; ++counts[0];", 5, "wrong Rust edge dispatch count"]
		, ["nonzero", "static unsigned long counts[8];", "static unsigned long counts[8] = {1};", 3, "edge counters or bindings are not initially empty"]
		, ["incomplete", "loaded[owner] = 1;", "loaded[owner] = 0;", 4, "Rust edge library identities are incomplete"]
	]) {
		assert.equal(instrument.split(from).length, 2);
		await saveLakeFile(root, `${label}.c`, instrument.replace(from, to)); await compile(label);
		await assert.rejects(() => runCopied(command, [], root, { ...runtime, LD_PRELOAD: join(root, `${label}.so`) })
			, error => error.message.includes(`exited with status ${status}:`) && error.details.stderr === `${message}\n`, label);
		assert.deepEqual(await registry(), before, label);
	}
	const badOwner = { ...identity, definitions: { ...definitions, [columns[0]]: join(directory, "liblean_bridge_native.so") } };
	await saveLakeFile(root, "foreign-next.c", `void *${columns[0]}(void *argument) { return argument; }\n`); await compile("foreign-next");
	await assert.rejects(() => runCopied(command, [], root, { ...runtime, LD_PRELOAD: `${join(root, "interposer.so")}:${join(root, "foreign-next.so")}` })
		, error => /exited with status 6:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === `unexpected Rust edge target: ${columns[0]}\n`);
	assert.deepEqual(await registry(), before);
	await saveLakeFile(root, "foreign-owner.c", finContainerEdgeRustInterposer(model, model.component, badOwner)); await compile("foreign-owner");
	await assert.rejects(() => runCopied(command, [], root, { ...runtime, LD_PRELOAD: join(root, "foreign-owner.so") })
		, error => /exited with status 101:/u.test(error.message) && error.details.stdout === "" && /Rust edge library identity refused/u.test(error.details.stderr));
	assert.deepEqual(await registry(), before);
	const wrongDirectory = join(root, "wrong-libraries"); await mkdir(wrongDirectory);
	for(const name of Object.keys(libraries))
	{
		if(name === "libedge-source.so") await saveLakeFile(wrongDirectory, name, Buffer.concat([await readFile(join(directory, name)), Buffer.from("changed")]));
		else await link(join(directory, name), join(wrongDirectory, name));
	}
	const changedIdentity = { libraries: identity.libraries.map(path => join(wrongDirectory, basename(path))), definitions: Object.fromEntries(Object.entries(definitions).map(([symbol, path]) => [symbol, join(wrongDirectory, basename(path))])) };
	await saveLakeFile(root, "changed-bytes.c", finContainerEdgeRustInterposer(model, model.component, changedIdentity)); await compile("changed-bytes");
	await assert.rejects(() => runCopied(command, [], root, { ...runtime, LD_PRELOAD: join(root, "changed-bytes.so") })
		, error => /exited with status 101:/u.test(error.message) && error.details.stdout === "" && /Rust edge library identity refused/u.test(error.details.stderr));
	assert.deepEqual(await registry(), before);
	for(const [name, digest] of Object.entries(libraries)) assert.equal(sha256(await readFile(join(directory, name))), digest);
	t.diagnostic(JSON.stringify({ scope: "actual Rust compiler/runtime source gate, not installed-package acceptance"
		, checks: 14078, measuredCalls: 12038
		, columns, finalCounts: finContainerEdgeRustExpected.at(-1)[3]
		, probeSha256: sha256(source), interposerSha256: sha256(instrument)
		, stdoutSha256: sha256(observed.stdout), extractionCleanupUnchanged: true }));
});
