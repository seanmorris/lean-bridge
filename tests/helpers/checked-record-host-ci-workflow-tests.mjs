/**
 * Reject missing checked-record lanes, weak enforcement and incomplete evidence uploads.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertCheckedRecordHostWorkflow as assertPreviousWorkflow, disableCheckedRecordHostWorkflow, enableCheckedRecordHostWorkflow, checkedRecordHostCiBlock, checkedRecordHostCiCommand, checkedRecordHostCiGroups, checkedRecordHostCiUpload } from "./checked-record-host-ci-workflow.mjs";
import { beforeCheckedRecordHostCiSource, checkedRecordHostCiHistoryPath } from "./checked-record-host-ci-history.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { reviewedSubtypeHostCiBlock, reviewedSubtypeHostCiCommand } from "./reviewed-subtype-host-ci-workflow.mjs";
import "./checked-record-host-ci-history-tests.mjs";
import { withoutStructuralSubtypeWorkflow } from "./structural-subtype-ci-workflow.mjs";

const assertCheckedRecordHostWorkflow = source => assertPreviousWorkflow(withoutStructuralSubtypeWorkflow(source, "consumer-matrix.yml"));

const path = ".github/workflows/consumer-matrix.yml";

test("checked-record native CI preserves all previous commands and adds eight explicit lanes", async () => {
	const current = await readFile(path, "utf8");
	const record = JSON.parse(await readFile(checkedRecordHostCiHistoryPath));
	const update = record.updates.find(item => item.path === path);
	const milestone = beforeCheckedRecordHostCiSource(path, current, update.currentSha256);
	assert.equal(sha256(milestone), update.currentSha256);
	const previous = beforeCheckedRecordHostCiSource(path, milestone);
	assertCheckedRecordHostWorkflow(current);
	assert.notEqual(milestone, previous);
	assert.equal(sha256(disableCheckedRecordHostWorkflow(milestone)), sha256(previous));
	assert.equal(sha256(enableCheckedRecordHostWorkflow(previous)), sha256(milestone));
	assert.throws(() => enableCheckedRecordHostWorkflow(current));
	assert.throws(() => disableCheckedRecordHostWorkflow(previous));
	assert.deepEqual(checkedRecordHostCiGroups.flatMap(item => item.lanes), ["php-native", "python311", "python312", "rust", "dotnet", "jvm", "ruby", "wit-wasi"]);
	assert.deepEqual(checkedRecordHostCiGroups.map(item => item.profiles), ["php-native", "python", "rust", "dotnet", "java,kotlin", "ruby", "wit-wasi"]);
	assert.throws(() => checkedRecordHostCiCommand("perl"));
	assert.throws(() => checkedRecordHostCiCommand("python399"));
	const runner = await readFile("scripts/run-checked-record-host-ci.sh", "utf8");
	assert.ok(runner.includes("set -euo pipefail\n"));
	assert.ok(runner.includes("for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do\n"));
	assert.ok(runner.includes('2>&1 | tee "$output/run.tap"'));
	assert.ok(runner.includes('node scripts/check-checked-record-host-reports.mjs --profiles "$profiles" --route "$route"'));
	assert.ok(runner.includes('--directory "$output/records/$route" --tap "$output/run.tap" --glibc 2.38'));
	assert.ok(runner.includes('if [[ -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ]]; then'));
	assert.ok((await readFile("tests/helpers/checked-record-host-ci-report-tests.mjs", "utf8")).includes('import "./checked-record-host-ci-workflow-tests.mjs";'));
	assert.ok((await readFile("tests/checked-records.test.mjs", "utf8")).includes('import "./helpers/checked-record-host-ci-report-tests.mjs";'));
});

test("checked-record native CI rejects missing or misplaced gates and lost failure records", async () => {
	const current = await readFile(path, "utf8");
	for(const item of checkedRecordHostCiGroups)
	{
		const block = checkedRecordHostCiBlock(item), lane = item.lanes[0];
		const invocation = checkedRecordHostCiCommand(lane), upload = checkedRecordHostCiUpload(lane);
		const mutations = [current.replace(block, "")
			, current.replace(block, "          set +e\n" + block)
			, current.replace(block, block.replace("\n", " || true\n"))
			, current.replace(block, "      - name: misplaced\n        run: |\n" + block)
			, current.replace(block, "          export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36\n" + block)
			, current.replace(invocation, invocation.replace("bash ", "true "))
			, current.replace(upload, "")
			, current.replace(upload, upload.replace("/\n", "/ordinary-source/records/report.json\n"))
			, current.replace(`  ${item.job}:\n`, "  wrong-job:\n")
			, current.replace(`        id: ${item.step}\n`, "        id: unobserved\n")
			, current.replaceAll(`steps.${item.step}.outcome != 'success'`, "false")
			, current.replace(" && " + item.lanes.map(checkedRecordHostCiCommand).join(" && "), "")
			, current.replace(reviewedSubtypeHostCiBlock(item), "")
			, current.replace(`      - name: ${item.enforce}\n`, "      - name: missing enforcement\n")
			, current.replace(`      - name: ${item.enforce}\n`, `      - name: ${item.enforce}\n        continue-on-error: true\n`)
			, current.replace(reviewedSubtypeHostCiCommand(lane) + "\n", reviewedSubtypeHostCiCommand(lane) + " || true\n")];
		for(const changed of mutations)
		{
			assert.notEqual(changed, current);
			assert.throws(() => assertCheckedRecordHostWorkflow(changed), item.profiles);
		}
	}
	for(const changed of [current.replaceAll("if: always()", "if: success()")
		, current.replaceAll("if-no-files-found: error", "if-no-files-found: ignore")
		, current.replaceAll("run: exit 1", "run: exit 0")])
		assert.throws(() => assertCheckedRecordHostWorkflow(changed));
	for(const lane of ["python311", "python312"])
	{
		const command = checkedRecordHostCiCommand(lane);
		for(const changed of [current.replace(command, command.replace(/collection_python\d+/u, "collection_python399"))
			, current.replace(command, command.replace(/LEAN_BRIDGE_PYTHON='[^']+' /u, ""))
			, current.replace(`          ${command}\n`, "")])
			assert.throws(() => assertCheckedRecordHostWorkflow(changed));
	}
});
