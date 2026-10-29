/**
 * Replace the exact pre-promotion HostNull authoring boundaries after complete
 * hosted acceptance is independently replayed.
 *
 * @file
 */
import assert from "node:assert/strict";

export const hostNullCompleteDocumentationPaths = Object.freeze({
	existingPackage: "docs/lean/existing-package.md"
	, exportDecisions: "docs/lean/export-decisions.md"
});

const replaceOnce = (source, previous, next, label) => {
	assert.equal(source.split(previous).length, 2
		, `Expected one HostNull documentation marker: ${label}`);
	return source.replace(previous, next);
};

/**
 * Render only the exact evidence-gated authoring prose transitions.
 *
 * @param sources - Current canonical documentation by logical name.
 */
export const renderHostNullCompleteDocumentation = sources => {
	assert.deepEqual(Object.keys(sources).sort()
		, Object.keys(hostNullCompleteDocumentationPaths).sort());
	const output = { ...sources };
	output.exportDecisions = replaceOnce(output.exportDecisions
		, `collapsing either \`Option.none\` into null. JavaScript/TypeScript and the PHP
profiles have installed package acceptance for copied parameters, results,
fields and synchronous callback positions. Other targets require their own
installed evidence; selecting a target never silently drops this distinction.`
		, `collapsing either \`Option.none\` into null. The [complete hosted HostNull
matrix](../evidence/host-null-complete-20261029/index.json) establishes copied
parameters, results, fields and synchronous callback positions in installed
ordinary-source and independently reviewed packages across all seventeen
consumer profiles. Owned or asynchronous values and generic or dependent
HostNull combinations remain separate work; selecting a target never silently
drops this distinction.`
		, "Lean export decision boundary");
	output.existingPackage = replaceOnce(output.existingPackage
		, `See [Choose an export
shape](export-decisions.md#select-an-explicit-host-null-wrapper) for semantics
and the [PHP guide](../php.md#explicit-host-null) for its consumer values.`
		, `See [Choose an export
shape](export-decisions.md#select-an-explicit-host-null-wrapper) for semantics,
the [profile conversion tables](../reference/types.md#full-type-surface) for
every generated carrier, and the [PHP guide](../php.md#explicit-host-null) for
its nested-null consumer example.`
		, "existing-package HostNull references");
	return output;
};
