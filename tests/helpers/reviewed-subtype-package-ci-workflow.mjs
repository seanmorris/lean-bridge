/**
 * Wire reviewed C/C++ and npm package checks into enforced consumer jobs.
 *
 * @file
 */
import assert from "node:assert/strict";

const runner = "bash scripts/run-reviewed-subtype-package-ci.sh";
const nativeAnchor = "          test -s build/native-subtype/c-cpp.json\n";
const nativeUploadAnchor = "            build/native-subtype/c-cpp.json\n";
const nativeCommand = 'consumer_command="$consumer_command && LEAN_BRIDGE_SUBTYPE_PROFILES=c,cpp node --test tests/native-subtype.test.mjs';
const npmAnchor = "      - name: Account Lean source entry on every installed scalar Fin call (instrumented probe packages)\n";
const outcome = "steps.reviewed_fin_npm.outcome == 'success' && ";
const enforced = "        if: steps.consumer.outcome != 'success' || steps.type_corpus_npm.outcome != 'success' || steps.reviewed_fin_npm.outcome != 'success'\n";
export const reviewedSubtypePackageNativeBlock = `          ${runner} c-cpp\n`;
export const reviewedSubtypePackageNativeUpload = "            build/reviewed-subtype-package-ci/c-cpp/\n";
export const reviewedSubtypePackageNpmBlock = `      - name: Check independently reviewed Subtype npm packages and strict TypeScript
        id: reviewed_subtype_npm
        timeout-minutes: 60
        env:
          LEAN_BRIDGE_LAKE_ENGINE: build/locked-lake-engine/bin/lean-bridge-component-engine
          LEAN_BRIDGE_LAKE_RUNTIME_ROOT: build/consumer-ci-runtime/lazy
        run: ${runner} npm
      - name: Preserve reviewed Subtype npm package records
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: reviewed-subtype-package-npm-\${{ github.sha }}
          path: build/reviewed-subtype-package-ci/npm/
          if-no-files-found: error
          retention-days: 30
`;
const once = (source, from, to) => {
	assert.equal(source.split(from).length, 2, from); return source.replace(from, () => to);
};
const nodeCommands = (source, enabled) => {
	let count = 0;
	const result = source.split("\n").map(line => {
		if(!/--consumer node-(?:javascript|typescript) /u.test(line)) return line;
		count++;
		const end = 'tests/generic-records.test.mjs"', extended = `tests/generic-records.test.mjs && ${runner} npm"`;
		return enabled ? once(line, end, extended) : once(line, extended, end);
	}).join("\n");
	assert.equal(count, 2); return result;
};

/**
 * Extend commands and uploads while leaving unrelated workflow text unchanged.
 *
 * @param source - Workflow before these additions.
 */
export const enableReviewedSubtypePackageWorkflow = source => {
	assert.ok(!source.includes(runner));
	source = once(source, nativeAnchor, nativeAnchor + reviewedSubtypePackageNativeBlock);
	source = once(source, nativeUploadAnchor, nativeUploadAnchor + reviewedSubtypePackageNativeUpload);
	source = once(source, nativeCommand + '"', nativeCommand + ` && ${runner} c-cpp"`);
	source = once(source, npmAnchor, reviewedSubtypePackageNpmBlock + npmAnchor);
	assert.equal(source.split(outcome).length, 3);
	source = source.replaceAll(outcome, outcome + "steps.reviewed_subtype_npm.outcome == 'success' && ");
	source = once(source, enforced, enforced.trimEnd() + " || steps.reviewed_subtype_npm.outcome != 'success'\n");
	return nodeCommands(source, true);
};

/**
 * Remove exactly this milestone's additions for predecessor-preservation tests.
 *
 * @param source - Workflow with both required package gates.
 */
export const disableReviewedSubtypePackageWorkflow = source => {
	source = once(source, reviewedSubtypePackageNativeBlock, "");
	source = once(source, reviewedSubtypePackageNativeUpload, "");
	source = once(source, nativeCommand + ` && ${runner} c-cpp"`, nativeCommand + '"');
	source = once(source, reviewedSubtypePackageNpmBlock, "");
	const extended = outcome + "steps.reviewed_subtype_npm.outcome == 'success' && ";
	assert.equal(source.split(extended).length, 3); source = source.replaceAll(extended, outcome);
	source = once(source, enforced.trimEnd() + " || steps.reviewed_subtype_npm.outcome != 'success'\n", enforced);
	source = nodeCommands(source, false);
	assert.ok(!source.includes(runner)); return source;
};

/**
 * Reject unenforced, misplaced or weakened gates and incomplete artifact uploads.
 *
 * @param source - Current consumer workflow.
 */
export const assertReviewedSubtypePackageWorkflow = source => {
	assert.equal(enableReviewedSubtypePackageWorkflow(disableReviewedSubtypePackageWorkflow(source)), source);
	const stepAt = index => source.slice(source.lastIndexOf("\n      - name: ", index), source.indexOf("\n      - name: ", index));
	const jobAt = index => [...source.slice(0, index).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];
	const nativeIndex = source.indexOf(reviewedSubtypePackageNativeBlock), nativeStep = stepAt(nativeIndex);
	assert.equal(jobAt(nativeIndex), "native-consumers");
	assert.ok(nativeStep.includes("        id: type_corpus_c_family\n"));
	assert.ok(nativeStep.includes("        if: matrix.profile == 'c-family'\n"));
	assert.ok(nativeStep.includes(nativeAnchor + reviewedSubtypePackageNativeBlock));
	assert.doesNotMatch(nativeStep, /set \+e|\|\| true/u);
	assert.ok(source.includes("steps.type_corpus_c_family.outcome != 'success'"));
	const upload = stepAt(source.indexOf(reviewedSubtypePackageNativeUpload));
	assert.ok(upload.includes("if: always() && matrix.profile == 'c-family'"));
	assert.ok(upload.includes("uses: actions/upload-artifact@v7"));
	assert.ok(upload.includes("if-no-files-found: error"));
	const npmIndex = source.indexOf(reviewedSubtypePackageNpmBlock);
	assert.equal(jobAt(npmIndex), "node-consumers");
	assert.ok(source.indexOf("nix build .#component-build-engine --out-link build/locked-lake-engine", source.indexOf("  node-consumers:\n")) < npmIndex);
	assert.equal((source.match(/bash scripts\/run-reviewed-subtype-package-ci\.sh c-cpp/gu) ?? []).length, 2);
	assert.equal((source.match(/bash scripts\/run-reviewed-subtype-package-ci\.sh npm/gu) ?? []).length, 3);
};
