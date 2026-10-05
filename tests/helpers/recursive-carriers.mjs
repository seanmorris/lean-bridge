/**
 * Execute generated total carriers using freshly extracted Lean declarations.
 * This checks compiled helpers, not an installed consumer package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { componentRecordDefinitions } from "../../src/abi/component-records.mjs";
import { assertComponentRecursiveBindings, componentRecursiveAbi, componentRecursiveDispatch } from "../../src/abi/component-recursive-abi.mjs";
import { componentRecursiveLeanSource, componentRecursiveHelper } from "../../src/build/component-recursive-lean.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { checkRecursiveWasm } from "./recursive-wasm.mjs";

const primitiveNames = ["Unit", "Bool", "UInt8", "UInt16", "UInt32", "UInt64", "Int8", "Int16", "Int32", "Int64", "Nat", "Int", "Float32", "Float", "String", "ByteArray", "Char", "USize", "ISize"];
const scalarNames = ["unit", "bool", "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "nat", "int", "float32", "float64", "string", "bytes", "char", "usize", "isize"];
const render = type => {
	if(type.kind === "primitive") return `_root_.${primitiveNames[scalarNames.indexOf(type.name)]}`;
	if(type.kind === "named") return `_root_.${type.id.slice(5)}`;
	const args = type.arguments.map(render);
	if(type.constructor === "tuple") return `(${args[0]} × ${args[1]})`;
	if(type.constructor === "result") return `(_root_.Except ${args[1]} ${args[0]})`;
	return `(_root_.${{ array: "Array", list: "List", option: "Option" }[type.constructor]} ${args[0]})`;
};

/**
 * Derive the experimental graph ABI while production admission remains gated.
 *
 * @param ir - Fresh compiler-authenticated copied signatures.
 */
export const recursiveCarrierAbi = ir => ({
	version: componentRecursiveAbi, dispatch: componentRecursiveDispatch
	, types: componentRecordDefinitions(ir, true)
	, exports: ir.declarations.map(item => ({ bindingId: item.id
		, symbol: `lean_bridge_${sha256(item.id).slice(0, 24)}`
		, parameters: item.parameters.map(item => item.type)
		, result: item.result.type, resultMode: item.resultMode }))
});

/**
 * Compile and run carrier construction, projection, branches and rejection.
 *
 * @param input - Fresh IR and isolated Lean compilation workspace.
 * @param input.ir - Fresh compiler-authenticated copied signatures.
 * @param input.directory - Test-owned temporary workspace.
 * @param input.prefix - Pinned Lean compiler prefix.
 * @param input.capture - Lean command runner with the workspace's import path.
 */
export const checkRecursiveCarriers = async ({ ir, directory, prefix, capture }) => {
	const abi = recursiveCarrierAbi(ir);
	assertComponentRecursiveBindings(abi, ir);
	const exports = ir.declarations.map((item, index) => ({ bindingId: item.id
		, symbol: abi.exports[index].symbol, wrapper: `export${index}`
		, sourceDeclaration: item.source.declaration }));
	const lines = componentRecursiveLeanSource(abi, exports, render);
	const source = ["import Recursive", "namespace Carriers", ...lines, "end Carriers", ""].join("\n");
	assert.doesNotMatch(source, /\b(?:sorry|axiom|unsafe|partial|unsafeCast|defaultValue)\b/u);
	assert.ok(source.length < 160000, "shared nominal definitions must not expand exponentially");
	await writeFile(join(directory, "Carriers.lean"), source);
	await capture(["-o", "Carriers.olean", "-c", "Carriers.c", "Carriers.lean"]);
	const c = await readFile(join(directory, "Carriers.c"), "utf8");
	for(const item of exports) assert.match(c, new RegExp(`lean_object\\* ${item.symbol}_lean\\(lean_object\\*`));
	const ref = name => ({ kind: "named", id: `lean:Recursive.${name}` });
	const apply = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
	const helper = (type, name) => `${name}${componentRecursiveHelper(abi, type).split("_").at(-1)}`;
	const invoke = name => exports[ir.declarations.findIndex(item => item.source.declaration === `Recursive.${name}`)].wrapper;
	const tree = ref("Tree"), scalars = ref("Scalars"), never = ref("Never"), spine = ref("Spine");
	const list = apply("list", tree), array = apply("array", ref("LeftTree"));
	const values = [
		"()", "true", "255", "65535", "4294967295", "18446744073709551615"
		, "-128", "-32768", "-2147483648", "-9223372036854775808"
		, "340282366920938463463374607431768211457"
		, "-340282366920938463463374607431768211457"
		, "1.5", "-2.25", '"🌱\\x00hello"', "ByteArray.mk #[0, 255, 42]"
		, "'🌱'", "4294967295", "-2147483648"
	];
	const option = apply("option", tree), tuple = apply("tuple", tree, tree);
	const result = apply("result", tuple, { kind: "primitive", name: "string" });
	const alternatives = apply("array", ref("Forest"));
	const unitOption = apply("option", { kind: "primitive", name: "unit" });
	const nestedOption = apply("option", unitOption);
	const checks = [
		"import Carriers", "open Carriers"
		, "def check (ok : Bool) : IO Unit := unless ok do throw (IO.userError \"carrier mismatch\")"
		, "def main : IO Unit := do"
		, `  let scalars := ${helper(scalars, "make")} ${values.map(value => `#[(${value})]`).join(" ")}`
		, "  check (scalars.size == 1)"
		, `  let copied := ${invoke("scalars")} scalars`
		, ...values.map((value, index) => `  check (${helper(scalars, `field${index}`)} copied == #[(${value})])`)
		, `  check ((${invoke("scalars")} #[]).isEmpty)`
		, `  check ((${invoke("scalars")} (scalars ++ scalars)).isEmpty)`
		, `  let leaf := ${helper(tree, "make1")} scalars`
		, `  check (${helper(tree, "branch")} (${invoke("empty")} ()) == 0)`
		, `  check ((${helper(list, "items")} (${helper(tree, "case0_field0")} (${invoke("empty")} ()))).isEmpty)`
		, `  check ((${invoke("joinTrees")} leaf #[]).isEmpty)`
		, `  check ((${invoke("joinTrees")} #[] leaf).isEmpty)`
		, `  check ((${helper(list, "items")} (${helper(tree, "case0_field0")} (${invoke("joinTrees")} leaf leaf))).size == 2)`
		, `  check (${helper(tree, "branch")} leaf == 1)`
		, `  check ((${helper(tree, "case0_field0")} leaf).isEmpty)`
		, `  let children := ${helper(list, "make")} #[leaf, leaf]`
		, `  let branch := ${helper(tree, "make0")} children`
		, `  let result := ${invoke("tree")} branch`
		, `  check (${helper(tree, "branch")} result == 0)`
		, `  check ((${helper(tree, "case1_field0")} result).isEmpty)`
		, `  let children := ${helper(list, "items")} (${helper(tree, "case0_field0")} result)`
		, "  check (children.size == 2)"
		, "  for child in children do"
		, `    check (${helper(tree, "branch")} child == 1)`
		, `    let payload := ${helper(tree, "case1_field0")} child`
		, ...values.map((value, index) => `    check (${helper(scalars, `field${index}`)} payload == #[(${value})])`)
		, `  check ((${helper(list, "make")} #[leaf, #[]]).isEmpty)`
		, `  check ((${helper(list, "make")} #[leaf, leaf ++ leaf]).isEmpty)`
		, `  check (${helper(tree, "branch")} #[] == 4294967295)`
		, `  check (${helper(tree, "branch")} (leaf ++ leaf) == 4294967295)`
		, `  check ((${helper(never, "make0")} #[]).isEmpty)`
		, `  check ((${helper(never, "case0_field0")} #[]).isEmpty)`
		, `  check (${helper(never, "branch")} #[] == 4294967295)`
		, `  check ((${invoke("never")} #[]).isEmpty)`
		, `  let last := ${helper(spine, "make1")} #[42]`
		, "  let mut chain := last"
		, "  for _ in [0:128] do"
		, `    chain := ${helper(spine, "make0")} chain`
		, `  chain := ${invoke("spine")} chain`
		, "  for _ in [0:128] do"
		, `    check (${helper(spine, "branch")} chain == 0)`
		, `    chain := ${helper(spine, "case0_field0")} chain`
		, `  check (${helper(spine, "branch")} chain == 1)`
		, `  check (${helper(spine, "case1_field0")} chain == #[42])`
		, `  let left := ${helper(ref("LeftTree"), "make1")} #[7]`
		, `  let many := ${helper(array, "make")} #[left, left]`
		, `  let right := ${helper(ref("RightTree"), "make0")} many`
		, `  let round := ${invoke("left")} (${helper(ref("LeftTree"), "make0")} right)`
		, `  let right := ${helper(ref("LeftTree"), "case0_field0")} round`
		, `  let items := ${helper(array, "items")} (${helper(ref("RightTree"), "case0_field0")} right)`
		, "  check (items.size == 2)"
		, "  for child in items do"
		, `    check (${helper(ref("LeftTree"), "case1_field0")} child == #[7])`
		, `  check ((${helper(array, "make")} #[left, #[]]).isEmpty)`
		, `  let alias := ${helper(ref("TreeAlias"), "make")} leaf`
		, `  check (${helper(tree, "branch")} (${helper(ref("TreeAlias"), "field0")} alias) == 1)`
		, `  check (${helper(tree, "branch")} (${invoke("deepAliases")} leaf) == 1)`
		, `  let forest := ${helper(ref("Forest"), "make")} (${helper(list, "make")} #[leaf])`
		, `  let alternatives := ${helper(alternatives, "make")} #[forest]`
		, `  let pair := ${helper(tuple, "make")} leaf branch`
		, `  check (${helper(tree, "branch")} (${helper(tuple, "field0")} pair) == 1)`
		, `  check (${helper(tree, "branch")} (${helper(tuple, "field1")} pair) == 0)`
		, `  let success := ${helper(result, "make0")} pair`
		, `  let failure := ${helper(result, "make1")} #["error"]`
		, `  check (${helper(result, "branch")} success == 0)`
		, `  check (${helper(result, "branch")} failure == 1)`
		, `  check (${helper(result, "field1")} failure == #["error"])`
		, `  check ((${helper(result, "field0")} failure).isEmpty)`
		, `  check ((${helper(result, "field1")} success).isEmpty)`
		, `  let fallback := ${helper(option, "make0")} leaf`
		, `  check (${helper(option, "branch")} fallback == 1)`
		, `  check ((${helper(option, "field0")} (${helper(option, "none")} ())).isEmpty)`
		, `  let none := ${helper(nestedOption, "none")} ()`
		, `  let someNone := ${helper(nestedOption, "make0")} (${helper(unitOption, "none")} ())`
		, `  let someSomeUnit := ${helper(nestedOption, "make0")} (${helper(unitOption, "make0")} #[()])`
		, `  check (${helper(nestedOption, "branch")} none == 0)`
		, `  check (${helper(nestedOption, "branch")} someNone == 1)`
		, `  check (${helper(unitOption, "branch")} (${helper(nestedOption, "field0")} someNone) == 0)`
		, `  check (${helper(unitOption, "branch")} (${helper(nestedOption, "field0")} someSomeUnit) == 1)`
		, `  let envelope := ${helper(ref("Envelope"), "make")} alias alternatives fallback success someNone`
		, `  let envelope := ${invoke("envelope")} envelope`
		, `  check (${helper(tree, "branch")} (${helper(ref("Envelope"), "field0")} envelope) == 1)`
		, `  check ((${helper(alternatives, "items")} (${helper(ref("Envelope"), "field1")} envelope)).size == 1)`
		, `  check (${helper(option, "branch")} (${helper(ref("Envelope"), "field2")} envelope) == 1)`
		, `  check (${helper(result, "branch")} (${helper(ref("Envelope"), "field3")} envelope) == 0)`
		, `  check (${helper(nestedOption, "branch")} (${helper(ref("Envelope"), "field4")} envelope) == 1)`
		, `  let oversized : Array (Array Recursive.Tree) := Array.replicate 262145 leaf`
		, `  check ((${helper(list, "make")} oversized).isEmpty)`
		, `  check ((${helper(list, "make")} (oversized.extract 0 262144)).size == 1)`
		, "  let hugeList := List.replicate 262146 (Recursive.Tree.branch [])"
		, `  check ((${helper(list, "items")} #[hugeList]).size == 262145)`
		, "  let hugeArray := Array.replicate 262146 (Recursive.LeftTree.leaf 3)"
		, `  check ((${helper(array, "items")} #[hugeArray]).size == 262145)`
		, '  IO.println "recursive-carriers-ok"', ""
	];
	await writeFile(join(directory, "CarrierCheck.lean"), checks.join("\n"));
	await capture(["-c", "Recursive.c", "Recursive.lean"]);
	await capture(["-c", "CarrierCheck.c", "CarrierCheck.lean"]);
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: directory, timeoutMs: 120000 })
		.catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	await run(join(prefix, "bin/leanc"), ["-O1", "Recursive.c", "Carriers.c", "CarrierCheck.c", "-o", "carrier-check"]);
	const observed = await run(join(directory, "carrier-check"), []);
	assert.equal(observed.stdout, "recursive-carriers-ok\n"); assert.equal(observed.stderr, "");
	if(process.env.LEAN_BRIDGE_RECURSIVE_WASM_TEST === "1") await checkRecursiveWasm({ abi, directory });
};
