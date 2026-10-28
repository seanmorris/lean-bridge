/**
 * Ordinary and independently reviewed inputs for a direct dependent Fin signature.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const dependentSignatureFixture
	= "tests/fixtures/onboarding/dependent-signatures";
export const dependentSignatureModule = "DependentSignatures";
export const dependentSignaturePackage = "dependentsignatures";
export const dependentSignatureRoutes = Object.freeze([
	"ordinary-source", "reviewed-ir"
]);
export const dependentSignatureProfiles = Object.freeze([
	"perl", "node-javascript", "node-typescript"
	, "browser-javascript", "browser-react", "browser-worker"
	, "php-native", "php-wasm", "c", "cpp"
]);
export const dependentSignatureRefinement = Object.freeze({
	kind: "fin-parameter", parameter: 0
});

/** Independently authored Binding IR for the same source declaration. */
export const dependentSignatureReview = () => {
	const ir = corpusReviewedIr({ id: dependentSignaturePackage }, [{
		name: "DependentSignatures.dependent"
		, parameters: ["nat", "nat"], result: "nat"
	}]);
	const declaration = ir.declarations[0];
	declaration.parameters[0].name = "bound";
	declaration.parameters[1].name = "value";
	declaration.source.extensions["lean-lang.org/refinements"] = {
		parameters: [null, structuredClone(dependentSignatureRefinement)]
		, result: null
	};
	return ir;
};

/**
 * Build one exact author input without deriving the review from compiler output.
 *
 * @param route - Exact author route.
 */
export const dependentSignatureSelection = route => {
	assert.ok(dependentSignatureRoutes.includes(route)
		, "Unknown dependent-signature route");
	const reviewed = route === "reviewed-ir";
	return {
		reviewed, expected: dependentSignatureReview()
		, configuration: {
			schemaVersion: 1, modules: [dependentSignatureModule]
			, targets: { npm: {
				name: dependentSignaturePackage, version: "1.0.0"
			} }
			, ...(reviewed ? {} : {
				exports: ["DependentSignatures.dependent"]
			})
		}
	};
};

/**
 * Exercise the public boundary while proving that rejected BigInts remain caller-owned.
 *
 * @param dependent - Installed public dependent function.
 */
export const exerciseDependentSignature = dependent => {
	const hugeBound = 1180591620717411303425n;
	const hugeValue = hugeBound - 1n;
	const accepted = [
		[1n, 0n, 1n]
		, [10n, 9n, 19n]
		, [hugeBound, hugeValue, hugeBound + hugeValue]
	];
	const rejected = [
		[0n, 0n]
		, [1n, 1n]
		, [10n, 11n]
		, [hugeBound, hugeBound]
	];
	let calls = 0;
	for(const [bound, value, expected] of accepted)
	{
		assert.equal(dependent(bound, value), expected);
		assert.equal(bound, accepted[calls][0]);
		assert.equal(value, accepted[calls][1]);
		calls++;
	}
	let rejections = 0;
	for(const [bound, value] of rejected)
	{
		const before = [bound, value];
		assert.throws(() => dependent(bound, value), /dependent.*value|below.*bound|Fin/u);
		assert.deepEqual([bound, value], before);
		rejections++;
		assert.equal(dependent(3n, 2n), 5n);
		calls++;
	}
	return { checks: accepted.length + rejected.length * 2
		, calls, rejections, recoveries: rejected.length };
};
