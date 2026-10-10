/**
 * Add the zero-bound nominal collection supplement to existing native consumer CI jobs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { finContainerEdgeCiSelections } from "./fin-container-edge-ci.mjs";

export const finRecordZeroCiSelections = Object.freeze([
	...finContainerEdgeCiSelections.map(item => ({ ...item, workflow: "consumer-matrix.yml" }))
	, { job: "perl", profiles: "perl", label: "perl", workflow: "perl-consumer.yml" }
]);
const flag = "LEAN_BRIDGE_FIN_RECORD_ZERO_PROFILES=";
const paths = item => ["", "reviewed-"].map(prefix => `build/native-fin-record-zero/${prefix}${item.label}.json`);
const oldLabel = item => item.python === "3.11" ? "python" : item.label;
const swap = (text, from, to) => {
	const index = text.indexOf(from);
	assert.ok(index >= 0 && text.indexOf(from, index + 1) < 0, `expected exactly one ${from}`);
	return text.replace(from, () => to);
};

/**
 * Name the installed producer with explicit Python and report selections.
 *
 * @param item - Explicit host/runtime selection.
 */
export const finRecordZeroCiInvocation = item => {
	const python = item.python ? `LEAN_BRIDGE_PYTHON='\${{ steps.collection_python${item.python.replace(".", "")}.outputs.python-path }}' ` : "";
	const [ordinary, reviewed] = paths(item);
	return `${python}${flag}${item.profiles} LEAN_BRIDGE_REVIEWED_FIN_RECORD_ZERO_PROFILES=${item.profiles} LEAN_BRIDGE_FIN_RECORD_ZERO_REPORT=${ordinary} LEAN_BRIDGE_REVIEWED_FIN_RECORD_ZERO_REPORT=${reviewed} node --test --test-concurrency=1 tests/native-fin-record-zero.test.mjs`;
};
/**
 * Require both original report files through the independent checker.
 *
 * @param item - Explicit host/runtime selection.
 */
export const finRecordZeroCiCheck = item => `node scripts/check-fin-record-zero-report.mjs ${item.profiles} ${paths(item).join(" ")}`;
/**
 * Keep the producer and its mandatory report checks in one enforced block.
 *
 * @param item - Explicit host/runtime selection.
 */
export const finRecordZeroCiBlock = item => `          ${finRecordZeroCiInvocation(item)}\n${paths(item).map(path => `          test -s ${path}\n`).join("")}          ${finRecordZeroCiCheck(item)}\n`;

/**
 * Preserve existing steps and append enforced producers, report checks and uploaded originals.
 *
 * @param workflow - One original consumer workflow.
 * @param name - Workflow filename.
 */
export const enableFinRecordZeroWorkflow = (workflow, name) => {
	assert.ok(["consumer-matrix.yml", "perl-consumer.yml"].includes(name));
	assert.ok(!workflow.includes(flag));
	const selected = finRecordZeroCiSelections.filter(item => item.workflow === name);
	for(const item of selected)
	{
		const anchor = `          test -s build/native-fin-records/reviewed-${oldLabel(item)}.json\n`;
		workflow = swap(workflow, anchor, anchor + finRecordZeroCiBlock(item));
		const upload = `            build/native-fin-records/reviewed-${oldLabel(item)}.json\n`;
		workflow = swap(workflow, upload, upload + paths(item).map(path => `            ${path}\n`).join(""));
		if(name === "perl-consumer.yml") continue;
		let matches = 0;
		workflow = workflow.split("\n").map(line => {
			if(!/(?:consumer_command=|--command ")/u.test(line) || !line.includes(`LEAN_BRIDGE_FIN_RECORD_PROFILES=${item.profiles} `)) return line;
			if(item.python && (line.includes("collection_python312") !== (item.python === "3.12"))) return line;
			matches++;
			return swap(line, "tests/native-fin-records.test.mjs", `tests/native-fin-records.test.mjs && ${finRecordZeroCiInvocation(item)} && ${finRecordZeroCiCheck(item)}`);
		}).join("\n");
		assert.equal(matches, 1, item.label);
	}
	return workflow;
};

/**
 * Remove only the exact registered additions, for source-history comparison.
 *
 * @param workflow - Workflow with the supplement enabled.
 * @param name - Explicit workflow filename.
 */
export const disableFinRecordZeroWorkflow = (workflow, name) => {
	for(const item of finRecordZeroCiSelections.filter(item => item.workflow === name))
	{
		workflow = swap(workflow, finRecordZeroCiBlock(item), "");
		for(const path of paths(item)) workflow = swap(workflow, `            ${path}\n`, "");
		if(name !== "perl-consumer.yml") workflow = swap(workflow, ` && ${finRecordZeroCiInvocation(item)} && ${finRecordZeroCiCheck(item)}`, "");
	}
	assert.ok(!workflow.includes(flag));
	return workflow;
};

/**
 * Ensure every selected execution is in its enforced original job and uploads both reports.
 *
 * @param workflow - Workflow with the supplement enabled.
 * @param name - Explicit workflow filename.
 */
export const assertFinRecordZeroWorkflow = (workflow, name) => {
	const selected = finRecordZeroCiSelections.filter(item => item.workflow === name);
	assert.ok(selected.length > 0);
	assert.equal(workflow.split(flag).length - 1, selected.length * (name === "perl-consumer.yml" ? 1 : 2));
	assert.equal(enableFinRecordZeroWorkflow(disableFinRecordZeroWorkflow(workflow, name), name), workflow);
	for(const item of selected)
	{
		const index = workflow.indexOf(finRecordZeroCiBlock(item));
		const job = [...workflow.slice(0, index).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];
		assert.equal(job, item.job);
		const step = workflow.slice(workflow.lastIndexOf("\n      - name: ", index), workflow.indexOf("\n      - name: ", index));
		assert.doesNotMatch(step, /set \+e|\|\| true/u);
		if(item.step)
		{
			assert.ok(step.includes(`\n        id: ${item.step}\n`));
			assert.ok(workflow.includes(`steps.${item.step}.outcome != 'success'`));
		}
		else assert.ok(!step.includes("continue-on-error:"));
		for(const path of paths(item))
		{
			const at = workflow.indexOf(`            ${path}\n`);
			const upload = workflow.slice(workflow.lastIndexOf("\n      - name: ", at), workflow.indexOf("\n      - name: ", at));
			assert.match(upload, /\n {8}if: always\(\)/u);
			assert.match(upload, /\n {8}uses: actions\/upload-artifact@v7\n/u);
			assert.match(upload, /\n {10}if-no-files-found: error\n/u);
		}
	}
};
