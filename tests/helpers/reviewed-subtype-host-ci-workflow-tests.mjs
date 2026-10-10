/**
 * Reject missing reviewed native lanes, weak enforcement and lost producer evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertReviewedSubtypeHostWorkflow, disableReviewedSubtypeHostWorkflow, enableReviewedSubtypeHostWorkflow, reviewedSubtypeHostCiBlock, reviewedSubtypeHostCiCommand, reviewedSubtypeHostCiGroups, reviewedSubtypeHostCiUpload } from "./reviewed-subtype-host-ci-workflow.mjs";
import { beforeReviewedSubtypeHostCiSource } from "./reviewed-subtype-host-ci-history.mjs";
import "./reviewed-subtype-host-ci-history-tests.mjs";

test("reviewed native CI workflows preserve every previous command while enabling all twelve runtime selections", async () => {
	for(const name of ["consumer-matrix.yml", "perl-consumer.yml"])
	{
		const path = ".github/workflows/" + name, current = await readFile(path, "utf8"), previous = beforeReviewedSubtypeHostCiSource(path, current);
		assertReviewedSubtypeHostWorkflow(current, name);
		assert.notEqual(current, previous);
		assert.equal(disableReviewedSubtypeHostWorkflow(current, name), previous);
		assert.equal(enableReviewedSubtypeHostWorkflow(previous, name), current);
	}
	assert.deepEqual(reviewedSubtypeHostCiGroups.flatMap(item => item.lanes), ["php-native", "python311", "python312", "rust", "dotnet", "jvm", "ruby", "wit-wasi", "perl-${{ matrix.configuration }}"]);
	const perl = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	for(const configuration of ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"])
		assert.ok(perl.includes(`          - ${configuration}\n`));
	assert.ok(perl.includes('export LEAN_BRIDGE_CORPUS_PERL="$PWD/.toolchains/perl/$CORPUS_PERL_CONFIGURATION/bin/perl"'));
	assert.ok((await readFile("tests/helpers/reviewed-subtype-host-ci-report-tests.mjs", "utf8")).includes('import "./reviewed-subtype-host-ci-workflow-tests.mjs";'));
	const runner = await readFile("scripts/run-reviewed-subtype-host-ci.sh", "utf8");
	assert.ok(runner.includes("set -euo pipefail\n"));
	assert.ok(runner.includes('2>&1 | tee "$output/run.tap"'));
	assert.ok(runner.includes('node scripts/check-reviewed-subtype-host-reports.mjs --profiles "$profiles"'));
});

test("reviewed native CI workflows reject omissions, wrong floors, moved gates and discarded originals", async () => {
	for(const name of ["consumer-matrix.yml", "perl-consumer.yml"])
	{
		const current = await readFile(".github/workflows/" + name, "utf8");
		for(const item of reviewedSubtypeHostCiGroups.filter(value => value.workflow === name))
		{
			const block = reviewedSubtypeHostCiBlock(item), lane = item.lanes[0], invocation = reviewedSubtypeHostCiCommand(lane), upload = reviewedSubtypeHostCiUpload(lane);
			const mutations = [current.replace(block, "")
				, current.replace(block, "          set +e\n" + block)
				, current.replace(block, block.replace("\n", " || true\n"))
				, current.replace(block, "      - name: misplaced\n        run: |\n" + block)
				, current.replace(invocation, invocation.replace("bash ", "true "))
				, current.replace(upload, "")
				, current.replace(upload, upload.replace("/\n", "/records/report.json\n"))
				, current.replace(`  ${item.job}:\n`, "  wrong-job:\n")
				, current.replace(`          LEAN_BRIDGE_SUBTYPE_PROFILES=${item.profiles} node --test tests/native-subtype.test.mjs\n`, "")];
			if(item.step) mutations.push(current.replace(`        id: ${item.step}\n`, "        id: unobserved\n")
				, current.replaceAll(`steps.${item.step}.outcome != 'success'`, "false")
				, current.replace(" && " + item.lanes.map(reviewedSubtypeHostCiCommand).join(" && "), ""));
			else mutations.push(current.replace(block, "        continue-on-error: true\n" + block));
			for(const changed of mutations) assert.throws(() => assertReviewedSubtypeHostWorkflow(changed, name), item.profiles);
		}
		for(const changed of [current.replaceAll("if: always()", "if: success()"), current.replaceAll("if-no-files-found: error", "if-no-files-found: ignore")])
			assert.throws(() => assertReviewedSubtypeHostWorkflow(changed, name));
	}
	const current = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const lane of ["python311", "python312"])
	{
		const command = reviewedSubtypeHostCiCommand(lane);
		assert.throws(() => assertReviewedSubtypeHostWorkflow(current.replace(command, command.replace(/collection_python\d+/u, "collection_python399")), "consumer-matrix.yml"));
	}
});
