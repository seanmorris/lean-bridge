/**
 * Independent native layouts, bounded Rust graph conversions and RAII failures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedRustGraphConversions } from "../src/backends/rust/copied-graph-conversions.mjs";
import { generateCopiedCGraphTypes } from "../src/backends/c/copied-graph-layout.mjs";
import { copiedRustLock } from "../src/backends/rust/copied-values.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";

const conversionIr = () => {
	const ir = nativeRecursiveReviewedIr(), template = ir.types.find(type => type.name === "Scalars");
	for(const [name, constructor] of [["Link", "option"], ["ResultLink", "result"]])
	{
		const root = { kind: "named", id: `lean:Recursive.${name}` };
		ir.types.push({
			...template
			, id: root.id
			, name
			, fields: [{ ...template.fields[0], name: "next"
				, type: { kind: "apply", constructor, arguments: [root, ...constructor === "result" ? [{ kind: "primitive", name: "string" }] : []] } }] });
		const fn = ir.declarations[0];
		ir.declarations.push({
			...structuredClone(fn)
			, id: `lean:Recursive.echo${name}`
			, name: `echo${name}`
			, overloadKey: `echo${name}`
			, parameters: [{ ...fn.parameters[0], type: root }]
			, result: { ...fn.result, type: root } });
	}
	return ir;
};

test("recorded Rust graph evidence matches generated sources without claiming installed support", async () => {
	const evidence = JSON.parse(await readFile("docs/evidence/rust-recursive-conversions-20260923.json", "utf8"));
	assert.equal(evidence.planNode, 1219); assert.equal(evidence.installedPackage, false);
	for(const [path, hash] of Object.entries(evidence.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	const isolated = generateCopiedRustGraphConversions(conversionIr());
	assert.equal(sha256(isolated.source), evidence.conversions.sourceSha256);
	assert.equal(sha256(isolated.valuesSource), evidence.conversions.valuesSha256);
	assert.equal(evidence.conversions.compiledLean, false); assert.equal(evidence.conversions.installedPackage, false);
	assert.equal(evidence.conversions.layoutChecks, 478); assert.equal(evidence.conversions.checkpoints, 159);
	assert.equal(evidence.values.tests, 6); assert.equal(evidence.values.rejections.length, 5);
	assert.equal(evidence.conversions.tests, 8);
	assert.equal(evidence.native.compiledLean, true); assert.equal(evidence.native.installedPackage, false);
	assert.deepEqual(evidence.native.observations.map(item => item.reviewed), [false, true]);
	const compiledIr = nativeRecursiveReviewedIr();
	// Fresh semantic models order declarations by compiler identity. The
	// independent authored fixture deliberately retains its selection order.
	compiledIr.declarations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	const compiled = generateCopiedRustGraphConversions(compiledIr);
	for(const item of evidence.native.observations)
	{
		assert.equal(item.rustSourceSha256, sha256(compiled.source));
		assert.equal(item.rustValuesSha256, sha256(compiled.valuesSource));
		assert.equal(item.exports, 18);
		assert.deepEqual(item.scenarios.map(value => value.mode), ["carrier", "raw", "during"]);
		for(const scenario of item.scenarios)
		{
			assert.equal(scenario.checks, 784);
			assert.equal(scenario.nativeCheckpoints, 26); assert.equal(scenario.rustCheckpoints, 70);
			assert.match(scenario.stdout, /1 passed; 0 failed/);
		}
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_RUST_GRAPH_NATIVE_TEST=1 node --test --test-name-pattern='ordinary and reviewed Lean graphs'/);
	for(const name of ["rust-values", "rust-conversions", "rust-native"])
	{
		assert.ok(workflow.includes(`test -s build/recursive/${name}.json`));
		assert.ok(workflow.includes(`            build/recursive/${name}.json\n`));
	}
});

test("Rust graph conversions keep raw Bool/Unit/Char bytes separate from valid Rust values", () => {
	const ir = conversionIr(), before = structuredClone(ir), generated = generateCopiedRustGraphConversions(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedRustGraphConversions(ir), generated);
	const node = name => generated.rawTypes.find(item => generated.layout.nodes.find(node => node.id === item.id).ref.name === name);
	assert.equal(node("bool").name, "u8"); assert.equal(node("unit").name, "u8"); assert.equal(node("char").name, "u32");
	assert.match(generated.source, /char::from_u32/); assert.match(generated.source, /value\.negative > 1/);
	assert.equal(generated.inputTypes.find(item => item.id === node("string").id).name, "str");
	assert.equal(generated.inputTypes.find(item => item.id === node("bytes").id).name, "[u8]");
	assert.match(generated.source, /fn graph_call_units\([^\n]+arg0: &\[\(\)\]/);
	assert.match(generated.source, /count\.checked_mul/); assert.match(generated.source, /address\.checked_add/);
	const call = generated.source.slice(generated.source.indexOf("unsafe fn graph_call_join_trees"));
	assert.ok(call.indexOf("graph_check") < call.indexOf("GraphScope::new"));
	assert.ok(call.indexOf("GraphScope::new") < call.indexOf("invoke("));
	assert.match(call, /GraphOutput/);
});

test("Rust graph conversions agree with C layout and recover from allocation, unwinding and malformed results", { skip: process.env.LEAN_BRIDGE_RUST_GRAPH_TEST !== "1", timeout: 180_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-rust-graph-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = conversionIr(), generated = generateCopiedRustGraphConversions(ir);
	const raw = new Map(generated.rawTypes.map(node => [node.id, node]));
	const aliases = ["Scalars", "Tree", "Spine", "Envelope", "Marker", "EmptyRecord", "Link", "ResultLink"].map(name => {
		const node = generated.layout.nodes.find(node => node.ref.id === `lean:Recursive.${name}`);
		return `type ${name}Raw = ${raw.get(node.id).name};`;
	});
	aliases.push(`type UnitsRaw = ${raw.get(generated.layout.roots.find(root => root.name === "recursive_units").result).name};`);
	const cLayout = [], rustLayout = [];
	for(const node of generated.layout.nodes)
	{
		const rn = raw.get(node.id).name;
		cLayout.push(`sizeof(${node.name})`, `_Alignof(${node.name})`);
		rustLayout.push(`std::mem::size_of::<${rn}>()`, `std::mem::align_of::<${rn}>()`);
		if(!node.aggregate) continue;
		const offsets = [["_bridge_owner", "owner"], ["_bridge_release", "release"]];
		if(node.kind === "primitive" || node.element) offsets.push(["data", "data"], ["length", "length"]);
		if(node.ref.name === "int") offsets.push(["negative", "negative"]);
		if(node.kind === "variant") offsets.push(["kind", "kind"], ["cases", "cases"]);
		if(node.kind === "option") offsets.push(["has_value", "has_value"]);
		if(node.kind === "result") offsets.push(["is_ok", "is_ok"]);
		for(const [j, field] of node.fields.entries()) offsets.push([field.name, `field${j}`]);
		for(const [cn, name] of offsets)
		{ cLayout.push(`offsetof(${node.name}, ${cn})`); rustLayout.push(`std::mem::offset_of!(${rn}, ${name})`); }
		for(const [j, branch] of node.cases.entries()) for(const [k, field] of branch.fields.entries())
		{
			cLayout.push(`offsetof(${node.name}, cases.${branch.name}.${field.name})`);
			rustLayout.push(`std::mem::offset_of!(${rn}, cases) + std::mem::offset_of!(GraphCase${raw.get(node.id).index}_${j}, field${k})`);
		}
	}
	const layoutTest = `#[test] fn raw_layout_matches_c() { let expected = [${rustLayout.join(", ")}];
assert_eq!(unsafe { graph_fixture_layout_count() }, expected.len());
for (i, size) in expected.into_iter().enumerate() { assert_eq!(unsafe { graph_fixture_layout(i) }, size, "layout item {}", i); } }
unsafe extern "C" { fn graph_fixture_layout_count() -> usize; fn graph_fixture_layout(index: usize) -> usize; }
`;
	const probe = await readFile("tests/fixtures/structured-types/recursive-conversions.rs", "utf8");
	const native = await readFile("tests/fixtures/structured-types/recursive-rust-native.c", "utf8");
	await saveLakeFile(root, "include/recursive.h", generateCopiedCGraphTypes(ir).header);
	await saveLakeFile(root, "native.c", `#include "recursive.h"\n${native}\nstatic const size_t layout[] = {${cLayout.join(", ")}};\nsize_t graph_fixture_layout_count(void) { return sizeof(layout)/sizeof(*layout); }\nsize_t graph_fixture_layout(size_t index) { return layout[index]; }\n`);
	await saveLakeFile(root, "Cargo.toml", '[package]\nname="recursive-conversions"\nversion="1.0.0"\nedition="2021"\n[dependencies]\nnum-bigint="=0.4.6"\nsha2="=0.10.9"\n[profile.dev]\ndebug=0\nincremental=false\n');
	await saveLakeFile(root, "Cargo.lock", await copiedRustLock("recursive-conversions", "1.0.0"));
	await saveLakeFile(root, "src/lib.rs", generated.valuesSource + "\nmod native;\n");
	await saveLakeFile(root, "src/native.rs", generated.source + `\n#[cfg(test)] mod tests { use super::*;\n${aliases.join("\n")}\n${layoutTest}\n${probe}\n}`);
	const environment = nativeFixtureEnvironment(["rust"]), env = { ...environment
		, RUSTC: environment.LEAN_BRIDGE_RUSTC
		, RUSTFLAGS: `-Dwarnings -Lnative=${root} -lstatic=graph_fixture`
		, CARGO_NET_OFFLINE: "true"
		, CARGO_INCREMENTAL: "0"
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
		, CARGO_TARGET_DIR: join(root, "target") };
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: root, env, timeoutMs: 120_000 })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	await run("cc", ["-std=c11", "-O1", "-Wall", "-Wextra", "-Werror", "-Iinclude", "-c", "native.c", "-o", "native.o"]);
	await run("ar", ["rcs", "libgraph_fixture.a", "native.o"]);
	const result = await run(environment.LEAN_BRIDGE_CARGO, ["test", "--offline", "--locked", "--lib", "--", "--nocapture", "--test-threads=1"]);
	assert.match(result.stdout, /8 passed; 0 failed/);
	const checkpoints = Number(result.stdout.match(/graph-failure-checkpoints:(\d+)/)?.[1]); assert.ok(checkpoints > 30);
	await saveLakeFile("build/recursive", "rust-conversions.json", canonicalJson({
		schemaVersion: 1
		, compiledLean: false
		, installedPackage: false
		, tests: 8
		, layoutChecks: cLayout.length
		, checkpoints
		, stdout: result.stdout
		, sourceSha256: sha256(generated.source)
		, valuesSha256: sha256(generated.valuesSource)
		, probeSha256: sha256(probe)
		, nativeSha256: sha256(native) }));
});

test("ordinary and reviewed Lean graphs execute through Rust with cleanup and permanent retirement", {
	skip: process.env.LEAN_BRIDGE_RUST_GRAPH_NATIVE_TEST !== "1", timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-rust-native-graphs-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkRustNativeGraphs } = await import("./helpers/rust-native-graphs.mjs");
	const report = await checkRustNativeGraphs(root);
	assert.equal(report.observations.length, 2);
	for(const item of report.observations)
	{
		assert.equal(item.exports, 18); assert.equal(item.scenarios.length, 3);
		for(const scenario of item.scenarios) assert.ok(scenario.checks > 100);
	}
	await saveLakeFile("build/recursive", "rust-native.json", canonicalJson(report));
});
