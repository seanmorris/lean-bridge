/**
 * Compile fresh Lean carriers and execute the native graph boundary, with an
 * independent C caller and allocation ledger. Not installed-package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel } from "../../src/analyze/semantic-model.mjs";
import { componentRecursiveLeanSource } from "../../src/build/component-recursive-lean.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { recursiveCarrierAbi } from "./recursive-carriers.mjs";
import { recursiveSignatures } from "./recursive-fixture.mjs";

const spellings = {
	unit: "Unit", bool: "Bool", uint8: "UInt8", uint16: "UInt16"
	, uint32: "UInt32", uint64: "UInt64", int8: "Int8", int16: "Int16"
	, int32: "Int32", int64: "Int64", nat: "Nat", int: "Int"
	, float32: "Float32", float64: "Float", string: "String", bytes: "ByteArray"
	, char: "Char", usize: "USize", isize: "ISize"
};
const render = type => {
	if(type.kind === "named") return `_root_.${type.id.slice(5)}`;
	if(type.kind === "primitive") return `_root_.${spellings[type.name]}`;
	const args = type.arguments.map(render);
	if(type.constructor === "tuple") return `(${args[0]} × ${args[1]})`;
	if(type.constructor === "result") return `(_root_.Except ${args[1]} ${args[0]})`;
	return `(_root_.${{ array: "Array", list: "List", option: "Option" }[type.constructor]} ${args[0]})`;
};

/**
 * Build the real source, extractor evidence, carriers, C walkers and caller.
 *
 * @param directory - Test-owned temporary workspace.
 */
export const checkNativeRecursiveTransport = async directory => {
	const root = process.cwd();
	const prefix = (await processBuildRunner.capture({ command: join(root, ".toolchains/elan/bin/lean"), args: ["--print-prefix"], cwd: root })).stdout.trim();
	const lean = join(prefix, "bin/lean"), extractor = join(root, "src/analyze/NativeExports.lean");
	const run = (command, args) => processBuildRunner.capture({
		command, args, cwd: directory
		, env: { ...process.env, LEAN_PATH: directory, PATH: `${join(prefix, "bin")}:${process.env.PATH}` }
		, timeoutMs: 180000
	})
		.catch(error => { throw new Error(JSON.stringify({ message: error.message, details: error.details }), { cause: error }); });
	const source = await readFile("tests/fixtures/onboarding/npm-recursive/Recursive.lean", "utf8");
	// Keep the source constructor below the pinned runtime's 1024-byte small
	// allocation ceiling. Its 256 carrier arguments still stress wide C calls.
	const width = 255;
	const extra = `\nnamespace Recursive
inductive Wide where
  | next ${Array.from({ length: width }, (_, i) => `(field${i} : UInt16)`).join(" ")} (child : Wide)
  | leaf (value : UInt32)
def wide (value : Wide) : Wide := value
def units (value : Array Unit) : Array Unit := value
def wordMax (value : USize) : Bool := value == 18446744073709551615
def signedMin (value : ISize) : Bool := value == -9223372036854775808
inductive Marker where
  | empty
  | unit (value : Unit)
  | next (value : Marker)
def marker (value : Marker) : Marker := value
structure EmptyRecord where
def emptyRecord (value : EmptyRecord) : EmptyRecord := value
end Recursive\n`;
	const original = `set_option maxRecDepth 10000\n${source}${extra}`;
	await writeFile(join(directory, "Recursive.lean"), original);
	await run(lean, ["-o", "Recursive.olean", "-c", "Recursive.c", "Recursive.lean"]);
	const selection = {
		profile: "native-library-v1"
		, modules: ["Recursive"], exportModules: ["Recursive"]
		, exports: [...recursiveSignatures.map(item => item.name), ...["wide", "units", "wordMax", "signedMin", "marker", "emptyRecord"].map(name => `Recursive.${name}`)]
		, resources: [], arities: []
	};
	const identity = {
		toolchain: "leanprover/lean4:v4.32.2"
		, modules: [{ name: "Recursive", sourcePath: "Recursive.lean", sourceSha256: sha256(original), interfaceSha256: (await identifyLeanInterface(join(directory, "Recursive.olean"))).interfaceSha256 }]
		, extractorSha256: sha256(await readFile(extractor))
		, leanCompilerSha256: sha256(await readFile(lean))
	};
	const request = createMetadataRequest(selection, identity);
	await writeFile(join(directory, "request.json"), canonicalJson(request));
	const metadata = JSON.parse((await run(lean, ["--run", extractor, "--metadata", "request.json"])).stdout);
	validateElaboratedMetadata(metadata, request); assert.deepEqual(metadata.diagnostics, []);
	const ir = createElaboratedSemanticModel({
		metadata, request
		, component: { id: "recursive@1.0.0", name: "recursive", version: "1.0.0" }
		, elaborationSha256: sha256(canonicalJson(metadata))
	}).document;
	const abi = recursiveCarrierAbi(ir);
	const exports = ir.declarations.map((item, index) => ({ bindingId: item.id, symbol: abi.exports[index].symbol, wrapper: `export${index}`, sourceDeclaration: item.source.declaration }));
	const carriers = ["import Recursive", "set_option maxRecDepth 10000", "namespace NativeCarriers", ...componentRecursiveLeanSource(abi, exports, render), "end NativeCarriers", ""].join("\n");
	assert.doesNotMatch(carriers, /\b(?:unsafe|sorry|axiom|partial|unsafeCast)\b/u);
	await writeFile(join(directory, "NativeCarriers.lean"), carriers);
	await run(lean, ["-o", "NativeCarriers.olean", "-c", "NativeCarriers.c", "NativeCarriers.lean"]);
	const output = generateNativeCopiedGraphAdapters(ir, abi);
	assert.doesNotMatch(output.source, /lean_ctor_get|lean_ctor_set|lean_alloc_ctor/u);
	await writeFile(join(directory, "recursive-graph-types.h"), output.typesHeader);
	await writeFile(join(directory, "recursive-graph.h"), output.header);
	const table = new Map(output.layout.nodes.map(node => [node.id, node]));
	const units = table.get(output.layout.roots.find(item => item.bindingId === "lean:Recursive.units").result);
	const envelope = table.get(output.layout.roots.find(item => item.bindingId === "lean:Recursive.envelope").result);
	const outcome = table.get(envelope.fields.find(field => field.sourceName === "outcome").type);
	const fixtures = await readFile("tests/fixtures/structured-types/native-recursive-check.c", "utf8");
	const harness = fixtures.replaceAll("UNIT_ARRAY_TYPE", units.name)
		.replaceAll("OUTCOME_TYPE", outcome.name)
		.replaceAll("WIDE_FIELDS", Array.from({ length: width }, (_, i) => `wide[depth].cases.next.field${i} = (uint16_t)(depth + ${i});`).join("\n"))
		.replaceAll("WIDE_CHECKS", Array.from({ length: width }, (_, i) => `CHECK(current->cases.next.field${i} == depth + ${i});`).join("\n"));
	const hooks = harness.split("/* GENERATED_TRANSPORT */"); assert.equal(hooks.length, 2);
	await writeFile(join(directory, "native-check.c"), `${hooks[0]}\n${output.source}\n${hooks[1]}`);
	await run("cc", ["-std=c11", "-O2", "-g", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-fstack-usage", `-I${join(prefix, "include")}`, "-c", "native-check.c", "-o", "native-check.o"]);
	const stack = await readFile(join(directory, "native-check.su"), "utf8");
	const recursiveFrames = stack.trim().split("\n").filter(line => /ng_[a-f0-9]+_in\b/u.test(line));
	assert.ok(recursiveFrames.length > 0, "compiler must report recursive decoder frames");
	for(const line of recursiveFrames)
		assert.ok(Number(line.split("\t")[1]) < 1024, `recursive decoder frame: ${line}`);
	const main = `import NativeCarriers
@[extern "native_graph_check"]
opaque nativeCheck (_ : Unit) : UInt32
def main : IO Unit := do
  let count := nativeCheck ()
  if count < 100000 then throw (IO.userError "native checks did not run")
  IO.println s!"native-graphs-ok {count}"
`;
	await writeFile(join(directory, "NativeCheck.lean"), main);
	await run(lean, ["-c", "NativeCheck.c", "NativeCheck.lean"]);
	await writeFile(join(directory, "allocation-guard.h"), nativeAllocationGuardHeader);
	await run(join(prefix, "bin/leanc"), ["-O1", "-include", "allocation-guard.h", "Recursive.c", "NativeCarriers.c", "NativeCheck.c", "native-check.o", "-o", "native-check"]);
	const observed = await run(join(directory, "native-check"), []);
	assert.match(observed.stdout, /^native-graphs-ok \d+\n$/u); assert.equal(observed.stderr, "");
	assert.equal(await readFile(join(directory, "Recursive.lean"), "utf8"), original);
	return { checks: Number(observed.stdout.trim().split(" ").at(-1)), exports: abi.exports.length, width, stack };
};
