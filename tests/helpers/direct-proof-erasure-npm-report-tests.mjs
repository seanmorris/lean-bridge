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
	assert.throws(() => assertDirectProofErasureNpmDeclarationSurface(
		declaration("value"), "arg0"));
	assert.throws(() => assertDirectProofErasureNpmDeclarationSurface(
		declaration("arg0"), "value"));
});
