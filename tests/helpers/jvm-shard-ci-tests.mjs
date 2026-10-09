/**
 * The managed JVM consumer and the owned JVM values job together run exactly the former single
 * JVM step, record and upload, each within its own 240-minute budget (#1449).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedJvmEnforced } from "./owned-jvm-job.mjs";
import { beforeDotnetDispatchIntegrationSource } from "./dotnet-dispatch-integration-source-history.mjs";
import "./jvm-shard-source-history-tests.mjs";

// The single JVM corpus step, its uploaded paths and its recorded commands before the split.
const former = Object.freeze({
	body: "bf29cebe7487d03179c6dbd00e5b4948c5f7025e735e19c6084f5ca95718d0e3"
	, paths: "d504f225b0488df14877fe4076111cfa2a7f5a86a1af61f27afe4fbe39a90894"
	, record: "cd82b8d6ef120a2e58dbc8bc3659b68f5a0df00c8b76e6a912e905fedbbef3ce" });
// The owned block followed these lines in each former list.
const anchors = Object.freeze({
	body: "          test -s build/recursive-callables/jvm-mixed.json"
	, paths: "            build/recursive-callables/jvm-mixed.json"
	, record: '              consumer_command="$consumer_command && LEAN_BRIDGE_JVM_RECURSIVE_CALLABLE_TEST=1 node --test tests/jvm-recursive-callables.test.mjs"' });

/**
 * Return a job's lines from the two-space-indented workflow.
 *
 * @param lines - Workflow lines.
 * @param job - Job key.
 */
const jobLines = (lines, job) => {
	const start = lines.indexOf(`  ${job}:`);
	assert.ok(start >= 0, job);
	const end = lines.findIndex((line, index) => index > start && /^ {2}[a-z][a-z0-9-]*:$/u.test(line));
	return lines.slice(start, end < 0 ? lines.length : end);
};

/**
 * Return one step's lines, from its name to the next step.
 *
 * @param lines - Job lines.
 * @param name - Title written after the step's `- name:`.
 */
const stepLines = (lines, name) => {
	const start = lines.indexOf(`      - name: ${name}`);
	assert.ok(start >= 0, name);
	const end = lines.findIndex((line, index) => index > start && line.startsWith("      - name: "));
	return lines.slice(start, end < 0 ? lines.length : end);
};

/**
 * Return the lines of a block scalar that follows an exact header line.
 *
 * @param lines - Step lines.
 * @param header - Header such as "        run: |".
 * @param indent - Indentation of the block's lines.
 */
const blockLines = (lines, header, indent) => {
	const start = lines.indexOf(header);
	assert.ok(start >= 0, header);
	const end = lines.findIndex((line, index) => index > start && !line.startsWith(indent));
	return lines.slice(start + 1, end < 0 ? lines.length : end);
};
const insertAfter = (lines, anchor, inserted) => {
	const index = lines.indexOf(anchor);
	assert.ok(index >= 0 && lines.indexOf(anchor, index + 1) < 0, anchor);
	return [...lines.slice(0, index + 1), ...inserted, ...lines.slice(index + 1)];
};
const digest = lines => sha256(lines.join("\n"));

/**
 * Require that the two JVM jobs together keep exactly the former JVM step, record and evidence.
 *
 * @param source - Complete consumer-matrix workflow text.
 */
export const assertJvmShardContract = source => {
	// The later managed-Fin integration adds GDB to both the executed and recorded command.
	// Require those live gates before restoring the exact earlier workflow for the split audit.
	const fin = "LEAN_BRIDGE_GDB=/usr/bin/gdb LEAN_BRIDGE_JVM_FIN_TEST=1 node --test tests/jvm-fin.test.mjs";
	for(const line of [`          ${fin}\n`, `              consumer_command="$consumer_command && ${fin}"\n`])
		assert.equal(source.split(line).length, 2, "the live JVM Fin command retains its debugger");
	source = beforeDotnetDispatchIntegrationSource(".github/workflows/consumer-matrix.yml", source);
	const lines = source.split("\n");
	const managed = jobLines(lines, "managed-consumers"), owned = jobLines(lines, "owned-jvm-values");
	assert.ok(managed.includes("    timeout-minutes: 240") && owned.includes("    timeout-minutes: 240"));
	assert.ok(owned.includes("    runs-on: ubuntu-24.04"));
	// Nothing in the owned job may be skipped or tolerated as failed, except the evidence upload's always().
	assert.deepEqual(owned.filter(line => /continue-on-error|^ {4,8}if:/u.test(line)), ["        if: always()"]);
	// Commands: the owned job runs the former step's exports and then exactly the moved block.
	const corpus = blockLines(stepLines(managed, "Compare isolated Java and Kotlin corpus consumers with fresh Lean"), "        run: |", "          ");
	const verifyStep = stepLines(owned, "Verify owned JVM values, transfers, borrows and receivers");
	assert.deepEqual(verifyStep.slice(0, 2), ["      - name: Verify owned JVM values, transfers, borrows and receivers", "        run: |"]);
	const verify = blockLines(verifyStep, "        run: |", "          ");
	const exports = corpus.slice(0, corpus.indexOf("          source scripts/env.sh") + 1);
	assert.equal(exports.length, 13);
	assert.deepEqual(verify.slice(0, exports.length), exports);
	const moved = verify.slice(exports.length);
	assert.equal(moved.length, 74);
	assert.ok(moved.every(line => /owned-jvm|verified-jvm-assets/u.test(line)), "only owned JVM commands and reports move");
	assert.deepEqual(corpus.filter(line => /owned-jvm|verified-jvm-assets/u.test(line)), []);
	assert.equal(digest(insertAfter(corpus, anchors.body, moved)), former.body);
	// Evidence: owned report paths move to the new job's always-uploaded artifact.
	const corpusUpload = stepLines(managed, "Upload installed Java and Kotlin corpus observations");
	const ownedUpload = stepLines(owned, "Preserve owned JVM value acceptance");
	const ownedPaths = blockLines(ownedUpload, "          path: |", "            ");
	assert.equal(ownedPaths.length, 16);
	assert.equal(digest(insertAfter(blockLines(corpusUpload, "          path: |", "            "), anchors.paths, ownedPaths)), former.paths);
	for(const line of ["        if: always()", "        uses: actions/upload-artifact@v7", "          name: owned-jvm-values-${{ github.sha }}", "          if-no-files-found: error"])
		assert.ok(ownedUpload.includes(line), line);
	const names = lines.filter(line => /^ {10}name: [\w.-]+-\$\{\{ github\.sha \}\}$/u.test(line));
	assert.equal(new Set(names).size, names.length, "artifact names stay distinct");
	// Record: the managed JVM row lists only the commands its own job runs.
	const record = stepLines(managed, "Record managed consumer observations");
	const start = record.indexOf('            if [ "$consumer" = jvm ]; then');
	const jvm = record.slice(start, record.findIndex((line, index) => index > start && line.startsWith("            fi")));
	const recorded = jvm.filter(line => line.startsWith("              consumer_command="));
	assert.deepEqual(recorded.filter(line => /owned-jvm|verified-jvm-assets/u.test(line)), []);
	const movedRecord = ["runtime", "calls", "thread-exit", "packaging"].map(name => moved.find(line => line.includes(`tests/owned-jvm-${name}.test.mjs`)))
		.concat(["transfers", "borrows", "receivers", "receiver-gc"].map(name => `npm run test:owned-jvm-${name}`))
		.map(command => `              consumer_command="$consumer_command && ${command.trim().replace(/ > build\/[\w.-]+ 2>&1$/u, "")}"`);
	assert.equal(digest(insertAfter(recorded, anchors.record, movedRecord)), former.record);
	// The summary cannot publish success unless the owned job itself succeeded.
	const summary = jobLines(lines, "support-summary");
	assert.ok(summary.includes("    if: always()"));
	assert.ok(blockLines(summary, "    needs:", "      - ").includes("      - owned-jvm-values"));
	const enforce = stepLines(summary, "Enforce owned JVM value acceptance");
	assert.deepEqual(enforce, ["      - name: Enforce owned JVM value acceptance", "        if: needs.owned-jvm-values.result != 'success'", "        run: exit 1"]);
};

test("the two JVM jobs together keep exactly the former commands, reports, record and evidence", async () => {
	assertJvmShardContract(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("the JVM split audit rejects losing either live Fin debugger selection", async () => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const fin = "LEAN_BRIDGE_GDB=/usr/bin/gdb LEAN_BRIDGE_JVM_FIN_TEST=1 node --test tests/jvm-fin.test.mjs";
	for(const line of [`          ${fin}\n`, `              consumer_command="$consumer_command && ${fin}"\n`])
	{
		const changed = source.replace(line, line.replace("LEAN_BRIDGE_GDB=/usr/bin/gdb ", ""));
		assert.notEqual(changed, source);
		assert.throws(() => assertJvmShardContract(changed), /live JVM Fin command retains its debugger/u);
	}
});

test("a skipped or failure-tolerant owned JVM verifier is rejected by both contracts", async () => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assertOwnedJvmEnforced(source);
	const verify = "      - name: Verify owned JVM values, transfers, borrows and receivers\n";
	const kotlin = "      - name: Install the pinned Kotlin compiler\n";
	const job = "    name: Owned JVM values, transfers, borrows and receivers\n";
	for(const [label, before, after] of [
		["skipped verifier", verify, verify + "        if: false\n"]
		, ["conditional verifier", verify, verify + "        if: github.event_name == 'schedule'\n"]
		, ["tolerated verifier failure", verify, verify + "        continue-on-error: true\n"]
		, ["skipped toolchain setup", kotlin, kotlin + "        if: false\n"]
		, ["skipped job", job, job + "    if: false\n"]
	]) {
		assert.equal(source.split(before).length, 2, label);
		const changed = source.replace(before, after);
		assert.throws(() => assertOwnedJvmEnforced(changed), assert.AssertionError, label);
		assert.throws(() => assertJvmShardContract(changed), assert.AssertionError, label);
	}
	const upload = source.replace("        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: owned-jvm-values-", "        if: success()\n        uses: actions/upload-artifact@v7\n        with:\n          name: owned-jvm-values-");
	assert.notEqual(upload, source);
	assert.throws(() => assertOwnedJvmEnforced(upload), assert.AssertionError, "upload only on success");
	assert.throws(() => assertJvmShardContract(upload), assert.AssertionError, "upload only on success");
});

test("the owned JVM job installs every toolchain the former JVM step relied on", async () => {
	const lines = (await readFile(".github/workflows/consumer-matrix.yml", "utf8")).split("\n");
	const owned = jobLines(lines, "owned-jvm-values").join("\n");
	const kotlin = "1adb6f1a5845ba0aa5a59e412e44c8e405236b957de1a9683619f1dca3b16932  build/kotlin-compiler.zip";
	const fragments = ["uses: actions/checkout@v6", "fetch-depth: 0"
		, "uses: cachix/install-nix-action@v31", "npm ci --ignore-scripts"
		, "uses: ./.github/actions/bounded-apt"
		, "sudo apt-get update && sudo apt-get install -y build-essential zstd m4"
		, "bash scripts/bootstrap-toolchains.sh --lean-only"
		, "sudo apt-get install -y ripgrep", "dotnet-version: '8.0.424'"
		, "ruby-version: '3.3.12'", "distribution: temurin"
		, "java-version: '22.0.2'"
		, "sudo apt-get install -y maven unzip python3-venv pkg-config"
		, `echo '${kotlin}' | sha256sum --check`
		, "unzip -q build/kotlin-compiler.zip -d build/kotlin-tools"
		, "bash scripts/bootstrap-rust-ci.sh"];
	for(const fragment of fragments)
		assert.ok(owned.includes(fragment), fragment);
	// Every apt step is bounded and follows the shared apt network settings.
	for(const step of owned.split("      - name: ").filter(text => /apt-get install/u.test(text)))
		assert.match(step, /^ {8}timeout-minutes: 20$/mu, step.split("\n")[0]);
	assert.ok(owned.indexOf("./.github/actions/bounded-apt") < owned.indexOf("apt-get update"));
});
