/**
 * Shared ordinary and independently reviewed optional-parameter contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { optionalParameterIr } from "./optional-parameter-ir.mjs";

export const optionalParameterFixture
	= "tests/fixtures/onboarding/optional-parameters";
export const optionalParameterModule = "Defaults";
export const optionalParameterExports = Object.freeze([
	"word", "natural", "text", "character", "maybe", "present", "unitValue"
].map(name => `${optionalParameterModule}.${name}`));
export const optionalParameterProfiles = Object.freeze([
	"browser-javascript", "browser-react", "browser-worker", "c", "cpp"
	, "dotnet", "java", "kotlin", "node-javascript", "node-typescript"
	, "perl", "php-native", "php-wasm", "python", "ruby", "rust", "wit-wasi"
]);
export const optionalParameterTargets = Object.freeze({
	"browser-javascript": Object.freeze(["npm", Object.freeze({ name: "optional-parameters", version: "1.0.0" })])
	, "browser-react": Object.freeze(["npm", Object.freeze({ name: "optional-parameters", version: "1.0.0" })])
	, "browser-worker": Object.freeze(["npm", Object.freeze({ name: "optional-parameters", version: "1.0.0" })])
	, c: Object.freeze(["c", Object.freeze({ name: "defaults", version: "1.0.0" })])
	, cpp: Object.freeze(["cpp", Object.freeze({ name: "defaults", version: "1.0.0" })])
	, dotnet: Object.freeze(["nuget", Object.freeze({ name: "OptionalParameters.Api", version: "1.0.0" })])
	, java: Object.freeze(["maven", Object.freeze({ name: "org.leanbridge:optionalparameters", version: "1.0.0" })])
	, kotlin: Object.freeze(["maven", Object.freeze({ name: "org.leanbridge:optionalparameters", version: "1.0.0" })])
	, "node-javascript": Object.freeze(["npm", Object.freeze({ name: "optional-parameters", version: "1.0.0" })])
	, "node-typescript": Object.freeze(["npm", Object.freeze({ name: "optional-parameters", version: "1.0.0" })])
	, perl: Object.freeze(["cpan", Object.freeze({ module: "LeanBridge::OptionalParameters", version: "1.000" })])
	, "php-native": Object.freeze(["php-native", Object.freeze({ name: "example/optionalparameters", version: "1.0.0" })])
	, "php-wasm": Object.freeze([
		"php-wasm"
		, Object.freeze({
			npm: Object.freeze({ name: "@example/optionalparameters-php-wasm", version: "1.0.0" })
			, composer: Object.freeze({ name: "example/optionalparameters-php-wasm", version: "1.0.0" })
		})
	])
	, python: Object.freeze(["pypi", Object.freeze({ name: "optionalparameters", version: "1.0.0" })])
	, ruby: Object.freeze(["rubygems", Object.freeze({ name: "optionalparameters", version: "1.0.0" })])
	, rust: Object.freeze(["cargo", Object.freeze({ name: "optionalparameters", version: "1.0.0" })])
	, "wit-wasi": Object.freeze(["wit-wasi", Object.freeze({ name: "optionalparameters", version: "1.0.0" })])
});

/** Build the independently reviewed optional-parameter surface. */
export const optionalParameterReview = () => optionalParameterIr();

/**
 * Require every selected function to retain one typed optional parameter and
 * its compiler-authenticated default.
 *
 * @param document - Compiled or independently reviewed Binding IR.
 * @param parameterNames - Exact admitted compiler and reviewed binder names.
 */
export const assertOptionalParameterIr = (
	document, parameterNames = ["value0"]
) => {
	assert.ok(Array.isArray(parameterNames) && parameterNames.length
		&& parameterNames.every(name => typeof name === "string"));
	const expected = optionalParameterReview();
	assert.equal(document.declarations.length, expected.declarations.length);
	for(const expectedDeclaration of expected.declarations)
	{
		const declaration = document.declarations.find(item =>
			item.id === expectedDeclaration.id);
		assert.ok(declaration, expectedDeclaration.id);
		assert.equal(declaration.parameters.length, 1);
		assert.ok(parameterNames.includes(declaration.parameters[0].name));
		assert.equal(declaration.parameters[0].optional, true);
		assert.deepEqual(declaration.parameters[0].default
			, expectedDeclaration.parameters[0].default);
		assert.deepEqual(declaration.parameters[0].type
			, expectedDeclaration.parameters[0].type);
		assert.deepEqual(declaration.result.type, expectedDeclaration.result.type);
	}
	return document.declarations;
};
