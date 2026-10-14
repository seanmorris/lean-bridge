/**
 * Partition the timed-out PHP-Wasm job without dropping commands or observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCorpusPartitionPredecessor = "844ae6889866aad54f5a30e9f7b632101af4ac56";
export const phpWasmCorpusPartitionSha256 = "68a04ca7205ecd75f60a64beace9316cf721e89ef8f7e06c2db37566ae1291e0";
export const phpWasmCorpusPartitionSummaryGate = `      - name: Enforce PHP-Wasm corpus and combined observations
        if: always() && (needs.php-wasm-corpus.result != 'success' || needs.php-wasm-observations.result != 'success')
        run: exit 1
`;
const shell = "          source scripts/env.sh\n";
const prefix = "          set -euo pipefail\n";
const once = (source, from, to) => {
	assert.equal(source.split(from).length, 2, `Expected one workflow fragment: ${from}`);
	return source.replace(from, () => to);
};

/**
 * Read one complete top-level job without matching a summary dependency.
 *
 * @param source - Complete workflow.
 * @param name - Exact job identifier.
 */
export const phpWasmPartitionJob = (source, name) => {
	const marker = `  ${name}:\n`;
	assert.equal(source.split(marker).length, 2);
	return marker + source.split(marker)[1].split(/^ {2}[a-z][a-z0-9-]*:\n/mu)[0];
};

/**
 * Read a complete named step, including its final newline.
 *
 * @param job - Complete job text.
 * @param name - Exact step name.
 */
export const phpWasmPartitionStep = (job, name) => {
	const marker = `      - name: ${name}\n`;
	assert.equal(job.split(marker).length, 2);
	return marker + job.split(marker)[1].split("      - name: ")[0].trimEnd() + "\n";
};
const commands = step => {
	const match = /^ {8}run: \|\n((?: {10}.*\n|\n)*)/mu.exec(step);
	assert.ok(match); return match[1];
};
const paths = step => {
	const match = /^ {10}path: \|\n((?: {12}.*\n)+)/mu.exec(step);
	assert.ok(match); return match[1];
};

/**
 * Produce two independent corpus lanes and a fail-closed combined observation job.
 *
 * @param source - Exact reviewed predecessor workflow.
 */
export const partitionPhpWasmCorpusWorkflow = source => {
	assert.equal(sha256(source), phpWasmCorpusPartitionSha256, "Partition only the reviewed PHP-Wasm predecessor");
	const original = phpWasmPartitionJob(source, "php-wasm-consumers");
	const setup = original.slice(original.indexOf("      - name: Check out the exact revision\n"), original.indexOf("      - name: Build twice, install, and execute the PHP-Wasm transport\n"));
	const compare = phpWasmPartitionStep(original, "Compare installed PHP-Wasm packages with the shared Lean corpus");
	const body = commands(compare); assert.ok(body.startsWith(shell));
	const split = body.indexOf("          LEAN_BRIDGE_PHP_WASM_FIN_TEST=1 "); assert.ok(split > shell.length);
	const finalChecks = "          test -s build/type-corpus/php-wasm.json\n          test -s build/type-corpus/reviewed-wasm-php-wasm.json\n";
	assert.ok(body.endsWith(finalChecks));
	const values = body.slice(shell.length, split) + finalChecks;
	const refinements = body.slice(split, -finalChecks.length);
	const corpusUpload = phpWasmPartitionStep(original, "Upload PHP-Wasm corpus evidence");
	const sharedPath = "            build/recursive/php-wasm-shared-regressions.json\n";
	const oldPaths = paths(corpusUpload), sharedIndex = oldPaths.indexOf(sharedPath); assert.ok(sharedIndex >= 0);
	const retainedPaths = once(oldPaths, sharedPath, ""), pathSplit = retainedPaths.indexOf("            build/php-wasm-fin/ordinary.json\n");
	assert.ok(pathSplit > 0);
	const valuePaths = retainedPaths.slice(0, pathSplit), refinementPaths = retainedPaths.slice(pathSplit);
	const wasmUpload = phpWasmPartitionStep(original, "Upload owned wasm32 transport evidence");
	const record = phpWasmPartitionStep(original, "Record PHP observations"), upload = phpWasmPartitionStep(original, "Upload PHP observations");
	const enforce = phpWasmPartitionStep(original, "Enforce PHP support");
	let core = original;
	for(const step of [compare, corpusUpload, wasmUpload, record, upload, enforce]) core = once(core, step, "");
	core = once(core, "    # The shared PHP-Wasm corpus is the growing tail; 330 minutes leaves room below the hosted six-hour limit.\n    timeout-minutes: 330\n", "    # Transport and ownership ran in 115 minutes in run 38474413393; corpus lanes run independently.\n    timeout-minutes: 240\n");
	core = core.trimEnd() + `
      - name: Upload ordinary PHP-Wasm regression evidence
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: php-wasm-shared-regressions-\${{ github.sha }}
          path: |
${sharedPath}          if-no-files-found: error
          retention-days: 30
      - name: Upload PHP-Wasm performance for combined observations
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: php-wasm-performance-\${{ github.sha }}
          path: build/consumer-ci/performance/php-wasm.json
          if-no-files-found: error
          overwrite: true
          retention-days: 30
      - name: Enforce PHP support
        if: always() && (steps.consumer.outcome != 'success' || steps.copied_zend.outcome != 'success' || steps.ordinary_php_wasm.outcome != 'success' || steps.owned_php_wasm.outcome != 'success')
        run: exit 1

`;
	const valueUpload = once(once(once(corpusUpload, "Upload PHP-Wasm corpus evidence", "Upload PHP-Wasm value corpus evidence"), oldPaths, valuePaths), "type-corpus-php-wasm-${{ github.sha }}", "type-corpus-php-wasm-values-${{ github.sha }}")
		.replace("        if: always()\n", "        if: always() && matrix.profile == 'values'\n");
	const refinementUpload = once(once(once(corpusUpload, "Upload PHP-Wasm corpus evidence", "Upload PHP-Wasm refinement corpus evidence"), oldPaths, refinementPaths), "type-corpus-php-wasm-${{ github.sha }}", "type-corpus-php-wasm-refinements-${{ github.sha }}")
		.replace("        if: always()\n", "        if: always() && matrix.profile == 'refinements'\n");
	const corpus = `  php-wasm-corpus:
    name: PHP-Wasm corpus (\${{ matrix.profile }})
    runs-on: ubuntu-24.04
    # The former 330-minute job timed out while compiling its last suite, after all earlier suites passed.
    timeout-minutes: 240
    strategy:
      fail-fast: false
      matrix:
        profile: [values, refinements]
    steps:
${setup}      - name: Install Chromium for installed corpus checks
        timeout-minutes: 20
        run: npx playwright install --with-deps chromium
      - name: Build the pinned PHP-Wasm runtime and host
        timeout-minutes: 100
        env:
          LEAN_WASM_RUNTIME_PROFILE: browser
          LEAN_WASM_RUNTIME_VARIANT: php-wasm-3.1.68
          LEAN_WASM_ARTIFACT_TARGET: php-wasm-emscripten-3.1.68
        run: |
          set -euo pipefail
          mkdir -p build
          bash scripts/bootstrap-php-wasm-ci.sh 2>&1 | tee build/php-wasm-corpus-host.log
          bash scripts/bootstrap-toolchains.sh
          export LEAN_WASM_EMSDK="$GITHUB_WORKSPACE/.toolchains/emsdk-php-wasm"
          bash scripts/build-lean-runtime.sh 2>&1 | tee build/php-wasm-corpus-runtime.log
      - name: Compare installed PHP-Wasm value packages with the shared Lean corpus
        id: type_corpus_php_wasm
        if: matrix.profile == 'values'
        continue-on-error: true
        run: |
${prefix}${shell}${values}      - name: Compare installed PHP-Wasm refinements with the shared Lean corpus
        id: refinements_php_wasm
        if: matrix.profile == 'refinements'
        continue-on-error: true
        run: |
${prefix}${shell}${refinements}${valueUpload}${refinementUpload}${wasmUpload.replace("        if: always()\n", "        if: always() && matrix.profile == 'values'\n")}      - name: Preserve corpus bootstrap diagnostics
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: php-wasm-corpus-bootstrap-\${{ matrix.profile }}-\${{ github.sha }}
          path: |
            build/php-wasm-corpus-host.log
            build/php-wasm-corpus-runtime.log
          if-no-files-found: error
          retention-days: 30
      - name: Enforce PHP-Wasm corpus
        if: always() && ((matrix.profile == 'values' && steps.type_corpus_php_wasm.outcome != 'success') || (matrix.profile == 'refinements' && steps.refinements_php_wasm.outcome != 'success'))
        run: exit 1

`;
	const recordLine = commands(record).split("\n").find(line => line.includes("node scripts/consumer-ci.mjs record --consumer php-wasm"));
	assert.ok(recordLine);
	const observations = `  php-wasm-observations:
    name: Combine PHP-Wasm acceptance observations
    if: always()
    needs: [php-wasm-consumers, php-wasm-corpus]
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - name: Check out the support reporter
        uses: actions/checkout@v6
        with:
          persist-credentials: false
      - name: Install Node.js
        uses: actions/setup-node@v6
        with:
          node-version: \${{ env.NODE_VERSION }}
      - name: Download PHP-Wasm transport performance
        id: performance
        uses: actions/download-artifact@v5
        with:
          name: php-wasm-performance-\${{ github.sha }}
          path: build/consumer-ci/performance
      - name: Record PHP observations
        if: always()
        shell: bash
        run: |
          wasm_result=failed
          wasm_executed=false
          if [ "\${{ needs.php-wasm-consumers.result }}" = success ] && [ "\${{ needs.php-wasm-corpus.result }}" = success ] && [ "\${{ steps.performance.outcome }}" = success ]; then
            wasm_result=passed
            wasm_executed=true
          fi
${recordLine}
${upload}      - name: Enforce combined PHP-Wasm acceptance
        if: always() && (needs.php-wasm-consumers.result != 'success' || needs.php-wasm-corpus.result != 'success' || steps.performance.outcome != 'success')
        run: exit 1

`;
	let result = once(source, original, core + corpus + observations);
	const summary = phpWasmPartitionJob(result, "support-summary");
	let required = once(summary, "      - php-wasm-consumers\n", "      - php-wasm-consumers\n      - php-wasm-corpus\n      - php-wasm-observations\n");
	const summaryAnchor = "      - name: Enforce PHP-Wasm acceptance\n        if: needs.php-wasm-consumers.result != 'success'\n        run: exit 1\n";
	required = once(required, summaryAnchor, summaryAnchor + phpWasmCorpusPartitionSummaryGate);
	result = once(result, summary, required);
	return result;
};

/**
 * Check exact command and artifact conservation independently of the YAML transform.
 *
 * @param previous - Authenticated workflow before this partition.
 * @param current - Complete current workflow.
 */
export const assertPhpWasmCorpusPartition = (previous, current) => {
	assert.equal(current, partitionPhpWasmCorpusWorkflow(previous));
	const original = phpWasmPartitionJob(previous, "php-wasm-consumers");
	const corpus = phpWasmPartitionJob(current, "php-wasm-corpus"), core = phpWasmPartitionJob(current, "php-wasm-consumers");
	const oldCommands = commands(phpWasmPartitionStep(original, "Compare installed PHP-Wasm packages with the shared Lean corpus")).split("\n").filter(Boolean);
	const newCommands = ["value packages", "refinements"].flatMap(name => commands(phpWasmPartitionStep(corpus, `Compare installed PHP-Wasm ${name} with the shared Lean corpus`)).slice((prefix + shell).length).split("\n").filter(Boolean));
	assert.deepEqual(newCommands.sort(), oldCommands.filter(line => line !== shell.trimEnd()).sort());
	const originalPaths = paths(phpWasmPartitionStep(original, "Upload PHP-Wasm corpus evidence")).trim().split("\n").map(line => line.trim());
	const currentPaths = [paths(phpWasmPartitionStep(core, "Upload ordinary PHP-Wasm regression evidence")), ...["value", "refinement"].map(name => paths(phpWasmPartitionStep(corpus, `Upload PHP-Wasm ${name} corpus evidence`)))]
		.flatMap(text => text.trim().split("\n").map(line => line.trim()));
	assert.equal(new Set(currentPaths).size, currentPaths.length);
	assert.deepEqual(currentPaths.sort(), originalPaths.sort());
	return { commands: oldCommands.length - 1, artifacts: originalPaths.length, lanes: ["transport-ownership", "values", "refinements"] };
};
