/**
 * Replace exact pre-promotion proof-erasure authoring boundaries only after
 * the complete hosted archive has been independently replayed.
 *
 * @file
 */
import assert from "node:assert/strict";

export const directProofErasureCompleteDocumentationPaths = Object.freeze({
	existingPackage: "docs/lean/existing-package.md"
	, exportDecisions: "docs/lean/export-decisions.md"
});

const replaceOnce = (source, previous, next, label) => {
	assert.equal(source.split(previous).length, 2
		, `Expected one direct proof-erasure documentation marker: ${label}`);
	return source.replace(previous, next);
};

/**
 * Render the exact evidence-gated author documentation transition.
 *
 * @param sources - Current canonical documentation by logical name.
 */
export const renderDirectProofErasureCompleteDocumentation = sources => {
	assert.deepEqual(Object.keys(sources).sort()
		, Object.keys(directProofErasureCompleteDocumentationPaths).sort());
	const output = { ...sources };
	output.exportDecisions = replaceOnce(output.exportDecisions
		, "| Theorems and proof arguments | Let Lean determine runtime erasure. Retain theorem identities and assumptions in assurance metadata. |"
		, "| Theorems and direct proof arguments | Let Lean authenticate proof-only positions and erase their runtime slots. Retain theorem identities and assumptions in assurance metadata. Refuse proof-valued exports instead of fabricating host evidence. |"
		, "Lean export decision row");
	output.existingPackage = replaceOnce(output.existingPackage
		, `Prefer a small host-facing API with explicit input and result types. If you add wrapper functions, keep their behavior connected to the existing implementation and check the relevant theorems again. Do not erase a precondition merely to fit a host type. The [first component](first-component.md) is a complete supported npm example you can inspect as an existing library without recreating its files.

## Configure exports`
		, `Prefer a small host-facing API with explicit input and result types. If you add wrapper functions, keep their behavior connected to the existing implementation and check the relevant theorems again. Do not erase a precondition merely to fit a host type. The [first component](first-component.md) is a complete supported npm example you can inspect as an existing library without recreating its files.

### Export direct proof arguments

Lean Bridge authenticates direct proof-only binders, record fields and
synchronous callback positions from elaborated Lean metadata, then omits their
runtime slots. A downstream caller never supplies a proof, null, Unit or a
placeholder. Public signatures remain proof-free while theorem identities and
assumptions remain in assurance metadata.

A declaration whose runtime result is itself a proof is refused. Erasure also
does not remove runtime data or validation: a \`Fin\`, \`Subtype\`, checked
record or dependent payload still uses its checked host contract. The
[complete hosted direct proof-erasure archive](../evidence/direct-proof-erasure-hosted-20261030/index.json)
replays installed ordinary-source and independently reviewed packages across
all seventeen consumer profiles, both author routes and all six direct
positions.

## Configure exports`
		, "existing-package proof boundary");
	return output;
};
