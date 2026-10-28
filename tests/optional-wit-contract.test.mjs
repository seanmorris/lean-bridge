/**
 * WIT/WASI exposes named omission exports because WIT has no overload/default syntax.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileWitPackageModel, generateWitPackage } from "../src/backends/wit/generate.mjs";
import { renderWitHostSource } from "../src/backends/wit/copied-host.mjs";
import { optionalParameterIr } from "./helpers/optional-parameter-ir.mjs";

test("WIT retains full exports and names every supported omitted suffix", async t => {
	const files = generateWitPackage(optionalParameterIr()).files;
	const wit = files["wit/defaults.wit"], wat = files["component/defaults.wat"];
	const manifest = JSON.parse(files["binding-manifest.json"]);
	assert.match(wit, /word: func\(value0: u32\) -> u32;/u);
	assert.match(wit, /word-default: func\(\) -> u32;/u);
	assert.match(wit, /natural-default: func\(\) -> bridge-value-/u);
	assert.match(wit, /text-default: func\(\) -> string;/u);
	assert.match(wit, /maybe-default: func\(\) -> bridge-value-/u);
	assert.deepEqual(manifest.declarations[0].defaults
		, [{ witName: "word-default", suppliedParameters: 0, omittedParameters: 1 }]);
	assert.equal(manifest.declarations.length, 6);
	assert.equal(manifest.declarations.flatMap(declaration => declaration.defaults).length, 6);

	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-defaults-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, "model.wit"), wit);
	await writeFile(join(root, "model.wat"), wat);
	execFileSync("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], { cwd: root, stdio: "pipe" });
	execFileSync("wasm-tools", ["validate", "--features", "component-model", "model.wasm"], { cwd: root, stdio: "pipe" });
	execFileSync("wasm-tools", ["component", "wit", "model.wit", "--json"], { cwd: root, stdio: "pipe" });
});

test("the WIT host lowers named omission to the same full-arity C symbol", () => {
	const compiled = compileWitPackageModel(optionalParameterIr()).copied;
	const host = renderWitHostSource(compiled, Uint8Array.of(0));
	assert.match(host, /wasmtime_component_linker_instance_add_func\(host, "word-default"/u);
	assert.match(host, /static wasmtime_error_t \*lb_call_6[^]*defaults_word\(&value, &native_error\)/u);
	assert.match(host, /strcmp\(name, "word-default"\) == 0\) valid = count == 0/u);
	assert.doesNotMatch(host, /defaults_word_default/u);
});

test("WIT rejects a positional default before a required argument", () => {
	const ir = optionalParameterIr(), declaration = ir.declarations[0];
	declaration.parameters.push({ ...structuredClone(declaration.parameters[0])
		, name: "required", optional: false, default: null });
	assert.throws(() => generateWitPackage(ir)
		, /default before a required positional parameter/u);
});

test("WIT names every arity when multiple trailing defaults are available", () => {
	const ir = optionalParameterIr(), declaration = ir.declarations[0];
	const optional = structuredClone(declaration.parameters[0]);
	declaration.parameters = [
		{ ...structuredClone(optional), name: "required", optional: false, default: null }
		, { ...structuredClone(optional), name: "middle", default: { kind: "integer", value: "7" } }
		, { ...structuredClone(optional), name: "last", default: { kind: "integer", value: "9" } }
	];
	ir.declarations = [declaration];
	const wit = generateWitPackage(ir).files["wit/defaults.wit"];
	assert.match(wit, /word-defaults-2: func\(required: u32\) -> u32;/u);
	assert.match(wit, /word-default: func\(required: u32, middle: u32\) -> u32;/u);
});
