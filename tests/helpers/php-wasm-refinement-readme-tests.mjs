/**
 * Keep PHP-Wasm package guidance consistent across scalar, container and Subtype fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCallablePhpGraphZendModel } from "../../src/backends/php/callable-graph-zend-model.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { createPhpWasmCopiedModel } from "../../src/build/native-model.mjs";
import {
	phpWasmFinReadme, phpWasmGraphRefinementReadme
} from "../../src/release/php-wasm-copied-package.mjs";
import { reviewedScalarHostIr } from "./reviewed-scalar-host-fixture.mjs";
import { finContainerReviewedIr } from "./reviewed-fin-container-fixture.mjs";
import { finProductCompilerInput } from "./fin-product-model.mjs";
import { finRecordCompilerInput } from "./fin-record-model.mjs";
import { phpWasmSubtypeReview } from "./php-wasm-subtype-fixture.mjs";
import { reviewedCallbackFinReview } from "./reviewed-callback-fin-fixture.mjs";

test("PHP-Wasm refinement READMEs do not mislabel supported fields, containers or reviewed APIs", () => {
	const inputs = [reviewedScalarHostIr(), finContainerReviewedIr()
		, ...[finProductCompilerInput(), finRecordCompilerInput()].map(input => createPhpWasmCopiedModel(input).bindingIr)
		, phpWasmSubtypeReview()];
	for(const ir of inputs)
	{
		const model = compileCopiedPhpModel(ir, { integerBits: 32, structuredCallables: true, lists: true, variants: true });
		const readme = phpWasmFinReadme(model);
		assert.match(readme
			, /Generic record instantiations remain unsupported in PHP-Wasm packages\./u);
		assert.match(readme
			, /Synchronous copied-value callbacks apply the same Fin checks at callback replies and returned-closure inputs\./u);
		assert.doesNotMatch(readme, /(?:Fin|Subtype) inside[^\n]*reviewed Binding IR[^\n]*not supported/u);
		assert.doesNotMatch(readme, /Fin inside (?:containers|records|variants)[^\n]*not supported/u);
	}
	const subtype = phpWasmFinReadme(compileCopiedPhpModel(phpWasmSubtypeReview(), { integerBits: 32 }));
	assert.match(subtype, /^\n## Checked refinements\n/u);
	assert.match(subtype, /Subtype inside records or variants is not supported/u);
	assert.match(subtype
		, /Synchronous copied-value callbacks check selected Subtype values at callback replies and returned-closure inputs\./u);
	assert.match(subtype, /Subtypes\.normalizedEven/u);
	const scalar = phpWasmFinReadme(compileCopiedPhpModel(reviewedScalarHostIr(), { integerBits: 32 }));
	assert.match(scalar, /^\n## Bounded integers\n/u);
});

test("PHP-Wasm callback-only READMEs name checked directions and recovery", () => {
	const ir = reviewedCallbackFinReview({ hostReply: true });
	const projection = compileCallablePhpGraphZendModel(ir, { finDirections: true });
	const readme = phpWasmGraphRefinementReadme(ir, projection);
	assert.match(readme, /^\n## Bounded integers\n/u);
	assert.match(readme
		, /PHP-produced callback replies and returned-closure arguments are checked before Lean continues/u);
	assert.match(readme, /with_recovery\(\$callback, \$value\)/u);
	assert.match(readme
		, /LeanReviewedcallbacks\\visit host callback: \$arg0\.arg0 < 5/u);
	assert.match(readme
		, /LeanReviewedcallbacks\\scaler returned Lean closure: returned closure\.arg0 < 10/u);
	assert.match(readme
		, /LeanReviewedcallbacks\\three host callback: \$arg0\.arg0 < 3; \$arg0\.result < 3/u);
	assert.doesNotMatch(readme, /Fin inside callbacks[^.]*not supported/u);
});

test("PHP-Wasm callback-only READMEs retain checked-record constructors and nested bounds", () => {
	const interval = { kind: "checked-record"
		, constructor: "CallbackCheckedRecords.mkInterval"
		, fields: ["digit"], arguments: [{ kind: "fin", bound: "5" }] };
	const projected = { ...interval, constructor: null };
	const hostRefinements = { parameters: [projected], result: interval };
	const closureRefinements = { parameters: [interval], result: projected };
	const primitive = name => ({ kind: "primitive", name });
	const declaration = (name, count) => ({
		id: `lean:CallbackCheckedRecords.${name}`, source: { extensions: {} }
		, parameters: Array.from({ length: count }, (_, index) => ({
			name: `arg${index}`, type: primitive("unit")
		}))
		, result: { type: primitive("unit") }
	});
	const readme = phpWasmGraphRefinementReadme({ types: [] }, {
		namespace: "LeanCallbackcheckedrecords"
		, functions: [{
			field: "call_host", parameterNames: ["callback"]
			, declaration: declaration("callHost", 1)
			, parameters: [{
				callback: { direction: "host", refinements: hostRefinements }
			}]
			, result: {}
		}
		, {
			field: "make_closure", parameterNames: [], parameters: []
			, declaration: declaration("makeClosure", 0)
			, result: {
				callback: { direction: "closure", refinements: closureRefinements }
			}
		}]
	});
	assert.match(readme, /^\n## Checked refinements\n/u);
	assert.match(readme, /LeanCallbackcheckedrecords\\call_host host callback: \$callback\.arg0 projects proof-backed record payload fields; \$callback\.arg0\.digit < 5; \$callback\.result checked by CallbackCheckedRecords\.mkInterval; \$callback\.result\.digit < 5/u);
	assert.match(readme, /LeanCallbackcheckedrecords\\make_closure returned Lean closure: returned closure\.arg0 checked by CallbackCheckedRecords\.mkInterval; returned closure\.arg0\.digit < 5; returned closure\.result projects proof-backed record payload fields; returned closure\.result\.digit < 5/u);
});
