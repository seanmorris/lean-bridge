/**
 * Replace exact pre-promotion direct dependent-signature author boundaries
 * only after the complete hosted archive has been independently replayed.
 *
 * @file
 */
import assert from "node:assert/strict";

export const dependentSignatureCompleteDocumentationPaths = Object.freeze({
	existingPackage: "docs/lean/existing-package.md"
	, exportDecisions: "docs/lean/export-decisions.md"
});

const replaceOnce = (source, previous, next, label) => {
	assert.equal(source.split(previous).length, 2
		, `Expected one dependent-signature documentation marker: ${label}`);
	return source.replace(previous, next);
};

/**
 * Render the exact evidence-gated direct dependent-signature transition.
 *
 * @param sources - Current canonical documentation by logical name.
 */
export const renderDependentSignatureCompleteDocumentation = sources => {
	assert.deepEqual(Object.keys(sources).sort()
		, Object.keys(dependentSignatureCompleteDocumentationPaths).sort());
	const output = { ...sources };
	output.existingPackage = replaceOnce(output.existingPackage
		, "Missing instances, unresolved types, dependent runtime inputs, effects and admitted implementations stop the build."
		, "Missing instances, unresolved types, unsupported dependent runtime inputs, effects and admitted implementations stop the build."
		, "generic specialization refusal boundary");
	output.existingPackage = replaceOnce(output.existingPackage
		, `Public \`analyze\` continues to use the scalar profile; use the CPAN build to check native-only signatures. Specialization emits separately named concrete functions, without generic host-language overload dispatch.

### Name instantiations of generic structures`
		, `Public \`analyze\` continues to use the scalar profile; use the CPAN build to check native-only signatures. Specialization emits separately named concrete functions, without generic host-language overload dispatch.

### Export a direct value-dependent Fin parameter

Lean Bridge supports the direct copied form where an explicit \`Fin\` parameter
is indexed by an earlier explicit \`Nat\` parameter:

\`\`\`lean
def mirror (bound : Nat) (value : Fin bound) : Nat :=
  bound - 1 - value.val
\`\`\`

Export the declaration normally. The host API takes two values in that
profile's ordinary \`Nat\` representation; callers do not supply a proof. The
generated adapter decodes both live arguments and rejects \`value >= bound\`
before constructing \`Fin bound\` or entering \`mirror\`. A changing bound is
therefore checked on every call rather than frozen into package metadata.

An independently reviewed Binding IR records the second parameter as a
\`fin-parameter\` dependency on the first. Fresh Lean metadata must reproduce
that exact relation. A missing, later, non-\`Nat\`, forged or otherwise altered
dependency stops analysis or reconciliation.

The [complete hosted dependent-signature archive](../evidence/dependent-signatures-hosted-20261028/index.json)
replays this form across all seventeen consumer profiles and both author
routes, including zero, endpoint, changing and huge bounds, rejection without
caller mutation, and recovery. This contract does not admit dependent results,
fields, callbacks, owned values, arbitrary index expressions or open dependent
structures.

### Name instantiations of generic structures`
		, "direct dependent-signature author section");
	output.exportDecisions = replaceOnce(output.exportDecisions
		, "Open generics, dependent signatures, asynchronous operations and retained host callbacks require further work."
		, "Open generics, dependent signatures outside the supported direct earlier-Nat `Fin` parameter form, asynchronous operations and retained host callbacks require further work."
		, "Perl dependent-signature boundary");
	return output;
};
