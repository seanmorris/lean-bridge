/**
 * Source-only admission for checked callback annotations in CPAN packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { validatePerlModel } from "../src/backends/perl/generate.mjs";
import { finCallbackCompilerModel } from "./helpers/fin-callback-model.mjs";

test("Perl admits compiler-checked callback Fin annotations without widening its native schema", () => {
	const model = finCallbackCompilerModel();
	assert.ok(model.types.some(type => type.checked !== undefined));
	assert.doesNotThrow(() => validatePerlModel(model));
	const malformed = structuredClone(model);
	malformed.types[0].unexpectedRepresentationField = true;
	assert.throws(() => validatePerlModel(malformed), /invalid native type fields/u);
});
