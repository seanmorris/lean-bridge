/**
 * Keep PHP-Wasm package guidance consistent across scalar, container and Subtype fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { createPhpWasmCopiedModel } from "../../src/build/native-model.mjs";
import { phpWasmFinReadme } from "../../src/release/php-wasm-copied-package.mjs";
import { reviewedScalarHostIr } from "./reviewed-scalar-host-fixture.mjs";
import { finContainerReviewedIr } from "./reviewed-fin-container-fixture.mjs";
import { finProductCompilerInput } from "./fin-product-model.mjs";
import { finRecordCompilerInput } from "./fin-record-model.mjs";
import { phpWasmSubtypeReview } from "./php-wasm-subtype-fixture.mjs";

test("PHP-Wasm refinement READMEs do not mislabel supported fields, containers or reviewed APIs", () => {
	const inputs = [reviewedScalarHostIr(), finContainerReviewedIr()
		, ...[finProductCompilerInput(), finRecordCompilerInput()].map(input => createPhpWasmCopiedModel(input).bindingIr)
		, phpWasmSubtypeReview()];
	for(const ir of inputs)
	{
		const model = compileCopiedPhpModel(ir, { integerBits: 32, structuredCallables: true, lists: true, variants: true });
		const readme = phpWasmFinReadme(model);
		assert.match(readme, /Fin inside callbacks or generic record instantiations is not supported in PHP-Wasm packages\./u);
		assert.doesNotMatch(readme, /(?:Fin|Subtype) inside[^\n]*reviewed Binding IR[^\n]*not supported/u);
		assert.doesNotMatch(readme, /Fin inside (?:containers|records|variants)[^\n]*not supported/u);
	}
	const subtype = phpWasmFinReadme(compileCopiedPhpModel(phpWasmSubtypeReview(), { integerBits: 32 }));
	assert.match(subtype, /^\n## Checked refinements\n/u);
	assert.match(subtype, /Subtype inside containers, records, variants or callbacks is not supported/u);
	assert.match(subtype, /Subtypes\.normalizedEven/u);
	const scalar = phpWasmFinReadme(compileCopiedPhpModel(reviewedScalarHostIr(), { integerBits: 32 }));
	assert.match(scalar, /^\n## Bounded integers\n/u);
});
