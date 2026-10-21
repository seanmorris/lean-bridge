/**
 * Execute the dependent PHP-Wasm CI shell with stand-ins for every failure edge.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { dependentCheckedRecordRoutes } from "./dependent-checked-record-browser-fixture.mjs";

test("dependent PHP-Wasm CI shell closes compiler and all installed routes", async t => {
	const script = resolve("scripts/run-dependent-checked-record-php-wasm-ci.sh");
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dependent-php-wasm-ci-shell-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	for(const command of ["mkdir", "tee"]) await symlink(`/usr/bin/${command}`, join(bin, command));
	const fakeNode = `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2), producer = args.includes('--test');
const compiler = args.some(arg => arg.endsWith('dependent-checked-record-php-wasm-lean-tests.mjs') || arg.endsWith('check-dependent-checked-record-php-wasm-compiler-ci.mjs'));
const route = compiler ? 'compiler' : process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_WASM_ROUTES;
assert.ok(['compiler', ...${JSON.stringify(dependentCheckedRecordRoutes)}].includes(route));
const output = 'build/dependent-checked-record-php-wasm-ci/' + route;
const phase = route + '/' + (producer ? 'producer' : 'checker');
fs.appendFileSync('calls.log', phase + '\\n');
if (compiler) {
  assert.equal(process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_WASM_LEAN_TEST, '1');
  assert.equal(process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_WASM_LEAN_OUTPUT, output + '/records');
} else {
  assert.equal(process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_WASM_TEST, '1');
  assert.equal(process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_WASM_OUTPUT, output + '/records');
}
if (producer) {
  assert.deepEqual(args, ['--test', '--test-concurrency=1', '--test-reporter=tap', ...(compiler
    ? ['tests/helpers/dependent-checked-record-php-wasm-lean-tests.mjs']
    : ['tests/helpers/dependent-checked-record-php-wasm-installed-tests.mjs'])]);
  fs.mkdirSync(output + '/records');
  fs.writeFileSync(output + '/records/partial.json', 'original ' + route);
} else {
  assert.deepEqual(args, compiler
    ? ['scripts/check-dependent-checked-record-php-wasm-compiler-ci.mjs', output + '/run.tap']
    : ['scripts/check-dependent-checked-record-php-wasm-ci.mjs', '--route', route
      , '--producer', 'a'.repeat(40), '--directory', output + '/records/' + route
      , '--tap', output + '/run.tap']);
}
process.stdout.write(phase + ' stdout\\n');
process.stderr.write(phase + ' stderr\\n');
if (process.env.FAKE_FAIL === phase) process.exit(17);
`;
	await writeFile(join(bin, "node"), fakeNode); await chmod(join(bin, "node"), 0o755);
	await writeFile(join(bin, "git"), `#!/bin/bash\nif [[ "$*" != 'rev-parse HEAD' ]]; then exit 99; fi\nprintf '%s\\n' '${"a".repeat(40)}'\n`);
	await chmod(join(bin, "git"), 0o755);
	const env = { ...process.env, PATH: bin
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_WASM_LEAN_TEST: "0"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_WASM_LEAN_OUTPUT: "/wrong"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_WASM_TEST: "0"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_WASM_ROUTES: "invented"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_WASM_OUTPUT: "/wrong" };
	const order = ["compiler", ...dependentCheckedRecordRoutes]
		.flatMap(route => [route + "/producer", route + "/checker"]);
	for(const [index, failure] of ["none", ...order].entries())
	{
		const directory = join(root, String(index)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script], {
			cwd: directory, env: { ...env, FAKE_FAIL: failure }, encoding: "utf8"
		});
		assert.equal(result.status, failure === "none" ? 0 : 17, result.stderr);
		const expected = failure === "none" ? order : order.slice(0, order.indexOf(failure) + 1);
		const calls = await readFile(join(directory, "calls.log"), "utf8");
		assert.equal(calls, expected.join("\n") + "\n");
		for(const phase of expected)
		{
			const [route, kind] = phase.split("/");
			const output = join(directory, "build/dependent-checked-record-php-wasm-ci", route);
			const log = await readFile(join(output, kind === "producer" ? "run.tap" : "check.log"), "utf8");
			assert.ok(log.includes(phase + " stdout\n") && log.includes(phase + " stderr\n"));
			assert.equal(await readFile(join(output, "records/partial.json"), "utf8"), "original " + route);
		}
		const again = spawnSync("/bin/bash", [script], { cwd: directory, env, encoding: "utf8" });
		assert.notEqual(again.status, 0);
		assert.equal(await readFile(join(directory, "calls.log"), "utf8"), calls);
	}
	const invalid = join(root, "invalid"); await mkdir(invalid);
	const result = spawnSync("/bin/bash", [script, "ordinary-source"], {
		cwd: invalid, env, encoding: "utf8"
	});
	assert.equal(result.status, 2); assert.deepEqual(await readdir(invalid), []);
});
