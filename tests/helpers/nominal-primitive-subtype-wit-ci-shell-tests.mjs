/**
 * Exercise the real nineteen-base WIT CI shell with stand-ins and every failure position.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/run-nominal-primitive-subtype-wit-ci.sh");
const selections = ["ordinary-full", "reviewed-full", "ordinary-result-only", "reviewed-result-only"];
const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_WIT_";

test("primitive-base WIT CI runs four serial selections and preserves preflight, producer and checker failures", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-wit-ci-shell-"));
	t.after(() => rm(root, { recursive: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	const commands = [join(root, 'Compiler "12"/cc'), join(root, 'Wasm "1.245"/wasm-tools'), join(root, 'C API "42"/root')];
	for(const command of commands.slice(0, 2))
	{
		await mkdir(dirname(command), { recursive: true }); await writeFile(command, "stand-in, never invoked\n"); await chmod(command, 0o755);
	}
	await mkdir(commands[2], { recursive: true });
	for(const name of ["mkdir", "tee", "readlink"]) await symlink(`/usr/bin/${name}`, join(bin, name));
	await writeFile(join(bin, "git"), `#!/bin/bash\nif [[ "$*" != 'rev-parse HEAD' ]]; then exit 99; fi\nprintf '%s\\n' '${"a".repeat(40)}'\n`);
	await chmod(join(bin, "git"), 0o755);
	await writeFile(join(bin, "node"), `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const originalArgs = process.argv.slice(2), producer = originalArgs.includes('--test');
const preflight = originalArgs[0] === 'scripts/select-nominal-subtype-wit-ci-tools.mjs';
if (!preflight) assert.equal(originalArgs[0], '--max-old-space-size=3072');
const args = preflight ? originalArgs : originalArgs.slice(1);
assert.equal(process.env.CC, ${JSON.stringify(commands[0])});
assert.equal(process.env.LEAN_BRIDGE_WASM_TOOLS, ${JSON.stringify(commands[1])});
assert.equal(process.env.LEAN_BRIDGE_WASMTIME_C_API, ${JSON.stringify(commands[2])});
if (preflight) {
  assert.deepEqual(args, ['scripts/select-nominal-subtype-wit-ci-tools.mjs', ...${JSON.stringify(commands)}, 'build/nominal-primitive-subtype-wit-ci']);
  assert.equal(process.env.${prefix}TEST, undefined);
  fs.appendFileSync('calls.log', 'preflight\\n');
  process.stdout.write(JSON.stringify({selected: ${JSON.stringify(commands)}}) + '\\n');
  process.exit(process.env.FAKE_FAIL === 'preflight' ? 17 : 0);
}
const route = process.env.${prefix}ROUTES;
const mode = process.env.${prefix}MODES;
assert.ok(['ordinary', 'reviewed'].includes(route)); assert.ok(['full', 'result-only'].includes(mode));
assert.equal(process.env.${prefix}TEST, '1');
assert.equal(process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, '2.38');
assert.equal(process.env.LEAN_NUM_THREADS, '1'); assert.equal(process.env.OMP_NUM_THREADS, '1'); assert.equal(process.env.MAKEFLAGS, '-j1');
assert.equal(process.env.CMAKE_BUILD_PARALLEL_LEVEL, '1');
const selection = route + '-' + mode, output = 'build/nominal-primitive-subtype-wit-ci/' + selection;
assert.equal(process.env.${prefix}OUTPUT, output + '/records');
const call = selection + '/' + (producer ? 'producer' : 'checker'); fs.appendFileSync('calls.log', call + '\\n');
if (producer) {
  assert.deepEqual(args, ['--test', '--test-concurrency=1', '--test-reporter=tap',
    '--test-name-pattern=^installed primitive-base nominal WIT packages reproduce and relocate ' + route + ' ' + mode + '$',
    'tests/helpers/nominal-primitive-subtype-wit-installed-tests.mjs']);
  fs.mkdirSync(output + '/records'); fs.writeFileSync(output + '/records/partial.json', 'original ' + selection);
  process.stdout.write('original ' + selection + ' stdout\\n'); process.stderr.write('original ' + selection + ' stderr\\n');
} else {
  assert.deepEqual(args, ['scripts/check-nominal-primitive-subtype-wit-ci.mjs', '--route', route, '--mode', mode,
    '--producer', 'a'.repeat(40), '--directory', output + '/records/' + route + '/' + mode,
    '--tap', output + '/run.tap', '--glibc', '2.38', '--cc', process.env.CC,
    '--wasm-tools', process.env.LEAN_BRIDGE_WASM_TOOLS, '--wasmtime-capi', process.env.LEAN_BRIDGE_WASMTIME_C_API]);
  process.stdout.write('checked ' + selection + '\\n');
}
if (process.env.FAKE_FAIL === call) process.exit(17);
`);
	await chmod(join(bin, "node"), 0o755);
	const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_")));
	const order = ["preflight", ...selections.flatMap(selection => [selection + "/producer", selection + "/checker"])];
	let sequence = 0;
	for(const failure of ["none", ...order])
	{
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const env = { ...base, PATH: bin, FAKE_FAIL: failure };
		const result = spawnSync("/bin/bash", [script, ...commands], { cwd: directory, env, encoding: "utf8", timeout: 60000 });
		assert.equal(result.status, failure === "none" ? 0 : 17, result.stderr);
		const expected = failure === "none" ? order : order.slice(0, order.indexOf(failure) + 1);
		const calls = await readFile(join(directory, "calls.log"), "utf8");
		assert.equal(calls, expected.join("\n") + "\n");
		assert.deepEqual(JSON.parse(await readFile(join(directory, "build/nominal-primitive-subtype-wit-ci/tools.json"))), { selected: commands });
		for(const call of expected.filter(call => call !== "preflight"))
		{
			const [selection, kind] = call.split("/"), output = join(directory, "build/nominal-primitive-subtype-wit-ci", selection);
			if(kind === "checker") assert.equal(await readFile(join(output, "verification.json"), "utf8"), `checked ${selection}\n`);
			else
			{
				const tap = await readFile(join(output, "run.tap"), "utf8");
				assert.ok(tap.includes(`original ${selection} stdout\n`) && tap.includes(`original ${selection} stderr\n`));
				assert.equal(await readFile(join(output, "records/partial.json"), "utf8"), "original " + selection);
			}
		}
		const again = spawnSync("/bin/bash", [script, ...commands], { cwd: directory, env, encoding: "utf8", timeout: 60000 });
		assert.notEqual(again.status, 0); assert.equal(await readFile(join(directory, "calls.log"), "utf8"), calls);
	}
	const floor = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR";
	const preselected = [
		[floor, ""], [floor, "2.36"], [floor, "2.38"], [prefix + "TEST", "1"]
		, [prefix + "ROUTES", "ordinary"], [prefix + "MODES", "full"]
		, [prefix + "OUTPUT", "build/elsewhere"]
	];
	for(const [key, value] of preselected)
	{
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...commands], { cwd: directory, env: { ...base, PATH: bin, [key]: value }, encoding: "utf8" });
		assert.equal(result.status, 2, key); assert.deepEqual(await readdir(directory), []);
	}
	for(const args of [[], [commands[0]], [...commands, "extra"], ...commands.map((_, index) => commands.map((value, position) => index === position ? "relative" : value))])
	{
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...args], { cwd: directory, env: { ...base, PATH: bin }, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
	t.diagnostic("Ten complete/failing shell scenarios, ten stale-output refusals, seven preselected-environment and six argument controls; stand-ins do not claim compiled acceptance");
});
