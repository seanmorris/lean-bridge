/**
 * Native edge CI wiring and explicit refusal controls, independent of installed execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertFinContainerEdgeWorkflow, disableFinContainerEdgeWorkflow, enableFinContainerEdgeWorkflow, finContainerEdgeCiBlock, finContainerEdgeCiCheck, finContainerEdgeCiFlag, finContainerEdgeCiInvocation, finContainerEdgeCiSelections } from "./fin-container-edge-ci.mjs";
import { assertFinContainerEntryWorkflow } from "./fin-container-entry-ci.mjs";

test("edge gates run every native public host and both Python floors without changing prior gates", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assertFinContainerEdgeWorkflow(workflow);
	assertFinContainerEntryWorkflow(workflow);
	const previous = disableFinContainerEdgeWorkflow(workflow);
	assert.equal(enableFinContainerEdgeWorkflow(previous), workflow);
	assertFinContainerEntryWorkflow(previous);
	assert.throws(() => assertFinContainerEdgeWorkflow(previous));
	assert.deepEqual(finContainerEdgeCiSelections.map(item => item.label), ["php-native", "c-cpp", "python311", "python312", "rust", "dotnet", "java-kotlin", "ruby", "wit-wasi"]);
});

test("edge workflow rejects missing dispatch, relabelled floors, unrecorded commands and unenforced outcomes", async t => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	let rejected = 0;
	for(const item of finContainerEdgeCiSelections)
	{
		const invocation = finContainerEdgeCiInvocation(item), check = finContainerEdgeCiCheck(item);
		const changes = [
			text => text.replace(`          ${invocation}\n`, `          ${invocation.replace(finContainerEdgeCiFlag, "")}\n`)
			, text => text.replace(`          ${check}\n`, "")
			, text => text.replace(`&& ${invocation} && ${check}`, "&& true")
			, text => text.replace(finContainerEdgeCiBlock(item), `          set +e\n${finContainerEdgeCiBlock(item)}`)
			, text => text.replace(`            build/native-fin-container-edges/edges-${item.label}.json\n`, "")
			, text => text.replaceAll(`steps.${item.step}.outcome != 'success'`, `steps.${item.step}.outcome == 'skipped'`)
			, text => text.replace(`        id: ${item.step}\n`, `        id: ${item.step}_unobserved\n`)
		];
		if(item.python) changes.push(text => text.replace(`          ${check}\n`, `          ${check.replace(` --python ${item.python}`, "")}\n`));
		for(const [index, change] of changes.entries())
		{
			const changed = change(workflow); assert.notEqual(changed, workflow);
			assert.throws(() => assertFinContainerEdgeWorkflow(changed), assert.AssertionError, `${item.label} mutation ${index}`);
			rejected++;
		}
	}
	assert.throws(() => assertFinContainerEdgeWorkflow(workflow.replace("composer zstd ripgrep gdb\n", "composer zstd ripgrep\n")));
	t.diagnostic(`${rejected} missing or weakened CI claims rejected`);
});
