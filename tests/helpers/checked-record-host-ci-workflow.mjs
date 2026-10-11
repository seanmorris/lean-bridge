/**
 * Require installed checked records in the existing enforced native consumer jobs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { reviewedSubtypeHostCiBlock, reviewedSubtypeHostCiCommand, reviewedSubtypeHostCiUpload } from "./reviewed-subtype-host-ci-workflow.mjs";

const runner = "bash scripts/run-checked-record-host-ci.sh";
export const checkedRecordHostCiGroups = [
	{ job: "php-consumers", step: "type_corpus_php_native", profiles: "php-native", lanes: ["php-native"], enforce: "Enforce PHP support" }
	, { job: "native-consumers", step: "type_corpus_python", profiles: "python", lanes: ["python311", "python312"], enforce: "Enforce native consumer support" }
	, { job: "native-consumers", step: "type_corpus_rust", profiles: "rust", lanes: ["rust"], enforce: "Enforce native consumer support" }
	, { job: "managed-consumers", step: "type_corpus_dotnet", profiles: "dotnet", lanes: ["dotnet"], enforce: "Enforce managed consumer support" }
	, { job: "managed-consumers", step: "type_corpus_jvm", profiles: "java,kotlin", lanes: ["jvm"], enforce: "Enforce managed consumer support" }
	, { job: "managed-consumers", step: "type_corpus_ruby", profiles: "ruby", lanes: ["ruby"], enforce: "Enforce managed consumer support" }
	, { job: "wasi-consumer", step: "ordinary_wit", profiles: "wit-wasi", lanes: ["wit-wasi"], enforce: "Enforce WIT and WASI support" }
];
const once = (source, from, to) => {
	assert.equal(source.split(from).length, 2, `Expected exactly one ${from}`);
	return source.replace(from, () => to);
};
const stepAt = (source, index) => {
	const start = source.lastIndexOf("\n      - name: ", index), next = source.indexOf("\n      - name: ", index);
	assert.ok(start >= 0);
	return source.slice(start, next < 0 ? source.length : next);
};

/**
 * Select each pinned Python interpreter explicitly instead of using ambient PATH.
 *
 * @param lane - One of the eight closed installed lanes.
 */
export const checkedRecordHostCiCommand = lane => {
	assert.ok(checkedRecordHostCiGroups.some(item => item.lanes.includes(lane)));
	return lane.startsWith("python")
		? `LEAN_BRIDGE_PYTHON='\${{ steps.collection_${lane}.outputs.python-path }}' ${runner} ${lane}`
		: `${runner} ${lane}`;
};
/**
 * Retain complete original TAP and build records, including partial failed routes.
 *
 * @param lane - Installed lane.
 */
export const checkedRecordHostCiUpload = lane => `            build/checked-record-ci/${lane}/\n`;
/**
 * Execute each lane's four routes sequentially after reviewed Subtype acceptance.
 *
 * @param item - Enforced native consumer group.
 */
export const checkedRecordHostCiBlock = item => item.lanes.map(lane => `          ${checkedRecordHostCiCommand(lane)}\n`).join("");

/**
 * Add lanes, full uploads and execution descriptions without replacing prior gates.
 *
 * @param source - Workflow at the previous milestone.
 */
export const enableCheckedRecordHostWorkflow = source => {
	assert.ok(!source.includes(runner));
	for(const item of checkedRecordHostCiGroups)
	{
		const anchor = reviewedSubtypeHostCiBlock(item);
		source = once(source, anchor, anchor + checkedRecordHostCiBlock(item));
		const upload = reviewedSubtypeHostCiUpload(item.lanes.at(-1));
		source = once(source, upload, upload + item.lanes.map(checkedRecordHostCiUpload).join(""));
		const description = " && " + item.lanes.map(reviewedSubtypeHostCiCommand).join(" && ");
		source = once(source, description, description + " && " + item.lanes.map(checkedRecordHostCiCommand).join(" && "));
	}
	return source;
};

/**
 * Remove only this milestone's additions for exact predecessor comparison.
 *
 * @param source - Workflow with the checked-record lanes.
 */
export const disableCheckedRecordHostWorkflow = source => {
	for(const item of checkedRecordHostCiGroups)
	{
		source = once(source, checkedRecordHostCiBlock(item), "");
		for(const lane of item.lanes) source = once(source, checkedRecordHostCiUpload(lane), "");
		source = once(source, " && " + item.lanes.map(checkedRecordHostCiCommand).join(" && "), "");
	}
	assert.ok(!source.includes(runner));
	return source;
};

/**
 * Require each gate and its failure enforcement in the same job, with unconditional uploads.
 *
 * @param source - Complete consumer-matrix workflow text.
 */
export const assertCheckedRecordHostWorkflow = source => {
	assert.equal(enableCheckedRecordHostWorkflow(disableCheckedRecordHostWorkflow(source)), source);
	for(const item of checkedRecordHostCiGroups)
	{
		const block = checkedRecordHostCiBlock(item), index = source.indexOf(block);
		assert.ok(source.includes(reviewedSubtypeHostCiBlock(item) + block));
		const jobName = [...source.slice(0, index).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];
		assert.equal(jobName, item.job);
		const step = stepAt(source, index);
		assert.ok(step.includes(`\n        id: ${item.step}\n`));
		assert.doesNotMatch(step, /set \+e|\|\| true|LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR/u);
		const job = source.split(`\n  ${item.job}:\n`)[1].split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
		const enforcement = job.split(`      - name: ${item.enforce}\n`)[1]?.split("      - name: ")[0];
		assert.ok(enforcement?.includes(`steps.${item.step}.outcome != 'success'`));
		assert.match(enforcement, /\n {8}run: exit 1(?:\n|$)/u);
		assert.doesNotMatch(enforcement, /continue-on-error:|set \+e|\|\| true/u);
		for(const lane of item.lanes)
		{
			assert.equal(source.split(checkedRecordHostCiCommand(lane)).length - 1, 2);
			const upload = stepAt(source, source.indexOf(checkedRecordHostCiUpload(lane)));
			assert.match(upload, /\n {8}if: always\(\)/u);
			assert.match(upload, /\n {8}uses: actions\/upload-artifact@v7\n/u);
			assert.match(upload, /\n {10}if-no-files-found: error\n/u);
		}
	}
};
