/**
 * Recursive checked-record compiler, finite-refinement and source-build gates.
 * Installed consumer acceptance is split by transport in VO #1478.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { componentRecordDefinitions } from "../src/abi/component-records.mjs";
import { componentRecursiveAbi, componentRecursiveDispatch } from "../src/abi/component-recursive-abi.mjs";
import { nominalRefinementEntries } from "../src/abi/refinements.mjs";
import { validateExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { generateNativeCopiedGraphAdapters } from "../src/backends/c/native-graph-adapters.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { componentRefinementMirrors } from "../src/build/component-refinement-mirrors.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../src/build/php-wasm-graph-model.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	recursiveCheckedRecordConfiguration
	, recursiveCheckedRecordFixtureRoot
	, recursiveCheckedRecordRefinements
	, recursiveCheckedRecordReview
} from "./helpers/recursive-checked-record-fixture.mjs";

const contract = () => {
	const ir = recursiveCheckedRecordReview();
	const abi = {
		version: componentRecursiveAbi, dispatch: componentRecursiveDispatch
		, types: componentRecordDefinitions(ir, true)
		, exports: ir.declarations.map(item => ({
			bindingId: item.id
			, symbol: `lean_bridge_${sha256(`${ir.component.id}\0${item.id}`).slice(0, 24)}`
			, parameters: item.parameters.map(parameter => parameter.type)
			, result: item.result.type, resultMode: item.resultMode
		}))
	};
	const exports = ir.declarations.map((item, index) => ({
		bindingId: item.id, symbol: abi.exports[index].symbol
		, wrapper: `export${index}`, sourceDeclaration: item.source.declaration
		, parameters: item.parameters.map(() => ({}))
		, refinements: item.source.extensions["lean-lang.org/refinements"]
	}));
	return { ir, abi, exports };
};
const leanType = type => {
	assert.equal(type.kind, "primitive");
	assert.equal(type.name, "nat");
	return "_root_.Nat";
};

test("recursive checked-record review keeps one finite proof-free graph", () => {
	const { ir, abi, exports } = contract();
	validateBindingIr(ir);
	validateExportConfiguration(recursiveCheckedRecordConfiguration("ordinary"));
	validateExportConfiguration(recursiveCheckedRecordConfiguration("reviewed"));
	assert.equal(ir.declarations.length, 6);
	assert.deepEqual(abi.types.find(type => type.id.endsWith(".Packet")).erased, ["linked"]);
	assert.deepEqual(ir.types.find(type => type.name === "PacketAlias").target
		, { kind: "named", id: "lean:RecursiveCheckedRecords.Packet" });
	const model = componentRefinementMirrors(abi, exports, leanType
		, nominalRefinementEntries(ir.types));
	const first = model.sites.find(item => item.sourceDeclaration.endsWith(".first"));
	const tree = first.refinements.parameters[0];
	assert.equal(tree.kind, "checked-record");
	assert.equal(tree.constructor, "RecursiveCheckedRecords.mkPacket");
	assert.match(tree.cycle, /^[a-f0-9]{20}$/u);
	assert.deepEqual(tree.arguments[0]
		, { kind: "subtype", constructor: "RecursiveCheckedRecords.plusOne" });
	assert.deepEqual(tree.arguments[1], { kind: "fin", bound: "3" });
	assert.deepEqual(tree.arguments[2], { kind: "option"
	, arguments: [{
		kind: "recursive"
		, definition: "RecursiveCheckedRecords.Packet"
		, cycle: tree.cycle
	}] });
	const source = model.lines.join("\n");
	assert.match(source, /structure LbErased\.RecursiveCheckedRecords\.Packet where/u);
	assert.match(source, /Option LbErased\.RecursiveCheckedRecords\.Packet/u);
	assert.match(source, /RecursiveCheckedRecords\.plusOne/u);
	assert.match(source, /RecursiveCheckedRecords\.mkPacket/u);
	assert.match(source, /Packet\.erase/u);
});

test("recursive checked-record graph diagnostics check fields before every outer constructor", () => {
	const { ir, abi, exports } = contract();
	const native = generateNativeCopiedGraphAdapters(ir, abi, {
		wordBits: 32
		, initializer: "initialize_LeanBridgeNative0123456789abcdef"
		, refinementExports: exports
		, nominalRefinements: nominalRefinementEntries(ir.types)
	});
	assert.equal(native.refinementDiagnostics, true);
	assert.match(native.source, /\.tail/u);
	assert.match(native.source, /\.value/u);
	assert.match(native.source, /\.digit/u);
	assert.match(native.source, /is not below its Fin 3 bound/u);
	assert.match(native.source, /was rejected by RecursiveCheckedRecords\.plusOne/u);
	assert.match(native.source, /was rejected by RecursiveCheckedRecords\.mkPacket/u);
	const helpers = [...native.source.matchAll(
		/static uint32_t (ng_refinement_[a-f0-9]+)\([^)]*\) \{\n([\s\S]*?)\n\}/gu
	)].map(([, name, body]) => ({ name, body }));
	const checkedRecord = helpers.find(({ body }) =>
		body.includes("was rejected by RecursiveCheckedRecords.mkPacket"));
	assert.ok(checkedRecord);
	const outer = checkedRecord.body.indexOf("_graph_refinement_");
	assert.ok(checkedRecord.body.indexOf("value->value") < outer);
	assert.ok(checkedRecord.body.indexOf("value->tail") < outer);
	assert.match(checkedRecord.body.slice(0, outer), /ng_refinement_[a-f0-9]+/u);
	assert.match(native.source, /depth > 128 \|\| !\*nodes/u);
	assert.match(native.source, /return NG_LIMIT/u);
});

test("recursive checked-record controls refuse missing definitions, proof drift and repeated backedge choices", () => {
	const { ir, abi, exports } = contract();
	const missing = { ...abi, types: abi.types.filter(type => !type.id.endsWith(".Packet")) };
	assert.throws(() => componentRefinementMirrors(missing, exports, leanType
		, nominalRefinementEntries(ir.types)), /unknown nominal identity lean:RecursiveCheckedRecords\.Packet/u);
	const altered = recursiveCheckedRecordReview();
	altered.types.find(type => type.id.endsWith(".Packet"))
		.source.extensions["lean-lang.org/erased-proofs"].fields = ["other"];
	assert.equal(reviewedContractDifference(ir, altered)
		, "bindingIr.types[0].source.extensions.lean-lang.org/erased-proofs.fields[0]");
	const repeated = structuredClone(exports);
	const first = repeated.find(item => item.sourceDeclaration.endsWith(".first"));
	const nested = structuredClone(first.refinements.parameters[0]);
	nested.fields[2].refinement = null;
	first.refinements.parameters[0].fields[2].refinement = {
		kind: "option", arguments: [nested]
	};
	assert.throws(() => componentRefinementMirrors(abi, repeated, leanType
		, nominalRefinementEntries(ir.types)), /recursive selected refinements require another representation/u);
});

const sourceFlag = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_SOURCE_TEST";
if(process.env[sourceFlag] !== undefined)
	assert.ok(["0", "1"].includes(process.env[sourceFlag]), `Invalid ${sourceFlag}`);
for(const route of ["ordinary", "reviewed"])
	test(`fresh Lean compiles the ${route} recursive checked-record graph adapters`, {
		skip: process.env[sourceFlag] !== "1", timeout: 600_000
	}, async t => {
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-checked-record-source-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(directory, { recursive: true });
			else t.diagnostic(`Retained recursive checked-record compiler probe: ${directory}`);
		});
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
		await cp(recursiveCheckedRecordFixtureRoot, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json"
			, canonicalJson(recursiveCheckedRecordConfiguration(route)));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json"
			, canonicalJson(recursiveCheckedRecordReview()));
			let observed;
		const stopped = new Error("Recursive checked-record adapters compiled; stop before C component compilation");
		const compileComponent = async ({ model, adapters, generatedC }) => {
			observed = { model, adapters, c: await readFile(generatedC, "utf8") };
			throw stopped;
		};
		await assert.rejects(buildElaboratedComponent({
			projectRoot, outputRoot
			, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX
				?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
			, targets: ["php-wasm"], profile: "php-wasm-copied-v1"
			, receiptName: "php-wasm-component.json"
			, createModel: createCompiledPhpWasmModel
				, validateModel: model => assert.ok(model.copiedGraph)
			, createAdapters: generateCompiledPhpWasmLeanAdapters, compileComponent
		}), error => {
			if(error === stopped) return true;
			t.diagnostic(JSON.stringify({ code: error?.code, message: error?.message
				, details: error?.details }, null, 2));
			return false;
		});
		await assert.rejects(access(outputRoot), { code: "ENOENT" });
		assert.ok(observed.model.copiedGraph);
		assert.equal(observed.model.schemaVersion, route === "reviewed" ? 5 : 4);
		assert.equal(reviewedContractDifference(recursiveCheckedRecordReview()
			, observed.model.bindingIr), null);
		assert.deepEqual(Object.fromEntries(observed.model.exports.map(item => [item.name, item.refinements]))
			, recursiveCheckedRecordRefinements);
		const groups = observed.model.bindingIr.declarations
			.find(item => item.id === "lean:RecursiveCheckedRecords.groups");
		assert.equal(groups.parameters[0].type.arguments[0].arguments[0].id
			, "lean:RecursiveCheckedRecords.PacketAlias");
		assert.deepEqual(observed.model.bindingIr.types.find(type =>
			type.id === "lean:RecursiveCheckedRecords.PacketAlias").target
			, { kind: "named", id: "lean:RecursiveCheckedRecords.Packet" });
		assert.match(observed.adapters.leanSource
			, /def LbErased\.RecursiveCheckedRecords\.Packet\.via_/u);
		assert.doesNotMatch(observed.adapters.leanSource, /partial def/u);
		assert.match(observed.adapters.leanSource, /match value with\n {2}\| \{ «value» := a0/u);
		assert.match(observed.adapters.leanSource
			, /def LbErased\.RecursiveCheckedRecords\.Packet\.validFin/u);
		assert.match(observed.c, /lean_bridge_/u);
		complete = true;
	});
