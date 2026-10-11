/**
 * Add the late-input gates without changing the existing measured Fin acceptance steps.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertFinContainerEdgeWorkflow, finContainerEdgeCiSelections } from "./fin-container-edge-ci.mjs";

const unique = (text, value) => {
	const index = text.indexOf(value);
	assert.ok(index >= 0 && text.indexOf(value, index + 1) < 0, `expected one ${value}`);
	return index;
};
const swap = (text, from, to) => { unique(text, from); return text.replace(from, () => to); };
const oldRun = item => `LEAN_BRIDGE_FIN_PRODUCT_PROFILES=${item.profiles} LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_PROFILES=${item.profiles} node --test tests/native-fin-products.test.mjs`;
const lane = item => item.label === "c-cpp" ? "c-family" : item.label === "java-kotlin" ? "jvm" : item.label;
const invoke = item => item.profiles === "wit-wasi" ? "bash scripts/run-fin-late-wit-ci.sh"
	: `${item.python ? `LEAN_BRIDGE_PYTHON='\${{ steps.collection_python${item.python.replace(".", "")}.outputs.python-path }}' ` : ""}bash scripts/run-fin-late-native-ci.sh ${lane(item)}`;
const output = item => item.profiles === "wit-wasi" ? "build/fin-late-wit-ci" : `build/fin-late-native-ci/${lane(item)}`;
const groups = [...new Map(finContainerEdgeCiSelections.map(item => [item.profiles, finContainerEdgeCiSelections.filter(other => other.profiles === item.profiles)])).values()];

/**
 * Insert execution, recorded commands and unconditional retained-original uploads.
 *
 * @param workflow - Existing native workflow.
 */
export const enableFinLateWorkflow = workflow => {
	assert.ok(!workflow.includes("scripts/run-fin-late-"));
	for(const items of groups)
	{
		const previous = oldRun(items[0]);
		workflow = swap(workflow, `          ${previous}\n`, `          ${previous}\n${items.map(item => `          ${invoke(item)}\n`).join("")}`);
		workflow = swap(workflow, `&& ${previous}`, `&& ${previous}${items.map(item => ` && ${invoke(item)}`).join("")}`);
		const anchor = `            build/native-fin-container-edges/edges-${items[0].label}.json\n`;
		workflow = swap(workflow, anchor, anchor + items.map(item => `            ${output(item)}\n`).join(""));
	}
	return workflow;
};

/**
 * Restore the complete exact pre-supplement workflow.
 *
 * @param workflow - Supplemented workflow.
 */
export const disableFinLateWorkflow = workflow => {
	for(const items of groups)
	{
		const previous = oldRun(items[0]);
		workflow = swap(workflow, `          ${previous}\n${items.map(item => `          ${invoke(item)}\n`).join("")}`, `          ${previous}\n`);
		workflow = swap(workflow, `&& ${previous}${items.map(item => ` && ${invoke(item)}`).join("")}`, `&& ${previous}`);
	}
	for(const item of finContainerEdgeCiSelections) workflow = swap(workflow, `            ${output(item)}\n`, "");
	return workflow;
};

/**
 * Require every supplemented lane in its enforced producer and always-upload step.
 *
 * @param workflow - Actual proposed workflow bytes.
 */
export const assertFinLateWorkflow = workflow => {
	assertFinContainerEdgeWorkflow(workflow);
	const previous = disableFinLateWorkflow(workflow);
	assertFinContainerEdgeWorkflow(previous); assert.equal(enableFinLateWorkflow(previous), workflow);
	assert.equal(workflow.split("scripts/run-fin-late-native-ci.sh").length - 1, 16);
	assert.equal(workflow.split("scripts/run-fin-late-wit-ci.sh").length - 1, 2);
	for(const item of finContainerEdgeCiSelections)
	{
		const position = unique(workflow, `          ${invoke(item)}\n`);
		const job = [...workflow.slice(0, position).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];
		assert.equal(job, item.job);
		const step = workflow.slice(workflow.lastIndexOf("\n      - name: ", position), workflow.indexOf("\n      - name: ", position));
		assert.ok(step.includes(`\n        id: ${item.step}\n`));
		assert.doesNotMatch(step, /set \+e|\|\| true/u);
		const upload = unique(workflow, `            ${output(item)}\n`);
		assert.equal([...workflow.slice(0, upload).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1], item.job);
		const uploadStep = workflow.slice(workflow.lastIndexOf("\n      - name: ", upload), workflow.indexOf("\n      - name: ", upload));
		assert.match(uploadStep, /\n {8}if: always\(\)/u);
		assert.match(uploadStep, /\n {8}uses: actions\/upload-artifact@v7\n/u);
		assert.match(uploadStep, /\n {10}if-no-files-found: error\n/u);
	}
};
