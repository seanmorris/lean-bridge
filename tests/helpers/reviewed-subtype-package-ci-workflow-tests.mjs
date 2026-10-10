/**
 * Preserve earlier consumer commands and reject weakened reviewed package CI gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertReviewedSubtypePackageWorkflow, disableReviewedSubtypePackageWorkflow, enableReviewedSubtypePackageWorkflow, reviewedSubtypePackageNativeBlock, reviewedSubtypePackageNativeUpload, reviewedSubtypePackageNpmBlock } from "./reviewed-subtype-package-ci-workflow.mjs";
import { beforeReviewedSubtypePackageCiSource } from "./reviewed-subtype-package-ci-history.mjs";

test("reviewed package workflow adds enforced C-family and locked-engine npm gates without deleting earlier commands", async () => {
	const path = ".github/workflows/consumer-matrix.yml", source = await readFile(path, "utf8");
	assertReviewedSubtypePackageWorkflow(source);
	const previous = beforeReviewedSubtypePackageCiSource(path, source);
	assert.notEqual(previous, source);
	assert.equal(disableReviewedSubtypePackageWorkflow(source), previous);
	assert.equal(enableReviewedSubtypePackageWorkflow(previous), source);
	assert.ok((await readFile("tests/reviewed-subtype-installed.test.mjs", "utf8")).includes('import "./helpers/reviewed-subtype-package-ci-tests.mjs";'));
});

test("reviewed package workflow rejects omissions, weakened outcomes and lost failure evidence", async () => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const changed of [source.replace(reviewedSubtypePackageNativeBlock, "")
		, source.replace(reviewedSubtypePackageNativeUpload, "")
		, source.replace(reviewedSubtypePackageNpmBlock, "")
		, source.replace(reviewedSubtypePackageNativeBlock, "          set +e\n" + reviewedSubtypePackageNativeBlock)
		, source.replace(reviewedSubtypePackageNativeBlock, reviewedSubtypePackageNativeBlock.trimEnd() + " || true\n")
		, source.replace(reviewedSubtypePackageNativeUpload, reviewedSubtypePackageNativeUpload.replace("/\n", "/records/report.json\n"))
		, source.replace("        id: reviewed_subtype_npm\n", "        continue-on-error: true\n        id: reviewed_subtype_npm\n")
		, source.replaceAll("steps.reviewed_subtype_npm.outcome", "steps.unmeasured.outcome")
		, source.replaceAll("steps.type_corpus_c_family.outcome != 'success'", "false")
		, source.replace("        id: type_corpus_c_family\n", "        id: unobserved\n")
		, source.replace("  node-consumers:\n", "  other-consumers:\n")
		, source.replace("  native-consumers:\n", "  other-native-consumers:\n")
		, source.replaceAll("if: always()", "if: success()")
		, source.replaceAll("if-no-files-found: error", "if-no-files-found: ignore")
		, source.replace(reviewedSubtypePackageNpmBlock, reviewedSubtypePackageNpmBlock.replace("build/locked-lake-engine/bin/lean-bridge-component-engine", "/other/engine"))])
		assert.throws(() => assertReviewedSubtypePackageWorkflow(changed));
});
