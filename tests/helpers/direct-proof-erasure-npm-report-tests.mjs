/**
 * Keep proof-erasure declaration checks focused on executable syntax rather
 * than truthful documentation comments.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertDirectProofErasureNpmDeclarationSurface
	, directProofErasureNpmParameterName
	, validateDirectProofErasureNpmBuildFact
} from "./direct-proof-erasure-npm-report.mjs";

const declaration = parameter => `// The proof arguments are compiler-owned.
/** Return a runtime word after proof erasure. */
export declare function keep(${parameter}: number): number;
declare const bindings: Readonly<{ readonly keep: typeof keep }>;
export default bindings;
`;

test("proof-erasure declarations allow explanatory proof comments", () => {
	assert.equal(assertDirectProofErasureNpmDeclarationSurface(
		declaration("arg0"), "arg0"), true);
	assert.equal(assertDirectProofErasureNpmDeclarationSurface(
		declaration("value"), "value"), true);
});

test("proof-erasure declarations reject proof-bearing public syntax", () => {
	for(const source of [
		declaration("arg0").replace("arg0: number", "proof: number")
		, declaration("arg0").replace("arg0: number", "arg0: True")
		, declaration("arg0").replace(
			"arg0: number", "arg0: number, _before: number")
		, declaration("arg0").replace("): number", "): proof")
	]) assert.throws(() => assertDirectProofErasureNpmDeclarationSurface(
		source, "arg0"));
});

test("proof-erasure declarations reject wrong route binders", () => {
	assert.equal(directProofErasureNpmParameterName("ordinary"), "arg0");
	assert.equal(directProofErasureNpmParameterName("reviewed"), "value");
	assert.throws(() => directProofErasureNpmParameterName("unknown"));
	assert.throws(() => assertDirectProofErasureNpmDeclarationSurface(
		declaration("value"), "arg0"));
	assert.throws(() => assertDirectProofErasureNpmDeclarationSurface(
		declaration("arg0"), "value"));
});

test("proof-erasure npm build facts require the semantic IR identity", () => {
	const digest = "a".repeat(64);
	const fact = {
		bindingIrFileSha256: digest, bindingIrSha256: digest
		, compilerAdaptersSha256: digest, componentArchiveSha256: digest
		, erasedProofs: 2, generatedLeanSha256: digest
		, receiptSha256: digest, runtimeArchiveSha256: digest
		, runtimeParameters: 1
	};
	assert.equal(validateDirectProofErasureNpmBuildFact(
		Object.fromEntries(Object.entries(fact).reverse())), true);
	for(const altered of [
		Object.fromEntries(Object.entries(fact)
			.filter(([key]) => key !== "bindingIrSha256"))
		, { ...fact, unexpected: true }
		, { ...fact, bindingIrSha256: "0" }
		, { ...fact, erasedProofs: 1 }
	]) assert.throws(() => validateDirectProofErasureNpmBuildFact(altered));
});
