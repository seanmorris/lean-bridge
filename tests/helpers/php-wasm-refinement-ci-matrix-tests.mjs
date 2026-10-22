/**
 * Keep the entire admitted PHP-Wasm refinement CI surface closed and fatal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
	assertPhpWasmRefinementCiWorkflow
	, phpWasmRefinementCiBudget
	, phpWasmRefinementCiMatrix
} from "./php-wasm-refinement-ci-matrix.mjs";

test("the PHP-Wasm refinement CI matrix names every dedicated admitted lane", async () => {
	const expected = phpWasmRefinementCiMatrix.map(lane => lane.path).toSorted();
	const actual = (await readdir(".github/workflows"))
		.filter(path => path.includes("php-wasm") && path.endsWith(".yml"))
		.map(path => `.github/workflows/${path}`).toSorted();
	assert.deepEqual(actual, expected);
	assert.equal(new Set(phpWasmRefinementCiMatrix.map(lane => lane.id)).size
		, phpWasmRefinementCiMatrix.length);
	assert.deepEqual(phpWasmRefinementCiBudget(), {
		workflows: 18, acceptanceWorkflows: 14, measurementWorkflows: 4
		, measurementCells: 26, maximumConcurrentJobs: 22
	});
	const owners = [...new Set(phpWasmRefinementCiMatrix
		.flatMap(lane => lane.ownerNodes))].toSorted((left, right) => left - right);
	assert.deepEqual(owners, [
		1457, 1458, 1459, 1460, 1461, 1471, 1472, 1473, 1476, 1477
		, 1478, 1479, 1480, 1481, 1482, 1483, 1484
		, 1824, 1825, 1826, 1827
	]);
});

test("every PHP-Wasm refinement workflow retains its bounded fatal policy", async () => {
	for(const lane of phpWasmRefinementCiMatrix)
	{
		const source = await readFile(lane.path, "utf8");
		assert.deepEqual(assertPhpWasmRefinementCiWorkflow(lane, source), {
			id: lane.id, kind: lane.kind, cells: lane.cells
			, maxParallel: lane.maxParallel
			, timeoutMinutes: lane.timeoutMinutes
		});
	}
});

test("the PHP-Wasm refinement CI audit rejects policy suppression", async t => {
	let controls = 0;
	for(const lane of phpWasmRefinementCiMatrix)
	{
		const source = await readFile(lane.path, "utf8");
		const mutations = [
			source.replace("  pull_request:\n", "")
			, source.replace("  workflow_dispatch:\n", "")
			, source.replace("  workflow_dispatch:\n"
				, "  workflow_dispatch:\n  merge_group:\n")
			, source.replace("  contents: read\n", "  contents: write\n")
			, source.replace("  cancel-in-progress: true\n"
				, "  cancel-in-progress: false\n")
			, source.replace("    runs-on: ubuntu-24.04\n"
				, "    runs-on: ubuntu-latest\n")
			, source.replace(`    timeout-minutes: ${lane.timeoutMinutes}\n`
				, `    timeout-minutes: ${lane.timeoutMinutes + 1}\n`)
			, source.replace("      EMCC_CORES: \"2\"\n", "      EMCC_CORES: \"4\"\n")
			, source.replace("          fetch-depth: 0\n", "          fetch-depth: 1\n")
			, source.replace("          persist-credentials: false\n"
				, "          persist-credentials: true\n")
			, source.replace("        uses: actions/setup-node@v6\n"
				, "        uses: actions/setup-node@v5\n")
			, source.replace("          node-version: \"22\"\n"
				, "          node-version: \"20\"\n")
			, source.replace("        id: acceptance\n", "        id: optional\n")
			, source.replace("        uses: actions/upload-artifact@v7\n"
				, "        uses: actions/upload-artifact@v6\n")
			, source.replace("          if-no-files-found: error\n"
				, "          if-no-files-found: ignore\n")
			, source.replace("          retention-days: 30\n"
				, "          retention-days: 1\n")
			, source.replace("        if: always()\n", "        if: success()\n")
			, source.replace("steps.acceptance.outcome != 'success'"
				, "steps.acceptance.outcome == 'failure'")
			, source.replace("        run: exit 1\n", "        run: exit 0\n")
			, source.replace("    steps:\n"
				, "    continue-on-error: true\n    steps:\n")
			, source.replace("    steps:\n"
				, "    continue-on-error: ${{ true }}\n    steps:\n")
			, source.replace(`  ${lane.job}:\n`
				, `  ${lane.job}:\n    if: github.event_name != 'pull_request'\n`)
			, source.replace(`          ${lane.acceptanceCommand}\n`
				, "          true\n")
			, source.replace(`          name: ${lane.artifactName}\n`
				, "          name: forged-${{ github.sha }}\n")
			, source.replace(`            ${lane.artifactPaths[0]}\n`, "")
		];
		if(lane.kind === "measurement")
		{
			mutations.push(source.replace("      fail-fast: false\n"
				, "      fail-fast: true\n"));
			mutations.push(source.replace(`      max-parallel: ${lane.maxParallel}\n`
				, `      max-parallel: ${lane.maxParallel + 1}\n`));
			mutations.push(source.replace("      matrix:\n"
				, "      matrix:\n        exclude:\n          - family: nominal-full\n"));
			const first = Object.values(lane.axes)[0][0];
			mutations.push(source.replace(`          - ${first}\n`, ""));
		}
		for(const [index, changed] of mutations.entries())
		{
			assert.notEqual(changed, source, `${lane.id} mutation ${index}`);
			assert.throws(() => assertPhpWasmRefinementCiWorkflow(lane, changed)
				, undefined, `${lane.id} mutation ${index}`);
			controls++;
		}
	}
	assert.equal(controls, 466);
	t.diagnostic(`${controls} workflow suppression controls`);
});
