/**
 * Require measured canonical container-edge packages on every native host and both Python floors.
 * Existing producer steps, failure enforcement and budgets remain in place.
 *
 * @file
 */
import assert from "node:assert/strict";
import { finContainerEdgeProfiles } from "./fin-container-edges.mjs";

export const finContainerEdgeCiFlag = "LEAN_BRIDGE_FIN_CONTAINER_EDGE_DISPATCH=1";
export const finContainerEdgeCiSelections = Object.freeze([
	{ job: "php-consumers", profiles: "php-native", step: "type_corpus_php_native", gdb: true }
	, { job: "native-consumers", profiles: "c,cpp", step: "type_corpus_c_family" }
	, { job: "native-consumers", profiles: "python", step: "type_corpus_python", python: "3.11" }
	, { job: "native-consumers", profiles: "python", step: "type_corpus_python", python: "3.12" }
	, { job: "native-consumers", profiles: "rust", step: "type_corpus_rust" }
	, { job: "managed-consumers", profiles: "dotnet", step: "type_corpus_dotnet", gdb: true }
	, { job: "managed-consumers", profiles: "java,kotlin", step: "type_corpus_jvm", gdb: true }
	, { job: "managed-consumers", profiles: "ruby", step: "type_corpus_ruby", gdb: true }
	, { job: "wasi-consumer", profiles: "wit-wasi", step: "ordinary_wit" }
].map(item => Object.freeze({ ...item
	, label: item.python ? `python${item.python.replace(".", "")}` : item.profiles.replace(",", "-")
	, timeout: item.job === "native-consumers" ? "${{ matrix.profile == 'c-family' && 360 || 240 }}" : "240" })));
const pattern = "^installed source-free native packages execute zero-bound and nested-position Fin edge cases$";
const report = item => `build/native-fin-container-edges/edges-${item.label}.json`;
const oldRun = item => `LEAN_BRIDGE_FIN_PRODUCT_PROFILES=${item.profiles} LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_PROFILES=${item.profiles} node --test tests/native-fin-products.test.mjs`;
const phpApt = "          sudo apt-get install -y build-essential autoconf automake bison flex gperf libtool re2c cmake pkg-config php-cli php-dev php-common php-zip php-mbstring composer zstd ripgrep";
const once = (text, part) => {
	const index = text.indexOf(part);
	assert.ok(index >= 0 && text.indexOf(part, index + 1) < 0, `expected exactly one ${part}`);
	return index;
};
const swap = (text, from, to) => {
	once(text, from); return text.replace(from, () => to);
};
const count = (text, part) => text.split(part).length - 1;
const jobAt = (text, index) => [...text.slice(0, index).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];
const phpTools = (workflow, enabled) => {
	const start = workflow.indexOf("\n  php-consumers:\n"); assert.ok(start >= 0);
	const after = workflow.slice(start + 1).search(/\n {2}[a-z][a-z0-9-]*:\n/u);
	const end = after < 0 ? workflow.length : start + 1 + after;
	const before = phpApt + (enabled ? "\n" : " gdb\n"), next = phpApt + (enabled ? " gdb\n" : "\n");
	return workflow.slice(0, start) + swap(workflow.slice(start, end), before, next) + workflow.slice(end);
};

/**
 * The exact producer command, with no permissive fallback or unmeasured host.
 *
 * @param item - Explicit CI host selection.
 */
export const finContainerEdgeCiInvocation = item => {
	const python = item.python ? `LEAN_BRIDGE_PYTHON='\${{ steps.collection_python${item.python.replace(".", "")}.outputs.python-path }}' ` : "";
	return `${python}${item.gdb ? "LEAN_BRIDGE_GDB=/usr/bin/gdb " : ""}LEAN_BRIDGE_FIN_CONTAINER_EDGE_PROFILES=${item.profiles} ${finContainerEdgeCiFlag} LEAN_BRIDGE_FIN_CONTAINER_EDGE_REPORT=${report(item)} node --test --test-concurrency=1 --test-name-pattern='${pattern}' tests/fin-container-edges.test.mjs`;
};
/**
 * The report checker checks the same exact selection, including a required Python floor.
 *
 * @param item - Explicit CI host selection.
 */
export const finContainerEdgeCiCheck = item => `node scripts/check-fin-container-edge-report.mjs ${item.profiles} ${report(item)}${item.python ? ` --python ${item.python}` : ""}`;
/**
 * The producer, nonempty report and measured acceptance gate in one enforced step.
 *
 * @param item - Explicit CI host selection.
 */
export const finContainerEdgeCiBlock = item => `          ${finContainerEdgeCiInvocation(item)}\n          test -s ${report(item)}\n          ${finContainerEdgeCiCheck(item)}\n`;

/**
 * Insert the measured gates, recorded commands and uploaded original reports, preserving other bytes.
 *
 * @param workflow - Original consumer workflow.
 */
export const enableFinContainerEdgeWorkflow = workflow => {
	assert.equal(count(workflow, finContainerEdgeCiFlag), 0);
	workflow = phpTools(workflow, true);
	for(const item of finContainerEdgeCiSelections)
	{
		const run = oldRun(item);
		workflow = swap(workflow, `          ${run}\n`, finContainerEdgeCiBlock(item) + `          ${run}\n`);
		workflow = swap(workflow, `&& ${run}`, `&& ${finContainerEdgeCiInvocation(item)} && ${finContainerEdgeCiCheck(item)} && ${run}`);
		const anchor = `            build/native-fin-containers/reviewed-${item.profiles.replace(",", "-")}.json\n`;
		workflow = swap(workflow, anchor, anchor + `            ${report(item)}\n`);
	}
	return workflow;
};

/**
 * Exact inverse for review and source-history authentication.
 *
 * @param workflow - Consumer workflow with the measured edge gates.
 */
export const disableFinContainerEdgeWorkflow = workflow => {
	for(const item of [...finContainerEdgeCiSelections].reverse())
	{
		workflow = swap(workflow, finContainerEdgeCiBlock(item), "");
		workflow = swap(workflow, `&& ${finContainerEdgeCiInvocation(item)} && ${finContainerEdgeCiCheck(item)} && ${oldRun(item)}`, `&& ${oldRun(item)}`);
		workflow = swap(workflow, `            ${report(item)}\n`, "");
	}
	workflow = phpTools(workflow, false);
	assert.equal(count(workflow, finContainerEdgeCiFlag), 0);
	return workflow;
};

/**
 * Reject missing hosts, observations, floor bindings, uploads, budgets or enforced producer outcomes.
 *
 * @param workflow - Consumer workflow with the measured edge gates.
 */
export const assertFinContainerEdgeWorkflow = workflow => {
	assert.deepEqual(finContainerEdgeCiSelections.flatMap(item => item.profiles.split(",")).sort(), [...finContainerEdgeProfiles, "python"].sort());
	assert.equal(count(workflow, finContainerEdgeCiFlag), 2 * finContainerEdgeCiSelections.length);
	assert.equal(count(workflow, "scripts/check-fin-container-edge-report.mjs"), 2 * finContainerEdgeCiSelections.length);
	for(const item of finContainerEdgeCiSelections)
	{
		const index = once(workflow, finContainerEdgeCiBlock(item));
		assert.equal(jobAt(workflow, index), item.job);
		const start = workflow.indexOf(`\n  ${item.job}:\n`), after = workflow.slice(start + 1).search(/\n {2}[a-z][a-z0-9-]*:\n/u);
		const job = workflow.slice(start, after < 0 ? undefined : start + 1 + after);
		const header = job.slice(0, job.indexOf("\n    steps:\n") + 1);
		assert.ok(header.includes(`\n    timeout-minutes: ${item.timeout}\n`), `${item.label} budget`);
		const step = workflow.slice(workflow.lastIndexOf("\n      - name: ", index), workflow.indexOf("\n      - name: ", index));
		assert.ok(step.includes(`\n        id: ${item.step}\n`));
		assert.doesNotMatch(step, /set \+e|\|\| true/u);
		const recorded = once(workflow, `&& ${finContainerEdgeCiInvocation(item)} && ${finContainerEdgeCiCheck(item)} && `);
		assert.equal(jobAt(workflow, recorded), item.job);
		const upload = once(workflow, `            ${report(item)}\n`);
		assert.equal(jobAt(workflow, upload), item.job);
		const uploadStep = workflow.slice(workflow.lastIndexOf("\n      - name: ", upload), workflow.indexOf("\n      - name: ", upload));
		assert.match(uploadStep, /\n {8}if: always\(\)/u);
		assert.match(uploadStep, /\n {8}uses: actions\/upload-artifact@v7\n/u);
		assert.match(uploadStep, /\n {10}if-no-files-found: error\n/u);
		const enforced = [...job.matchAll(/\n {6}- name: Enforce [^\n]*\n {8}if: ([^\n]*)\n {8}run: exit 1\n/gu)]
			.filter(([, condition]) => condition.includes(`steps.${item.step}.outcome != 'success'`));
		assert.equal(enforced.length, 1, `${item.label} failure must fail its job`);
		if(item.gdb) assert.match(workflow.slice(start, index), /sudo apt-get install -y [^\n]*\bgdb\n/u);
		if(item.python) assert.ok(job.includes(`id: collection_python${item.python.replace(".", "")}\n`));
	}
	assert.ok(workflow.includes(phpApt + " gdb\n"));
};
