/**
 * Partition the original C/C++ acceptance commands without dropping a gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

export const nativeConsumerPartitionBaseline = "ad838834ca234ac7715462df368c28ca0d1cede1";
export const nativeConsumerPartitionSha256 = "389ad42262640d738a437092c5e374d885ce95df81ba5e9db6eb45f3a3f6e9dc";
export const nativeConsumerValuesJob = "native-c-family-values";
export const nativeConsumerValuesStep = "type_corpus_c_family_values";
export const nativeConsumerValuesUpload = "Upload copied, callback and owned C/C++ observations";
export const nativeConsumerPartitionSummaryGate = `      - name: Require both C and C++ acceptance jobs
        if: needs.native-consumers.result != 'success' || needs.native-c-family-values.result != 'success'
        run: exit 1
`;

const once = (source, from, to) => {
	assert.equal(source.split(from).length, 2, `Expected one workflow fragment: ${from}`);
	return source.replace(from, () => to);
};
const jobAt = (source, name) => {
	const prefix = `  ${name}:\n`;
	assert.equal(source.split(prefix).length, 2);
	return prefix + source.split(prefix)[1].split(/^ {2}[a-z][a-z0-9-]*:\n/mu)[0];
};
const stepAt = (job, id) => {
	const steps = job.split(/^ {6}- name: /mu).slice(1).map(text => "      - name: " + text);
	const selected = steps.filter(step => step.includes(`        id: ${id}\n`));
	assert.equal(selected.length, 1);
	return selected[0];
};
const commandsAt = step => {
	const match = /^ {8}run: \|\n((?: {10}.*\n|\n)*)/mu.exec(step);
	assert.ok(match);
	return match[1];
};
const pathsAt = step => {
	const match = /^ {10}path: \|\n((?: {12}.*\n)+)/mu.exec(step);
	assert.ok(match);
	return match[1];
};

/**
 * Select the actual required values gate, retaining support for archived layouts.
 *
 * @param workflow - Complete current or historical downstream workflow.
 */
export const nativeConsumerValueGate = workflow => {
	const split = workflow.includes(`  ${nativeConsumerValuesJob}:\n`);
	const job = jobAt(workflow, split ? nativeConsumerValuesJob : "native-consumers");
	const step = stepAt(job, split ? nativeConsumerValuesStep : "type_corpus_c_family");
	const name = split ? nativeConsumerValuesUpload : "Upload installed C and C++ corpus observations";
	const upload = job.split(`      - name: ${name}\n`)[1]?.split("      - name: ")[0];
	assert.equal(typeof upload, "string");
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	if(split)
	{
		assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
		assert.match(job, /^ {4}timeout-minutes: 240$/mu);
		assert.doesNotMatch(job, /^ {4}(?:if|needs|continue-on-error):/mu);
		assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
		assert.ok(commandsAt(step).startsWith("          set -euo pipefail\n          source scripts/env.sh\n"));
		assert.match(upload, /^ {8}if: always\(\)$/mu);
		const summary = jobAt(workflow, "support-summary");
		assert.match(summary, /^ {6}- native-c-family-values$/mu);
		assert.match(summary, /^ {6}- native-consumers$/mu);
		assert.ok(summary.includes("    steps:\n" + nativeConsumerPartitionSummaryGate));
	}
	else
	{
		assert.match(step, /^ {8}if: matrix\.profile == 'c-family'$/mu);
		assert.match(upload, /^ {8}if: always\(\) && matrix\.profile == 'c-family'$/mu);
	}
	return { step, upload, split };
};

/**
 * Move copied, callback and owned commands to a required independently bootstrapped job.
 *
 * @param source - The exact pre-partition workflow.
 */
export const partitionNativeConsumerWorkflow = source => {
	assert.equal(sha256(source), nativeConsumerPartitionSha256, "Partition only the reviewed predecessor");
	const oldJob = jobAt(source, "native-consumers");
	const compare = stepAt(oldJob, "type_corpus_c_family"), commands = commandsAt(compare);
	const shell = "          source scripts/env.sh\n";
	assert.ok(commands.startsWith(shell));
	const refinement = commands.indexOf("          npm run test:native-fin\n");
	const owned = commands.indexOf("          LEAN_BRIDGE_C_CALLABLE_TEST=1 node --test tests/c-callables.test.mjs\n");
	assert.ok(refinement > shell.length && owned > refinement);
	const copiedCommands = commands.slice(shell.length, refinement);
	const refinementCommands = commands.slice(refinement, owned);
	const ownedCommands = commands.slice(owned);
	const oldUpload = oldJob.split("      - name: Upload installed C and C++ corpus observations\n")[1]?.split("      - name: ")[0];
	assert.equal(typeof oldUpload, "string");
	const paths = pathsAt(oldUpload), firstRefinement = paths.indexOf("            build/native-fin/native.json\n");
	const lastGraph = "            build/recursive/c-family.json\n";
	assert.ok(firstRefinement > 0 && paths.endsWith(lastGraph));
	const refinementPaths = paths.slice(firstRefinement, -lastGraph.length);
	const valuePaths = paths.slice(0, firstRefinement) + lastGraph;
	let job = once(oldJob, commands, shell + refinementCommands);
	job = once(job, paths, refinementPaths);
	const recordStart = "      - name: Record native consumer observations\n";
	const record = job.split(recordStart)[1]?.split("      - name: ")[0];
	assert.equal(typeof record, "string");
	let actualRecord = once(record,
		" && npm run test:type-corpus:c-family && LEAN_BRIDGE_REVIEWED_NATIVE_PROFILES=c,cpp node --test tests/type-corpus-reviewed-native.test.mjs\"\n", "\"\n");
	actualRecord = actualRecord.split("\n").filter(line => !line.includes("consumer_command=\"$consumer_command && ")
		|| !/LEAN_BRIDGE_(?:NATIVE_GRAPH_PACKAGE|C_CLOSURE_THREAD|NATIVE_RECURSIVE_CALLABLE|OWNED_NATIVE|C_RECURSIVE_CALLABLE|CPP_RECURSIVE_CALLABLE|C_FAMILY_RECURSIVE_DOCUMENTATION)_TEST=|npm run test:owned-/u.test(line)).join("\n");
	actualRecord = actualRecord.replace(/^ {12}if \[ "\$consumer" = c \]; then\n(?: {14}consumer_command=.*\n){4} {12}fi\n/mu, "");
	assert.ok(!actualRecord.includes("CALLABLE_TEST") && !actualRecord.includes("test:owned-") && !actualRecord.includes("test:type-corpus:"));
	job = once(job, record, actualRecord);
	const valuesJob = `  ${nativeConsumerValuesJob}:
    name: C and C++ copied, callback and owned packages
    runs-on: ubuntu-24.04
    timeout-minutes: 240
    steps:
      - name: Check out the exact revision
        uses: actions/checkout@v6
        with:
          fetch-depth: 0
          persist-credentials: false
      - name: Require source history before native consumer builds
        run: test "$(git rev-parse --is-shallow-repository)" = false
      - name: Install Node.js
        uses: actions/setup-node@v6
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - name: Install Nix
        uses: cachix/install-nix-action@v31
      - name: Install dependencies without lifecycle scripts
        run: npm ci --ignore-scripts
      - name: Bound apt network waits
        uses: ./.github/actions/bounded-apt
        timeout-minutes: 1
      - name: Install the native compiler prerequisites
        timeout-minutes: 20
        run: |
          sudo apt-get update
          sudo apt-get install -y build-essential cmake pkg-config zstd m4 libgmp-dev ripgrep
      - name: Prepare the pinned Lean compiler
        run: bash scripts/bootstrap-toolchains.sh --lean-only
      - name: Require copied, callback and owned C/C++ packages
        id: ${nativeConsumerValuesStep}
        run: |
          set -euo pipefail
${shell}${copiedCommands}${ownedCommands}      - name: ${nativeConsumerValuesUpload}
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: type-corpus-c-family-values-\${{ github.sha }}
          path: |
${valuePaths}          if-no-files-found: error
          retention-days: 30

`;
	let result = once(source, oldJob, valuesJob + job);
	const summary = jobAt(result, "support-summary");
	let required = once(summary, "      - native-consumers\n", "      - native-consumers\n      - native-c-family-values\n");
	required = once(required, "    steps:\n", "    steps:\n" + nativeConsumerPartitionSummaryGate);
	result = once(result, summary, required);
	return result;
};

/**
 * Give the unchanged shared compiler commands 30 minutes of measured headroom.
 *
 * @param source - Complete predecessor Perl workflow.
 */
export const extendPerlCompilerBudget = source => {
	const job = jobAt(source, "compiler-checks");
	return once(source, job, once(job, "    timeout-minutes: 60\n", "    timeout-minutes: 90\n"));
};

/**
 * Check exact command and upload conservation separately from whole-file equality.
 *
 * @param previous - Authenticated predecessor workflow.
 * @param current - Actual complete partitioned workflow.
 */
export const assertNativeConsumerPartition = (previous, current) => {
	assert.equal(current, partitionNativeConsumerWorkflow(previous));
	const original = commandsAt(stepAt(jobAt(previous, "native-consumers"), "type_corpus_c_family"));
	const refinements = commandsAt(stepAt(jobAt(current, "native-consumers"), "type_corpus_c_family"));
	const values = commandsAt(stepAt(jobAt(current, nativeConsumerValuesJob), nativeConsumerValuesStep));
	const shell = "          source scripts/env.sh\n";
	const beforeOwned = values.indexOf("          LEAN_BRIDGE_C_CALLABLE_TEST=1 ");
	assert.ok(beforeOwned > 0);
	assert.equal(values.slice("          set -euo pipefail\n".length, beforeOwned)
		+ refinements.slice(shell.length) + values.slice(beforeOwned), original);
	const oldPaths = pathsAt(jobAt(previous, "native-consumers")).trim().split("\n").map(line => line.trim());
	const newPaths = [pathsAt(jobAt(current, "native-consumers")), pathsAt(jobAt(current, nativeConsumerValuesJob))]
		.flatMap(text => text.trim().split("\n").map(line => line.trim()));
	assert.equal(new Set(newPaths).size, newPaths.length, "Do not duplicate original artifact paths");
	assert.deepEqual(newPaths.sort(), oldPaths.sort(), "Preserve every original artifact path");
	return { commands: original.trim().split("\n").length
		, artifacts: oldPaths.length
		, independentJobs: ["native-consumers", nativeConsumerValuesJob] };
};
