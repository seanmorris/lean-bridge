/**
 * Refusal and caller controls for the direct dependent-signature fixture.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import {
	reviewedSourceSelection, validateReviewedSource
} from "../../src/analyze/reviewed-source.mjs";
import {
	dependentSignatureProfiles, dependentSignatureRefinement
	, dependentSignatureReview
	, dependentSignatureRoutes, dependentSignatureSelection
	, exerciseDependentSignature
} from "./dependent-signature-fixture.mjs";

const reviewInput = document => {
	const source = canonicalJson(document);
	return {
		schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document)
	};
};

test("both author routes select the exact direct dependency", () => {
	assert.deepEqual(dependentSignatureRoutes, ["ordinary-source", "reviewed-ir"]);
	assert.equal(dependentSignatureProfiles.length, 10);
	const ordinary = dependentSignatureSelection("ordinary-source");
	const reviewed = dependentSignatureSelection("reviewed-ir");
	assert.equal(ordinary.reviewed, false);
	assert.equal(reviewed.reviewed, true);
	assert.deepEqual(ordinary.configuration.exports
		, ["DependentSignatures.dependent"]);
	assert.equal(Object.hasOwn(ordinary.configuration, "contracts"), false);
	assert.equal(Object.hasOwn(reviewed.configuration, "exports"), false);
	assert.equal(Object.hasOwn(reviewed.configuration, "contracts"), false);
	assert.deepEqual(reviewed.expected, ordinary.expected);
	const input = reviewInput(reviewed.expected);
	validateReviewedSource(input);
	assert.deepEqual(reviewedSourceSelection(input), {
		exports: ["DependentSignatures.dependent"], arities: []
	});
});

test("reviewed input refuses altered source or dependency positions", () => {
	const mutations = [
		document => {
			document.declarations[0].source.extensions[
				"lean-lang.org/refinements"
			].parameters[1].parameter = 1;
		}
		, document => {
			const declaration = document.declarations[0];
			declaration.source.extensions[
				"lean-lang.org/refinements"
			].parameters = [structuredClone(dependentSignatureRefinement), null];
		}
		, document => {
			document.declarations[0].parameters[0].type.name = "int";
		}
		, document => {
			document.declarations[0].source.declaration
				= "DependentSignatures.changed";
		}
	];
	for(const mutate of mutations)
	{
		const document = dependentSignatureReview();
		mutate(document);
		assert.throws(() => validateReviewedSource(reviewInput(document)));
	}
});

test("caller controls cover zero, exact, over, huge and recovery cases", () => {
	let runtimeCalls = 0;
	const dependent = (bound, value) => {
		if(value >= bound)
			throw new RangeError("dependent.value is not below its Fin bound");
		runtimeCalls++;
		return bound + value;
	};
	assert.deepEqual(exerciseDependentSignature(dependent), {
		checks: 11, calls: 7, rejections: 4, recoveries: 4
	});
	assert.equal(runtimeCalls, 7);
});
