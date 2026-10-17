/**
 * Source-only boundary controls for the recursive PHP-Wasm records CLI. A successful archive
 * verification stays producer-gated; these runs only prove the refusals and the call contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/check-recursive-checked-record-php-wasm.mjs");
const producer = "a".repeat(40);
const run = args => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" } });

test("recursive PHP-Wasm records CLI refuses bad selections and missing records", async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-php-wasm-cli-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const missing = join(scratch, "definitely-missing-records");
	const valid = ["--route", "ordinary", "--fixture", "recursive", "--producer", producer, "--directory", missing];
	for(const [label, args] of [
		["no arguments", []]
		, ["unknown flag", ["--mode", "full", ...valid.slice(2)]]
		, ["duplicate flag", ["--route", "ordinary", "--route", "reviewed", ...valid.slice(4)]]
		, ["missing value", valid.slice(0, -1)]
		, ["extra argument", [...valid, "--extra"]]
		, ["unknown route", ["--route", "invented", ...valid.slice(2)]]
		, ["unknown fixture", [...valid.slice(0, 2), "--fixture", "nested", ...valid.slice(4)]]
		, ["symbolic producer", [...valid.slice(0, 4), "--producer", "HEAD", ...valid.slice(6)]]
		, ["short producer", [...valid.slice(0, 4), "--producer", "a".repeat(39), ...valid.slice(6)]]
	]) {
		const result = run(args);
		assert.notEqual(result.status, 0, label);
		assert.match(result.stderr, /Usage: check-recursive-checked-record-php-wasm\.mjs --route/u, label);
	}
	// A well-formed selection reaches the filesystem and stops at the absent records directory.
	const absent = run(valid);
	assert.notEqual(absent.status, 0);
	assert.match(absent.stderr, /ENOENT/u);
	assert.doesNotMatch(absent.stderr, /Usage:/u);
});

test("recursive PHP-Wasm records CLI passes every collected record and the exact selection to the controls", async () => {
	const source = await readFile(script, "utf8");
	assert.match(source, /^import \{ checkRecursiveCheckedRecordPhpWasmControls \} from "\.\.\/tests\/helpers\/recursive-checked-record-php-wasm-controls\.mjs";$/mu);
	assert.match(source, /originals\.set\(relative\(root, path\), await readFile\(path\)\);/u);
	assert.equal(source.split("checkRecursiveCheckedRecordPhpWasmControls(").length, 2);
	assert.match(source, /await checkRecursiveCheckedRecordPhpWasmControls\(originals\n\t, \{ route: selected\.route, fixture: selected\.fixture, producerCommit: selected\.producer \}\);/u);
	assert.match(source, /process\.stdout\.write\(canonicalJson\(\{ \.\.\.selected, records: originals\.size, \.\.\.controls \}\) \+ "\\n"\);/u);
});
