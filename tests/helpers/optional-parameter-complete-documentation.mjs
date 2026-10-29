/**
 * Replace exact pre-promotion optional-parameter authoring boundaries only
 * after the complete hosted archive has been independently replayed.
 *
 * @file
 */
import assert from "node:assert/strict";

export const optionalParameterCompleteDocumentationPaths = Object.freeze({
	existingPackage: "docs/lean/existing-package.md"
	, exportDecisions: "docs/lean/export-decisions.md"
});

const replaceOnce = (source, previous, next, label) => {
	assert.equal(source.split(previous).length, 2
		, `Expected one optional-parameter documentation marker: ${label}`);
	return source.replace(previous, next);
};

/**
 * Render the exact evidence-gated optional-parameter documentation change.
 *
 * @param sources - Current canonical documentation by logical name.
 */
export const renderOptionalParameterCompleteDocumentation = sources => {
	assert.deepEqual(Object.keys(sources).sort()
		, Object.keys(optionalParameterCompleteDocumentationPaths).sort());
	const output = { ...sources };
	output.exportDecisions = replaceOnce(output.exportDecisions
		, "| Defaults, optional arguments, host null | Keep omitted input, declared defaults, host null, Unit, and Option.None distinct. |"
		, "| Defaults, optional arguments, host null | Authenticate declared defaults and expose target-idiomatic omission without changing the full-arity ABI. Keep omitted input, an explicit default value, host null, Unit, and Option.None distinct. |"
		, "Lean export decision row");
	output.existingPackage = replaceOnce(output.existingPackage
		, "Schema-3 reviewed builds reject resources and callbacks inside copied containers. Resource-containing values require a schema-4 contract and an ownership-aware target. Both versions reject defaults, optional arguments, asynchronous operations, author-supplied compiler evidence and assurance claims. Do not combine a review with `exports`, `resources`, `ownedAggregates`, `arities`, `specializations` or `contracts` in the configuration."
		, `Schema-3 reviewed builds reject resources and callbacks inside copied containers. Resource-containing values require a schema-4 contract and an ownership-aware target. Both versions accept compiler-authenticated optional copied parameters whose typed defaults reconcile with fresh Lean metadata. They reject asynchronous operations, author-supplied compiler evidence and assurance claims. Do not combine a review with \`exports\`, \`resources\`, \`ownedAggregates\`, \`arities\`, \`specializations\` or \`contracts\` in the configuration.

### Export optional parameters

Lean Bridge retains a Lean-declared default in Binding IR while keeping the
compiled function ABI full-arity. Generated packages expose omission through
the target's idiomatic public surface: a default argument or overload where the
language supports one, otherwise a generated omission function or macro. An
omitted argument selects the authenticated default. Supplying that same value
explicitly remains an ordinary supplied value.

Omission never means null, Unit or \`Option.none\`. Those values keep their own
host representations and validation paths. The [complete hosted
optional-parameter archive](../evidence/optional-parameter-hosted-20261029/index.json)
replays ordinary-source and independently reviewed installed packages across
all seventeen consumer profiles. It covers copied parameters only; optional
results, fields, callbacks, resources and asynchronous operations remain
separate contracts.`
		, "existing-package optional boundary");
	return output;
};
