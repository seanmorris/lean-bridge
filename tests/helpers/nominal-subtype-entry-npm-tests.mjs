/**
 * Isolated controls for the npm entry probe's export classification; no build or install runs here.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { classifyNominalSubtypeEntryExports } from "./nominal-subtype-entry-npm.mjs";

test("nominal entry export classification names unreferenced validators instead of dropping them", () => {
	const names = ["memory", "lb_abc_lean", "lb_def_lean", "lb_abc_refinement_0", "lb_def_refinement_1", "lean_bridge_init", "lb_abc_make"];
	const javascript = "runtime.call(\"lean:NominalSubtypes.first\"); const symbols = [\"lb_abc_lean\", \"lb_def_lean\"];";
	const classified = classifyNominalSubtypeEntryExports(names, javascript);
	assert.deepEqual(classified, { exports: 7, adapters: 2, validators: { exported: ["lb_abc_refinement_0", "lb_def_refinement_1"], referencedByPackageJavaScript: [] } });
	const referenced = classifyNominalSubtypeEntryExports(names, javascript + " instance.exports.lb_abc_refinement_0(carrier);");
	assert.deepEqual(referenced.validators.referencedByPackageJavaScript, ["lb_abc_refinement_0"]);
	assert.throws(() => classifyNominalSubtypeEntryExports([], javascript), /empty/u);
	assert.throws(() => classifyNominalSubtypeEntryExports(["memory", "lb_abc_refinement_0"], javascript), /no exported adapters/u);
	assert.throws(() => classifyNominalSubtypeEntryExports(names, null));
});
