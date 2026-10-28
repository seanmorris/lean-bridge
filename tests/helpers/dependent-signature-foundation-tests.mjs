/**
 * Authenticate direct dependent-Fin metadata, Binding IR and adapter guards.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { declarationRefinements } from "../../src/abi/refinements.mjs";
import { checkedRefinementSelection } from "../../src/analyze/checked-refinement-selection.mjs";
import { createMetadataRequest, validateElaboratedMetadata } from "../../src/analyze/elaborated-metadata.mjs";
import { validateNativeType } from "../../src/analyze/native-types.mjs";
import { projectElaboratedMetadata } from "../../src/analyze/project-elaborated.mjs";
import { assertReviewedRefinements } from "../../src/analyze/reviewed-refinements.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { finRefinementWalk } from "../../src/backends/c/native-copied-values.mjs";
import { nativeFinSummary } from "../../src/backends/native/fin-refinements.mjs";
import { generatePerlBindingPackage } from "../../src/backends/perl/generate.mjs";
import { componentRefinedCall, componentRefinementGuards } from "../../src/build/component-refinements.mjs";
import { generateCompilerAdapters } from "../../src/build/compiler-adapters.mjs";
import { createNativeModel } from "../../src/build/native-model.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { nativeMetadataFixture } from "./native-metadata.mjs";

const transportNat = Object.freeze({ kind: "primitive", name: "nat" });
const abi = Object.freeze({
	cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false
});
const nativeNat = Object.freeze({
	...transportNat, lean: "Nat", abi
});
const predicate = Object.freeze({ kind: "fin-parameter", parameter: 0 });
const dependentNative = Object.freeze({
	kind: "refinement", base: nativeNat, predicate, abi
});
const refinements = Object.freeze({
	parameters: [null, predicate], result: null
});
const declaration = Object.freeze({
	parameters: [
		{ name: "bound", type: transportNat }
		, { name: "value", type: transportNat }
	]
	, result: { type: transportNat }
});

const metadataFixture = () => {
	const hash = "a".repeat(64);
	const source = {
		name: "Sample", sourcePath: "root/Sample.lean"
		, sourceSha256: hash, interfaceSha256: hash
	};
	const request = createMetadataRequest({
		modules: ["Sample"], exportModules: ["Sample"]
		, exports: ["Sample.dependent"], resources: [], arities: []
	}, {
		toolchain: "leanprover/lean4:v4.32.2", modules: [source]
		, leanCompilerSha256: hash, extractorSha256: hash
	});
	const projection = {
		status: "supported", bindingShape: "pure-function"
		, parameters: [
			{ name: "bound", type: transportNat }
			, {
				name: "value"
				, type: { kind: "refinement", base: transportNat, predicate }
			}
		]
		, result: transportNat
	};
	const report = {
		schemaVersion: 2, kind: "lean-bridge-elaborated-exports"
		, profile: "component-scalars-v1"
		, producer: {
			adapter: "lean-bridge-elaborator", adapterVersion: 2
			, tool: "Lean", toolVersion: "4.32.2"
			, toolchain: request.metadata.toolchain
			, invocationIdentitySha256: request.metadata.invocationIdentitySha256
		}
		, modules: [{
			...source
			, directImports: ["Init"]
			, declarations: [{
				identity: "Sample.dependent", kind: "definition"
				, visibility: "public", selected: true
				, source: {
					path: source.sourcePath, startLine: 1, startColumn: 0
					, endLine: 1, endColumn: 65
				}
				, documentation: null
				, typeExpression: "(bound : Nat) → Fin bound → Nat"
				, parameters: [
					{ name: "bound", binderInfo: "explicit", typeExpression: "Nat" }
					, { name: "value", binderInfo: "explicit", typeExpression: "Fin bound" }
				]
				, resultExpression: "Nat", effects: [], theoremReferences: []
				, projection
			}]
		}]
		, diagnostics: []
	};
	return { request, report };
};

test("direct dependent Fin accepts only an earlier Nat parameter", () => {
	assert.deepEqual(declarationRefinements(declaration, refinements), refinements);
	assert.doesNotThrow(() => assertReviewedRefinements(declaration, refinements));
	assert.doesNotThrow(() => validateNativeType(dependentNative, 0, false, "parameter"));
	assert.equal(checkedRefinementSelection(predicate), null);
	for(const invalid of [
		{ kind: "fin-parameter", parameter: 1 }
		, { kind: "fin-parameter", parameter: -1 }
		, { kind: "fin-parameter", parameter: 0, bound: "3" }
	]) {
		assert.throws(() => declarationRefinements(declaration, {
			parameters: [null, invalid], result: null
		}), /Invalid declaration refinement metadata/u);
	}
	const wrongEarlier = structuredClone(declaration);
	wrongEarlier.parameters[0].type = { kind: "primitive", name: "int" };
	assert.throws(() => declarationRefinements(wrongEarlier, refinements)
		, /Invalid declaration refinement metadata/u);
	assert.throws(() => declarationRefinements(declaration, {
		parameters: [null, null], result: predicate
	}), /Refinement does not match its transport type/u);
});

test("elaborated metadata closes dependent Fin to its exact direct parameter site", async () => {
	const { request, report } = metadataFixture();
	assert.equal(validateElaboratedMetadata(report, request), true);
	await assertJsonSchema("elaborated-export-metadata", report);
	for(const mutate of [
		value => { value.modules[0].declarations[0].projection.parameters[1].type.predicate.parameter = 1; }
		, value => {
			const projection = value.modules[0].declarations[0].projection;
			projection.parameters[0].type = projection.parameters[1].type;
			projection.parameters[1].type = transportNat;
		}
		, value => {
			const projection = value.modules[0].declarations[0].projection;
			projection.parameters[1].type = {
				kind: "array", element: projection.parameters[1].type
			};
		}
		, value => {
			const projection = value.modules[0].declarations[0].projection;
			projection.result = projection.parameters[1].type;
			projection.parameters[1].type = transportNat;
		}
	]) {
		const forged = structuredClone(report);
		mutate(forged);
		assert.throws(() => validateElaboratedMetadata(forged, request)
			, /Dependent Fin requires the exact value of an earlier explicit Nat parameter/u);
	}
});

test("component calls guard the dependent value against the live earlier argument", () => {
	const item = {
		sourceDeclaration: "Sample.dependent", refinements
	};
	const prepared = componentRefinedCall(item, ["bound", "value"]);
	assert.equal(prepared.call
		, "_root_.Sample.dependent bound ⟨value, _bridgeFin1⟩");
	assert.deepEqual(prepared.guards, [{
		kind: "fin", bound: "bound", proof: "_bridgeFin1", value: "value"
	}]);
	assert.equal(componentRefinementGuards(prepared.guards, prepared.call, "rejected")
		, "if _bridgeFin1 : (value) < bound then\n"
			+ "  _root_.Sample.dependent bound ⟨value, _bridgeFin1⟩\n"
			+ "else\n  rejected");
});

test("native models retain the direct dependency instead of freezing a bound", () => {
	const input = nativeMetadataFixture();
	const nativeDeclaration = input.metadata.modules[0].declarations[0];
	nativeDeclaration.typeExpression = "(bound : Nat) → Fin bound → Nat";
	nativeDeclaration.parameters = [
		{ name: "bound", binderInfo: "explicit", typeExpression: "Nat" }
		, { name: "value", binderInfo: "explicit", typeExpression: "Fin bound" }
	];
	nativeDeclaration.resultExpression = "Nat";
	nativeDeclaration.projection.parameters = [
		{ name: "bound", type: nativeNat }
		, { name: "value", type: dependentNative }
	];
	nativeDeclaration.projection.result = nativeNat;
	const model = createNativeModel({
		...input, moduleName: "LeanBridge::Sample"
		, component: {
			id: "sample@1.0.0", name: "sample", version: "1.0.0"
		}
	}, { refinements: true });
	assert.deepEqual(model.exports[0].refinements, refinements);
	const documented = {
		...declaration, id: "lean:Sample.dependent"
		, source: { extensions: { "lean-lang.org/refinements": refinements } }
	};
	assert.equal(nativeFinSummary(documented, ["bound", "value"]), "value < bound");
	const bounds = [];
	assert.deepEqual(finRefinementWalk({
		refinement: predicate, type: nativeNat, value: "value"
		, constant: "lb_fin_dependent_1", label: "value"
		, copy: () => { throw new Error("dependent scalar walk must not inspect copied aggregates"); }
		, bounds, reject: message => `return reject(${message});`
		, parameterBounds: [{ value: "bound", label: "bound" }]
	}), [
		"  if (!lb_fin_below(value->data, value->length, bound->data, bound->length)) return reject(\"value is not below its dependent Fin bound bound\");"
	]);
	assert.deepEqual(bounds, []);
	assert.throws(() => finRefinementWalk({
		refinement: predicate, type: nativeNat, value: "value"
		, constant: "lb_fin_dependent_1", label: "value"
		, copy: () => null, bounds: [], reject: String
	}), /Dependent Fin requires its earlier copied Nat parameter/u);
	const perl = generatePerlBindingPackage(model, {
		nativeLibrary: { sha256: "1".repeat(64) }
		, runtimeIdentity: "2".repeat(64)
		, initializer: "initialize_sample", library: "libsample.so"
	});
	assert.match(perl["Component.xs"]
		, /lean_object \*\s+a0 = [^;]+;\s+lean_object \*\s+a1 = [^;]+;[\s\S]*int below = lean_nat_lt\(a1, a0\);[\s\S]*if \(!below\) croak\("%s", "arg1 is not below its dependent Fin bound arg0"\);[\s\S]*lb_[0-9a-f]{24}\(a0, a1\)/u);
	assert.match(perl["lib/LeanBridge/Sample.pm"], /Checked Lean Fin bounds: arg1 < arg0\./u);
});

test("semantic projection and compiler adapters preserve the dynamic bound", async () => {
	const { request, report } = metadataFixture();
	const analysis = projectElaboratedMetadata({
		project: {
			name: "sample", version: "1.0.0"
			, toolchain: request.metadata.toolchain
		}
		, inputs: [], sourceTreeSha256: "b".repeat(64)
	}, [{ module: "Sample", path: "Sample.lean" }], { request, metadata: report });
	const semantic = analysis.bindingIr.document;
	const projected = semantic.declarations[0].source.extensions["lean-lang.org/refinements"];
	assert.deepEqual(projected, refinements);
	const generated = generateCompilerAdapters({
		analysis: {
			bindingIr: analysis.bindingIr
			, exportCandidates: [{
				declaration: "Sample.dependent", sourceModule: "Sample"
				, status: "exportable"
			}]
		}
		, componentPlan: {
			sha256: "0".repeat(64)
			, document: {
				bindingIr: { semanticSha256: analysis.bindingIr.semanticSha256 }
			}
		}
	});
	await assertJsonSchema("compiler-adapter-plan", generated.plan);
	assert.deepEqual(generated.plan.exports[0].refinements, refinements);
	assert.match(generated.files["LeanBridgeGenerated.lean"]
		, /if _bridgeFin1 : \(arg1\) < arg0 then/u);
	assert.match(generated.files["LeanBridgeGenerated.lean"]
		, /Sample\.dependent arg0 ⟨arg1, _bridgeFin1⟩/u);
	assert.doesNotMatch(generated.files["LeanBridgeGenerated.lean"]
		, /axiom|unsafeCast|sorry/u);
	const javascript = generateJavaScriptPackage(semantic);
	assert.match(javascript["index.mjs"]
		, /validate\.assertNat\(arg0, "dependent\.arg0"\);[\s\S]*validate\.assertNat\(arg1, "dependent\.arg1"\);[\s\S]*validate\.assertFin\(arg1, arg0, "dependent\.arg1"\);[\s\S]*runtime\.call\("lean:Sample\.dependent", \[arg0, arg1\]\)/u);
	assert.doesNotMatch(javascript["index.mjs"], /assertFin\(arg1, ["']\d+/u);
});
