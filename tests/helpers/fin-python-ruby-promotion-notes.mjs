/**
 * Describe each host's new observations without losing its earlier evidence scope.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Correct notes only; retain every profile, position, stage state and evidence link.
 *
 * @param inventory - Mutable type inventory containing the Python/Ruby promotion.
 */
export const refineFinPythonRubyPromotionNotes = inventory => {
	for(const profile of ["python", "ruby"])
	{
		const runtime = profile === "python" ? "Python 3.11.16 and 3.12.14" : "Ruby 3.3.12";
		const archive = profile === "python" ? "wheel" : "gem";
		for(const sourcePath of ["ordinary-source", "reviewed-ir"])
		{
			const ordinary = sourcePath === "ordinary-source";
			const id = ordinary ? `native-fin-${profile}-ordinary-source` : `reviewed-fin-${profile}-scalar-containers`;
			const structural = inventory.observations.find(item => item.id === id);
			const field = inventory.observations.find(item => item.id === `native-nominal-fin-${profile}-${sourcePath}`);
			assert.ok(structural && field);
			for(const observation of [structural, field])
			{
				observation.stages.packaging.note = `Two independent author roots reproduce the original ${archive} before source/build deletion and offline compiler-free installation.`;
				observation.stages.installedExecution.note = `Separate TAP, queue and runner records identify ${runtime} for the new local valid, invalid and recovery checks. Original reports retain exact model, review, caller and archive identities; these runs do not measure dispatch.`;
			}
			field.scope = `${sourcePath} ${profile} nonrecursive, nongeneric record and active variant fields retain closed Fin bounds through Array/List/Option/Prod/Except compositions. Each run executes 2053 checks across all 13 fixture exports. Separate execution logs identify ${runtime}.`;
			structural.limitations[1] = profile === "ruby" && ordinary
				? "Ordinary Ruby dispatch is not counted in this host's process, which loads bundled libraries privately. Earlier scalar evidence compares those libraries byte-for-byte with the C archive from the same build; the new product/Array reports add no dispatch measurements."
				: "The new product and Array-of-product reports have no dispatch observations. Any earlier dispatch observations remain limited to the hosts and signatures in their original reports.";
			if(profile === "python" && ordinary)
			{
				structural.stages.packaging.note += " Earlier installed scalar tests also compare bundled C libraries and verify receipts.";
				structural.stages.installedExecution.note += " Earlier scalar tests run on Python 3.11/3.12 with Python dispatch probes; earlier container checks run in the CI Python environment with dispatch measured separately in C. The new local reports do not replace that hosted evidence.";
			}
			if(profile === "ruby" && ordinary)
			{
				structural.stages.packaging.note += " Earlier scalar checks also reproduce the C archive and verify the package-set receipt.";
				structural.stages.installedExecution.note += " A bound violation raises RangeError naming the parameter and bound; non-Integer input raises TypeError, and negatives raise the Nat RangeError. Empty arrays and absent options remain valid for Fin 0; invalid first, middle and last elements are rejected, absent payloads are not read, and caller data stays unchanged.";
			}
		}
	}
};
