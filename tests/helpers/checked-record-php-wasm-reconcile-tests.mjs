/**
 * Fresh Lean reconciliation controls without C compilation or installed support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildElaboratedComponent } from "../../src/build/elaborated-component.mjs";
import { createCompiledPhpWasmModel } from "../../src/build/php-wasm-graph-model.mjs";
import { generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { checkedRecordFixture } from "./checked-record-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { checkedRecordPhpWasmSelection } from "./checked-record-php-wasm-fixture.mjs";

const flag = process.env.LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_LEAN_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag));

const cases = [
	{ name: "erased-proof-omission", mutate: find => { find("Percent").source.extensions["lean-lang.org/erased-proofs"].fields = ["above"]; } }
	, { name: "changed-index", mutate: find => { find("Triple").source.extensions["lean-lang.org/instantiation"].arguments[0].value = "4"; } }
	, { name: "reordered-payload", mutate: find => { find("Interval").fields.reverse(); } }
	, { name: "foreign-constructor", mutate: find => { find("total").source.extensions["lean-lang.org/refinements"].parameters[0].constructor = "CheckedRecords.mkInterval"; } }
	, { name: "valid-constructor-change", mutate: find => { find("smallest").source.extensions["lean-lang.org/refinements"].parameters[0].constructor = "CheckedRecords.mkTriple"; }, valid: true }
];
for(const selected of cases) test(`fresh Lean PHP-Wasm ${selected.name}`, { skip: flag !== "1", timeout: 600000 }, async t => {
	const records = resolve(process.env.LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_LEAN_OUTPUT ?? "build/checked-record-php-wasm-lean", selected.name);
	await assert.rejects(access(records), { code: "ENOENT" }); await mkdir(records, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-php-wasm-review-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained reconciliation probe: ${directory}`);
	});
	const { configuration, expected } = checkedRecordPhpWasmSelection("reviewed-ir");
	selected.mutate(name => [...expected.types, ...expected.declarations].find(item => item.name === name));
	const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
	await cp(checkedRecordFixture, projectRoot, { recursive: true });
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
	await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(records, "api.binding-ir.json", canonicalJson(expected));
	const stopped = new Error("Adapters compiled; stop before C compilation");
	let compiled = false;
	const compileComponent = async ({ model, adapters, generatedC }) => {
		compiled = true;
		assert.equal(selected.valid, true, "A contradictory review must not reach C compilation");
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.exports.find(item => item.name === "CheckedRecords.smallest").refinements.parameters[0].constructor, "CheckedRecords.mkTriple");
		await saveLakeFile(records, "model.json", canonicalJson(model));
		await saveLakeFile(records, "adapters.lean", adapters.leanSource);
		await saveLakeFile(records, "generated.c", await readFile(generatedC));
		throw stopped;
	};
	const options = { projectRoot, outputRoot
		, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, targets: ["php-wasm"], profile: "php-wasm-copied-v1"
		, receiptName: "php-wasm-component.json"
		, createModel: createCompiledPhpWasmModel
		, createAdapters: generateNativeLeanAdapters, compileComponent };
	await assert.rejects(buildElaboratedComponent(options), error => {
		if(selected.valid) assert.equal(error, stopped);
		else if(selected.name === "foreign-constructor")
			assert.match(JSON.stringify(error.details ?? error.message), /checked record constructor (must take exactly the payload fields|input lo must be named data)/u);
		else assert.equal(error.code, "reviewed-ir-source-mismatch");
		return true;
	});
	assert.equal(compiled, selected.valid === true);
	await assert.rejects(access(outputRoot), { code: "ENOENT" });
	t.diagnostic(JSON.stringify({ sourceCompilationOnly: true, name: selected.name, compiled, noOutput: true, installedAcceptance: false }));
	complete = true;
});
