/**
 * Native Rust copied graph declarations, independent of Lean and FFI execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedRustGraphValues } from "../src/backends/rust/copied-graph-values.mjs";
import { copiedRustLock } from "../src/backends/rust/copied-values.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { recursiveReviewedIr } from "./helpers/recursive-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { captureRustCompiler } from "./helpers/type-corpus-rust.mjs";

const recursiveRecord = () => {
	const ir = recursiveReviewedIr(), root = { kind: "named", id: "lean:Recursive.Link" };
	const template = ir.types.find(type => type.kind === "record");
	const fields = [
		{ ...template.fields[0], name: "next", type: { kind: "apply", constructor: "option", arguments: [root] } }
		, { ...template.fields[0], name: "value", type: { kind: "primitive", name: "uint32" } }
	];
	ir.types = [{ ...template, id: root.id, name: "Link", fields }];
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = root; ir.declarations[0].result.type = root;
	return ir;
};

test("recursive Rust declarations retain nominal values, native containers and owned indirection", () => {
	const ir = recursiveReviewedIr(), before = structuredClone(ir), output = generateCopiedRustGraphValues(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedRustGraphValues(before), output);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.equal(generateCopiedRustGraphValues(reversed).source, output.source);
	assert.match(output.source, /Next \{ value: Box<Spine> \}/);
	assert.match(output.source, /pub type Graph[a-f0-9]+ = Vec<Tree>;/);
	assert.match(output.source, /pub type TreeAlias = Tree;/);
	assert.match(output.source, /pub type Graph[a-f0-9]+ = Result<Graph[a-f0-9]+, String>;/);
	assert.doesNotMatch(output.source, /unsafe|extern|serde|c_void|Rc<|Arc<|lean_object|u32 kind/);
	assert.equal(output.types.find(type => type.name === "Scalars").fields.length, 19);
	assert.throws(() => compileCopiedRustModel(ir), /recursive|Recursive/);
});

test("recursive Rust options box the nominal child without boxing both sides of the cycle", () => {
	const output = generateCopiedRustGraphValues(recursiveRecord());
	assert.match(output.source, /pub type Graph[a-f0-9]+ = Option<Box<Link>>;/);
	assert.doesNotMatch(output.source, /Box<Option/);
	assert.equal(output.types.find(type => type.name === "Link").fields[0].boxed, false);
});

test("Rust graph names reject helper and escaped-field collisions before compilation", () => {
	for(const name of ["Box", "BigUint", "std", "Graph__private", "tree", "match", "GraphLifecycle", "GraphRaw123"])
	{
		const ir = recursiveReviewedIr(); ir.types.find(type => type.name === "Scalars").name = name;
		assert.throws(() => generateCopiedRustGraphValues(ir), /name|reserved|collision/);
	}
	const ir = recursiveRecord(), fields = ir.types[0].fields;
	fields[0].name = "match"; fields[1].name = "match_";
	assert.throws(() => generateCopiedRustGraphValues(ir), /field name collides|duplicate C field/);
});

test("Rust shared structural aliases generate finite declarations without repeated unfolding", () => {
	const ir = recursiveReviewedIr(), base = ir.types.find(type => type.kind === "alias");
	const named = index => ({ kind: "named", id: `lean:Recursive.Alias${index}` });
	ir.types = Array.from({ length: 700 }, (_, index) => ({
		...base
		, id: named(index).id
		, name: `Alias${index}`
		, target: index ? { kind: "apply", constructor: "tuple", arguments: [named(index - 1), named(index - 1)] } : { kind: "primitive", name: "uint32" } }));
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = named(699); ir.declarations[0].result.type = named(699);
	const output = generateCopiedRustGraphValues(ir);
	assert.equal(output.types.length, 700); assert.ok(output.source.length < 200000);
	assert.match(output.source, /pub type Alias699 = Graph[a-f0-9]+;/);
});

test("Rust compiles recursive values and preserves exact data and independent deep copies", { skip: process.env.LEAN_BRIDGE_RUST_GRAPH_TEST !== "1", timeout: 180_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-rust-graph-values-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const generated = generateCopiedRustGraphValues(nativeRecursiveReviewedIr());
	const linked = generateCopiedRustGraphValues(recursiveRecord());
	const probe = await readFile("tests/fixtures/structured-types/recursive-values.rs", "utf8");
	const wide = `#[test]\nfn wide_constructor() {\n let value = Wide::Next {\n${Array.from({ length: 255 }, (_, i) => `field${i}: ${i},`).join("\n")}\nchild: Box::new(Wide::Leaf { value: 17 }) };\nassert_eq!(value, value.clone());\n}\n`;
	const source = `${generated.source}\npub mod linked {\n${linked.source}\n}\n#[cfg(test)] mod tests { use super::*;\n${probe}\n${wide}\n}`;
	await saveLakeFile(root, "Cargo.toml", '[package]\nname="recursive-values"\nversion="1.0.0"\nedition="2021"\n[dependencies]\nnum-bigint="=0.4.6"\nsha2="=0.10.9"\n[profile.dev]\ndebug=0\nincremental=false\n');
	await saveLakeFile(root, "Cargo.lock", await copiedRustLock("recursive-values", "1.0.0"));
	await saveLakeFile(root, "src/lib.rs", source);
	const environment = nativeFixtureEnvironment(["rust"]), env = { ...environment
		, RUSTC: environment.LEAN_BRIDGE_RUSTC
		, RUSTFLAGS: "-Dwarnings"
		, CARGO_NET_OFFLINE: "true"
		, CARGO_INCREMENTAL: "0"
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
		, CARGO_TARGET_DIR: join(root, "target") };
	const run = args => processBuildRunner.capture({ command: environment.LEAN_BRIDGE_CARGO, args, cwd: root, env, timeoutMs: 120_000 })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	const result = await run(["test", "--offline", "--locked", "--lib", "--", "--nocapture"]);
	assert.match(result.stdout, /6 passed; 0 failed/);
	const rejections = [];
	for(const [name, source, code] of [
		["negative_nat", "let _: recursive_values::BigUint = -1;", "E0308"]
		, ["missing_box", "let _ = recursive_values::Spine::Next { value: recursive_values::Spine::Leaf { value: 1 } };", "E0308"]
		, ["wrong_unit", "let _ = recursive_values::Marker::Unit { value: 0 };", "E0308"]
		, ["missing_field", "let _ = recursive_values::Scalars {};", "E0063"]
		, ["wrong_case", "let _ = recursive_values::Tree::Unknown;", "E0599"]
	]){
		await saveLakeFile(root, "src/main.rs", `fn main() { ${source} }\n`);
		const rejected = await captureRustCompiler(environment.LEAN_BRIDGE_CARGO, ["check", "--offline", "--locked", "--bin", "recursive-values", "--message-format=json"], root, env);
		assert.equal(rejected.code, 101, rejected.stderr);
		const messages = rejected.stdout.trim().split("\n").map(line => JSON.parse(line)).filter(item => item.reason === "compiler-message" && item.message.level === "error");
		assert.ok(messages.some(item => item.message.code?.code === code && item.message.spans.some(span => span.file_name === "src/main.rs" && span.is_primary)), rejected.stdout);
		rejections.push({ name, sourceSha256: sha256(source), code });
	}
	await saveLakeFile("build/recursive", "rust-values.json", canonicalJson({
		schemaVersion: 1
		, compiledLean: false
		, installedPackage: false
		, tests: 6
		, rejections
		, stdout: result.stdout
		, sourceSha256: sha256(generated.source)
		, linkedSourceSha256: sha256(linked.source)
		, probeSha256: sha256(probe)
		, compiler: (await processBuildRunner.capture({ command: environment.LEAN_BRIDGE_RUSTC, args: ["--version"], cwd: root, env })).stdout.trim() }));
});
