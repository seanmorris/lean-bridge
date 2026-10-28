/**
 * Shared ordinary and independently reviewed direct proof-erasure contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const directProofErasureFixture
	= "tests/fixtures/onboarding/direct-proof-erasure";
export const directProofErasureModule = "DirectProofErasure";
export const directProofErasureExport = `${directProofErasureModule}.keep`;
export const directProofErasureKey = "lean-lang.org/erased-proofs";
export const directProofErasureProofs = Object.freeze([
	Object.freeze({ sourceIndex: 0, name: "_before"
		, proposition: "True", witness: "True.intro" })
	, Object.freeze({ sourceIndex: 2, name: "_after"
		, proposition: "True", witness: "True.intro" })
]);
export const directProofErasureProfiles = Object.freeze([
	"browser-javascript", "browser-react", "browser-worker", "c", "cpp"
	, "dotnet", "java", "kotlin", "node-javascript", "node-typescript"
	, "perl", "php-native", "php-wasm", "python", "ruby", "rust", "wit-wasi"
]);
export const directProofErasureTargets = Object.freeze({
	"browser-javascript": Object.freeze(["npm", Object.freeze({ name: "direct-proof-erasure", version: "1.0.0" })])
	, "browser-react": Object.freeze(["npm", Object.freeze({ name: "direct-proof-erasure", version: "1.0.0" })])
	, "browser-worker": Object.freeze(["npm", Object.freeze({ name: "direct-proof-erasure", version: "1.0.0" })])
	, c: Object.freeze(["c", Object.freeze({ name: "directprooferasure", version: "1.0.0" })])
	, cpp: Object.freeze(["cpp", Object.freeze({ name: "directprooferasure", version: "1.0.0" })])
	, dotnet: Object.freeze(["nuget", Object.freeze({ name: "DirectProofErasure.Api", version: "1.0.0" })])
	, java: Object.freeze(["maven", Object.freeze({ name: "org.leanbridge:directprooferasure", version: "1.0.0" })])
	, kotlin: Object.freeze(["maven", Object.freeze({ name: "org.leanbridge:directprooferasure", version: "1.0.0" })])
	, "node-javascript": Object.freeze(["npm", Object.freeze({ name: "direct-proof-erasure", version: "1.0.0" })])
	, "node-typescript": Object.freeze(["npm", Object.freeze({ name: "direct-proof-erasure", version: "1.0.0" })])
	, perl: Object.freeze(["cpan", Object.freeze({ module: "LeanBridge::DirectProofErasure", version: "1.000" })])
	, "php-native": Object.freeze(["php-native", Object.freeze({ name: "example/directprooferasure", version: "1.0.0" })])
	, "php-wasm": Object.freeze([
		"php-wasm"
		, Object.freeze({
			npm: Object.freeze({ name: "@example/directprooferasure-php-wasm", version: "1.0.0" })
			, composer: Object.freeze({ name: "example/directprooferasure-php-wasm", version: "1.0.0" })
		})
	])
	, python: Object.freeze(["pypi", Object.freeze({ name: "directprooferasure", version: "1.0.0" })])
	, ruby: Object.freeze(["rubygems", Object.freeze({ name: "directprooferasure", version: "1.0.0" })])
	, rust: Object.freeze(["cargo", Object.freeze({ name: "directprooferasure", version: "1.0.0" })])
	, "wit-wasi": Object.freeze(["wit-wasi", Object.freeze({ name: "directprooferasure", version: "1.0.0" })])
});

/**
 * Build the independent runtime signature and exact erased proof identities.
 *
 * @param root0 - Optional fixture identity.
 * @param root0.module - Lean module and namespace.
 * @param root0.component - Binding IR component id.
 */
export const directProofErasureReview = ({
	module = directProofErasureModule, component = "directprooferasure"
} = {}) => {
	const document = corpusReviewedIr({ id: component }, [{
		name: `${module}.keep`, parameters: ["uint32"], result: "uint32"
	}]);
	const declaration = document.declarations[0];
	declaration.parameters[0].name = "value";
	declaration.source.extensions[directProofErasureKey] = {
		parameters: directProofErasureProofs.map(proof => ({ ...proof }))
	};
	return document;
};

/**
 * Assert no proof became a runtime parameter, result placeholder or field.
 *
 * @param document - Compiled or independently reviewed Binding IR.
 * @param module - Expected Lean module and namespace.
 * @param parameterNames - Admitted compiler or reviewed runtime parameter names.
 */
export const assertDirectProofErasureIr = (
	document, module = directProofErasureModule, parameterNames = ["value"]
) => {
	assert.ok(Array.isArray(parameterNames) && parameterNames.length
		&& parameterNames.every(name => typeof name === "string"));
	const declaration = document.declarations.find(
		item => item.id === `lean:${module}.keep`
	);
	assert.ok(declaration);
	assert.equal(declaration.parameters.length, 1);
	assert.ok(parameterNames.includes(declaration.parameters[0].name));
	assert.deepEqual(declaration.parameters[0].type
		, { kind: "primitive", name: "uint32" });
	assert.deepEqual(declaration.result.type
		, { kind: "primitive", name: "uint32" });
	assert.deepEqual(declaration.source.extensions[directProofErasureKey]
		, { parameters: directProofErasureProofs });
	assert.ok(!document.types.some(type => type.source?.extensions?.[directProofErasureKey]));
	return declaration;
};
