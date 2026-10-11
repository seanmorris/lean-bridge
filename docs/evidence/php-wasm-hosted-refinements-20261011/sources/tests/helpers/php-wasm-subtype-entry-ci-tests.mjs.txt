/**
 * Refuse missing probes, skipped execution, lost evidence and suppressed pipeline failures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertPhpWasmEntryWorkflow, disablePhpWasmEntryWorkflow, enablePhpWasmEntryWorkflow, phpWasmEntryCiBlock, phpWasmEntryCiCapture, phpWasmEntryCiCheck, phpWasmEntryCiInvocation, phpWasmEntryCiOutput, phpWasmEntryCiPrepare, phpWasmEntryCiRecord, phpWasmEntryCiRuntime, phpWasmEntryCiUpload } from "./php-wasm-subtype-entry-ci.mjs";
import { assertPhpWasmSubtypeEntryTap, phpWasmSubtypeEntryTestPattern } from "./php-wasm-subtype-entry-ci-tap.mjs";
import { assertPhpWasmSubtypeWorkflow } from "./php-wasm-subtype-ci.mjs";
import { beforePhpWasmEntryCiSource } from "./php-wasm-entry-ci-history.mjs";

const workflowPath = ".github/workflows/consumer-matrix.yml";
const originalTap = () => readFile("docs/evidence/php-wasm-subtype-entry-installed-20261010/run/tap", "utf8");

test("installed PHP-Wasm entry CI preserves the prior workflow and enforces both source routes", async () => {
	const current = await readFile(workflowPath, "utf8"), previous = beforePhpWasmEntryCiSource(workflowPath, current);
	assertPhpWasmEntryWorkflow(current); assertPhpWasmSubtypeWorkflow(previous);
	assert.notEqual(current, previous); assert.equal(disablePhpWasmEntryWorkflow(current), previous);
	assert.equal(enablePhpWasmEntryWorkflow(previous), current);
	const root = await readFile("tests/helpers/php-wasm-subtype-entry-installed-tests.mjs", "utf8");
	for(const name of ["php-wasm-subtype-entry-ci-tests", "php-wasm-entry-ci-history-tests"])
		assert.ok(root.includes(`import "./${name}.mjs";`));
	assert.equal((await readFile("tests/helpers/php-wasm-subtype-entry-tests.mjs", "utf8")).includes('import "./php-wasm-subtype-entry-installed-tests.mjs";'), true);
});

test("installed PHP-Wasm entry CI refuses changed gates, discarded originals and suppressed failures", async () => {
	const current = await readFile(workflowPath, "utf8");
	for(const changed of [
		current.replace(phpWasmEntryCiBlock, "")
		, current.replace(`          ${phpWasmEntryCiPrepare}\n`, "")
		, current.replace(phpWasmEntryCiPrepare, phpWasmEntryCiPrepare + " || true")
		, current.replace(phpWasmEntryCiPrepare, phpWasmEntryCiPrepare.replace(" 2>&1 | tee", " 2>/dev/null | tee"))
		, current.replace(`LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME=${phpWasmEntryCiRuntime} `, "")
		, current.replace(phpWasmEntryCiInvocation, phpWasmEntryCiInvocation.replace("_TEST=1", "_TEST=0"))
		, current.replace(phpWasmSubtypeEntryTestPattern, "ordinary only")
		, current.replace(`          ${phpWasmEntryCiCheck}\n`, "")
		, current.replace(`          ${phpWasmEntryCiCheck}\n`, `          ${phpWasmEntryCiCheck} || true\n`)
		, current.replace(phpWasmEntryCiCapture, phpWasmEntryCiCapture.replace(" 2>&1 | tee", " 2>/dev/null | tee"))
		, current.replace(phpWasmEntryCiBlock, phpWasmEntryCiBlock.replace("set -euo pipefail", "set -eu"))
		, current.replace(phpWasmEntryCiBlock, "          set +e\n" + phpWasmEntryCiBlock)
		, current.replace(phpWasmEntryCiBlock, "      - name: misplaced\n        run: |\n" + phpWasmEntryCiBlock)
		, current.replace(phpWasmEntryCiUpload, "")
		, current.replace(phpWasmEntryCiUpload, `            ${phpWasmEntryCiOutput}/ordinary/report.json\n`)
		, current.replace(phpWasmEntryCiRecord, "")
		, current.replace("  php-wasm-consumers:\n", "  wrong-job:\n")
		, current.replaceAll("      - name: Enforce PHP support\n", "      - name: Unenforced PHP support\n")
	]) assert.throws(() => assertPhpWasmEntryWorkflow(changed));
});

test("installed entry TAP requires actual ordinary and reviewed passes and rejects missing or skipped execution", async () => {
	const tap = await originalTap(); assert.equal(assertPhpWasmSubtypeEntryTap(tap), true);
	for(const changed of [
		"", tap + tap
		, tap.replace("ok 1 -", "not ok 1 -")
		, tap.replace("ordinary installed", "unknown installed")
		, tap.replace("# pass 2", "# pass 0")
		, tap.replace("# tests 2", "# tests 0")
		, tap.replace("# skipped 0", "# skipped 2")
		, tap.replace("# cancelled 0", "# cancelled 1")
		, tap.replace("# fail 0", "# fail 1")
		, tap.replace("1..2", "1..0")
		, tap.replace(/^ok 2[^\n]*\n/mu, "")
		, tap.replace("# fail 0", "# fail 0\n# fail 0")
		, tap.replace(/^ok 1[^\n]*/mu, match => match + " # SKIP")
	]) assert.throws(() => assertPhpWasmSubtypeEntryTap(changed));
});

test("actual CI shell propagates preparation, producer and checker failures while preserving original logs", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-entry-ci-shell-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	for(const name of ["mkdir", "tee"]) await symlink(`/usr/bin/${name}`, join(bin, name));
	// This host records shell wiring only. It never compiles or evaluates PHP/Lean.
	const fakeNode = `#!${process.execPath}\nimport fs from 'node:fs';
const args = process.argv.slice(2), producer = args.includes('--test'), prepare = args[0] === 'scripts/prepare-php-wasm-subtype-entry-runtime.mjs';
fs.appendFileSync('calls.log', (prepare ? 'prepare' : producer ? 'producer' : 'checker') + '\\n');
if (prepare) {
  if (args[1] !== '--output' || args[2] !== '${phpWasmEntryCiRuntime}') process.exit(79);
  process.stdout.write('original fake preparation stdout\\n');
  process.stderr.write('original fake preparation stderr\\n');
  process.exit(Number(process.env.FAKE_PREPARE_EXIT));
}
if (producer) {
  if (process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME !== '${phpWasmEntryCiRuntime}') process.exit(79);
  if (process.env.LEAN_BRIDGE_PHP_WASM_SUBTYPE_ENTRY_TEST !== '1') process.exit(79);
  if (process.env.LEAN_BRIDGE_PHP_WASM_SUBTYPE_ENTRY_OUTPUT !== '${phpWasmEntryCiOutput}') process.exit(79);
  process.stdout.write('original fake producer stdout\\n');
  process.stderr.write('original fake producer stderr\\n');
  process.exit(Number(process.env.FAKE_PRODUCER_EXIT));
}
if (!args.includes('--tap') || !args.includes('${phpWasmEntryCiOutput}/run.tap')) process.exit(79);
process.exit(Number(process.env.FAKE_CHECKER_EXIT));
`;
	await writeFile(join(bin, "node"), fakeNode); await chmod(join(bin, "node"), 0o755);
	const cases = [
		[0, 0, 0, 0, "prepare\nproducer\nchecker\n"]
		, [77, 0, 0, 77, "prepare\n"]
		, [0, 75, 0, 75, "prepare\nproducer\n"]
		, [0, 0, 76, 76, "prepare\nproducer\nchecker\n"]
	];
	for(const [prepare, producer, checker, status, calls] of cases)
	{
		const cwd = join(root, `${prepare}-${producer}-${checker}`); await mkdir(cwd);
		const run = spawnSync("/bin/bash", ["-c", phpWasmEntryCiBlock], {
			cwd, encoding: "utf8"
			, env: { PATH: bin, FAKE_PREPARE_EXIT: String(prepare), FAKE_PRODUCER_EXIT: String(producer), FAKE_CHECKER_EXIT: String(checker) } });
		assert.equal(run.status, status, run.stderr); assert.equal(run.stderr, "");
		assert.equal(await readFile(join(cwd, "calls.log"), "utf8"), calls);
		assert.equal(await readFile(join(cwd, phpWasmEntryCiOutput, "runtime-prepare.log"), "utf8"), "original fake preparation stdout\noriginal fake preparation stderr\n");
		const tap = join(cwd, phpWasmEntryCiOutput, "run.tap");
		if(prepare) await assert.rejects(readFile(tap), { code: "ENOENT" });
		else assert.equal(await readFile(tap, "utf8"), "original fake producer stdout\noriginal fake producer stderr\n");
	}
});

test("entry runtime preparation refuses malformed arguments and existing output before compilation", async t => {
	const command = "scripts/prepare-php-wasm-subtype-entry-runtime.mjs";
	for(const args of [[], ["--unknown", "unused"], ["--output"], ["--output", "--unknown"], ["--output", "unused", "extra"]])
	{
		const run = spawnSync(process.execPath, [command, ...args], { encoding: "utf8" });
		assert.notEqual(run.status, 0); assert.equal(run.stdout, "");
		assert.match(run.stderr, /Usage: prepare-php-wasm-subtype-entry-runtime/u);
	}
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-entry-runtime-refusal-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sentinel = join(root, "existing.txt"); await writeFile(sentinel, "unchanged\n");
	const run = spawnSync(process.execPath, [command, "--output", root], { encoding: "utf8"
		, env: { ...process.env, LEAN_BRIDGE_PHP_EMSDK: join(root, "missing-compiler") } });
	assert.notEqual(run.status, 0); assert.equal(run.stdout, "");
	assert.match(run.stderr, /PHP-Wasm output already exists/u);
	assert.equal(await readFile(sentinel, "utf8"), "unchanged\n");
});

test("paired report CLI checks an explicitly supplied original TAP before accepting any reports", async () => {
	const command = "scripts/check-php-wasm-subtype-entry-reports.mjs";
	const archive = "docs/evidence/php-wasm-subtype-entry-installed-20261010";
	const args = [command, "--directory", join(archive, "r1"), "--tap", join(archive, "run/tap")];
	const accepted = spawnSync(process.execPath, args, { encoding: "utf8" });
	assert.equal(accepted.status, 0, accepted.stderr); assert.equal(accepted.stderr, "");
	for(const extra of [["--tap"], ["--tap", "--unknown"], ["--tap", join(archive, "run/start.json")], ["--tap", join(archive, "run/tap"), "--tap", join(archive, "run/tap")]])
	{
		const rejected = spawnSync(process.execPath, [command, "--directory", join(archive, "r1"), ...extra], { encoding: "utf8" });
		assert.notEqual(rejected.status, 0); assert.equal(rejected.stdout, "");
	}
});
