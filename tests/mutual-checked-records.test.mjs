/**
 * Mutual checked-record/variant compiler, finite-refinement and source-build gates.
 * Installed C/C++ acceptance remains tracked separately in VO #1513.
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
import { generateComponentRecursiveAdapters } from "../src/build/component-recursive-adapters.mjs";
import { componentRefinementMirrors } from "../src/build/component-refinement-mirrors.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../src/build/php-wasm-graph-model.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	mutualCheckedRecordConfiguration
	, mutualCheckedRecordFixtureRoot
	, mutualCheckedRecordRefinements
	, mutualCheckedRecordReview
} from "./helpers/mutual-checked-record-fixture.mjs";
import "./helpers/mutual-checked-record-native-installed-tests.mjs";
import "./helpers/mutual-checked-record-npm-installed-tests.mjs";
import "./helpers/mutual-checked-record-npm-source-history-tests.mjs";
import "./helpers/mutual-checked-record-source-history-tests.mjs";

const contract = () => {
	const ir = mutualCheckedRecordReview();
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
	assert.equal(type.kind, "primitive"); assert.equal(type.name, "nat");
	return "_root_.Nat";
};

test("mutual checked-record review keeps one finite proof-free nominal group", () => {
	const { ir, abi, exports } = contract();
	validateBindingIr(ir);
	validateExportConfiguration(mutualCheckedRecordConfiguration("ordinary"));
	validateExportConfiguration(mutualCheckedRecordConfiguration("reviewed"));
	assert.deepEqual(abi.types.find(type => type.id.endsWith(".Envelope")).erased, ["linked"]);
	assert.equal(abi.types.find(type => type.id.endsWith(".Step")).kind, "variant");
	const model = componentRefinementMirrors(abi, exports, leanType, nominalRefinementEntries(ir.types));
	assert.deepEqual(model.mutualGroups, [["MutualCheckedRecords.Envelope", "MutualCheckedRecords.Step"]]);
	const first = model.sites.find(item => item.sourceDeclaration.endsWith(".first"));
	const tree = first.refinements.parameters[0];
	assert.equal(tree.kind, "checked-record");
	assert.equal(tree.constructor, "MutualCheckedRecords.mkEnvelope");
	assert.match(tree.cycle, /^[a-f0-9]{20}$/u);
	assert.deepEqual(tree.arguments[0]
		, { kind: "subtype", constructor: "MutualCheckedRecords.plusOne" });
	assert.deepEqual(tree.arguments[1], { kind: "fin", bound: "3" });
	const step = tree.arguments[2].arguments[0];
	assert.equal(step.kind, "variant");
	assert.deepEqual(step.cases[0].arguments, []);
	assert.deepEqual(step.cases[1].arguments[0]
		, { kind: "recursive", definition: "MutualCheckedRecords.Envelope", cycle: tree.cycle });
	const source = model.lines.join("\n");
	assert.match(source, /structure LbErased\.MutualCheckedRecords\.Envelope where/u);
	assert.match(source, /inductive LbErased\.MutualCheckedRecords\.Step where/u);
	assert.match(source, /MutualCheckedRecords\.mkEnvelope/u);
	assert.match(source, /MutualCheckedRecords\.normalizeEnvelope/u);
	assert.doesNotMatch(source, /\b(?:partial|unsafe|axiom|sorry)\b/u);
});

test("mutual checked-record diagnostics traverse active cases before each outer constructor", () => {
	const { ir, abi, exports } = contract();
	const native = generateNativeCopiedGraphAdapters(ir, abi, {
		wordBits: 32, initializer: "initialize_LeanBridgeNative0123456789abcdef"
		, refinementExports: exports
		, nominalRefinements: nominalRefinementEntries(ir.types)
	});
	assert.equal(native.refinementDiagnostics, true);
	assert.match(native.source, /\.next/u);
	assert.match(native.source, /\.more/u);
	assert.match(native.source, /\.packet/u);
	assert.match(native.source, /was rejected by MutualCheckedRecords\.plusOne/u);
	assert.match(native.source, /was rejected by MutualCheckedRecords\.mkEnvelope/u);
	assert.match(native.source, /depth > 128 \|\| !\*nodes/u);
	assert.match(native.source, /return NG_LIMIT/u);
	const helpers = [...native.source.matchAll(
		/static uint32_t (ng_refinement_[a-f0-9]+)\([^)]*\) \{\n([\s\S]*?)\n\}/gu
	)].map(([, name, body]) => ({ name, body }));
	const checkedRecord = helpers.find(({ body }) =>
		body.includes("was rejected by MutualCheckedRecords.mkEnvelope"));
	assert.ok(checkedRecord);
	const outer = checkedRecord.body.indexOf("_graph_refinement_");
	assert.ok(checkedRecord.body.indexOf("value->value") < outer);
	assert.ok(checkedRecord.body.indexOf("value->next") < outer);
});

test("recursive Wasm diagnostics stay off the success path and name the rejected leaf", () => {
	const { ir, abi, exports } = contract();
	const source = generateComponentRecursiveAdapters(abi, {
		exports, nominalRefinements: nominalRefinementEntries(ir.types)
	});
	assert.match(source, /enum \{ CRD_MESSAGE_LIMIT = 16384, CRD_KIND = UINT32_MAX \}/u);
	assert.match(source, /return crd_reject\(" must be bigint below 3", sizeof/u);
	assert.match(source
		, /return crd_reject\(" was rejected by MutualCheckedRecords\.plusOne", sizeof/u);
	assert.match(source
		, /return crd_reject\(" was rejected by MutualCheckedRecords\.mkEnvelope", sizeof/u);
	assert.match(source, /crd_text\("\.next"/u);
	assert.match(source, /crd_text\("\.value"/u);
	assert.match(source, /crd_text\("\.packet"/u);
	const first = exports.find(item => item.sourceDeclaration.endsWith(".first"));
	const body = source.slice(source.indexOf(`LEAN_EXPORT uint32_t ${first.symbol}(`));
	const refinement = body.indexOf(`${first.symbol}_refinement_0(a0)`);
	const diagnostic = body.indexOf("crd_reset();", refinement);
	assert.ok(refinement >= 0 && diagnostic > refinement);
	assert.ok(body.indexOf(`${first.symbol}_lean(a0)`) > diagnostic);
	assert.match(body, /crd_text\("first\.arg0", sizeof\("first\.arg0"\) - 1\)/u);
	assert.match(body, /if \(status == 5\) return crd_frame_failure\(frame\)/u);
});

test("mutual checked-record controls refuse missing definitions, proof drift and repeated backedge choices", () => {
	const { ir, abi, exports } = contract();
	const missing = { ...abi, types: abi.types.filter(type => !type.id.endsWith(".Step")) };
	assert.throws(() => componentRefinementMirrors(missing, exports, leanType
		, nominalRefinementEntries(ir.types)), /unknown nominal identity lean:MutualCheckedRecords\.Step/u);
	const altered = mutualCheckedRecordReview();
	altered.types.find(type => type.id.endsWith(".Envelope"))
		.source.extensions["lean-lang.org/erased-proofs"].fields = ["other"];
	assert.match(reviewedContractDifference(ir, altered), /erased-proofs\.fields\[0\]$/u);
	const repeated = structuredClone(exports);
	const first = repeated.find(item => item.sourceDeclaration.endsWith(".first"));
	const nested = structuredClone(first.refinements.parameters[0]);
	nested.fields[2].refinement = null;
	first.refinements.parameters[0].fields[2].refinement = {
		kind: "option"
		, arguments: [{ kind: "variant", name: "MutualCheckedRecords.Step"
		, cases: [
			{ name: "stop", fields: [] }
			, { name: "more", fields: [{ name: "packet", refinement: nested }] }
		] }]
	};
	assert.throws(() => componentRefinementMirrors(abi, repeated, leanType
		, nominalRefinementEntries(ir.types)), /recursive selected refinements require another representation/u);
});

const sourceFlag = "LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_SOURCE_TEST";
if(process.env[sourceFlag] !== undefined)
	assert.ok(["0", "1"].includes(process.env[sourceFlag]), `Invalid ${sourceFlag}`);
for(const route of ["ordinary", "reviewed"])
	test(`fresh Lean compiles the ${route} mutual checked-record graph adapters`, {
		skip: process.env[sourceFlag] !== "1", timeout: 600_000
	}, async t => {
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-mutual-checked-record-source-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(directory, { recursive: true });
			else t.diagnostic(`Retained mutual checked-record compiler probe: ${directory}`);
		});
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
		await cp(mutualCheckedRecordFixtureRoot, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json"
			, canonicalJson(mutualCheckedRecordConfiguration(route)));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json"
			, canonicalJson(mutualCheckedRecordReview()));
		let observed;
		const stopped = new Error("Mutual checked-record adapters compiled; stop before C component compilation");
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
		assert.equal(reviewedContractDifference(mutualCheckedRecordReview()
			, observed.model.bindingIr), null);
		assert.deepEqual(Object.fromEntries(observed.model.exports.map(item => [item.name, item.refinements]))
			, mutualCheckedRecordRefinements);
		assert.match(observed.adapters.leanSource
			, /def LbErased\.MutualCheckedRecords\.Envelope\.via_/u);
		assert.match(observed.adapters.leanSource
			, /def LbErased\.MutualCheckedRecords\.Step\.via_/u);
		assert.doesNotMatch(observed.adapters.leanSource, /\bpartial def\b/u);
		assert.match(observed.adapters.leanSource
			, /def LbErased\.MutualCheckedRecords\.Envelope\.validFin/u);
		assert.match(observed.adapters.leanSource
			, /def LbErased\.MutualCheckedRecords\.Step\.validFin/u);
		assert.match(observed.c, /lean_bridge_/u);
		complete = true;
	});
