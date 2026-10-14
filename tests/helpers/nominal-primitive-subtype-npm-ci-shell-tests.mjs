/**
 * Exercise the real npm CI shell's sequencing and failure behavior with stand-in tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/run-nominal-primitive-subtype-npm-ci.sh");
const runtime = '/toolchains/Lean WASM "runtime"';
const selections = ["ordinary-full", "reviewed-full", "ordinary-result-only", "reviewed-result-only"];

test("nominal npm CI runs all four selections and preserves each producer or checker failure", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-npm-ci-shell-"));
	t.after(() => rm(root, { recursive: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	for(const name of ["mkdir", "tee"]) await symlink(`/usr/bin/${name}`, join(bin, name));
	await writeFile(join(bin, "git"), `#!/bin/bash\nif [[ "$*" != 'rev-parse HEAD' ]]; then exit 99; fi\nprintf '%s\\n' '${"a".repeat(40)}'\n`);
	await chmod(join(bin, "git"), 0o755);
	await writeFile(join(bin, "node"), `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2), producer = args.includes('--test');
assert.equal(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT, ${JSON.stringify(runtime)});
for (const key of ['LEAN_NUM_THREADS', 'OMP_NUM_THREADS', 'EMCC_CORES', 'CMAKE_BUILD_PARALLEL_LEVEL']) assert.equal(process.env[key], '1');
assert.equal(process.env.MAKEFLAGS, '-j1');
const route = process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_ROUTES;
const mode = process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_MODES;
assert.ok(['ordinary', 'reviewed'].includes(route));
assert.ok(['full', 'result-only'].includes(mode));
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST, '1');
const selection = route + '-' + mode, output = 'build/nominal-primitive-subtype-npm-ci/' + selection;
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_OUTPUT, output + '/records');
const call = selection + '/' + (producer ? 'producer' : 'checker');
fs.appendFileSync('calls.log', call + '\\n');
if (producer) {
  assert.deepEqual(args, ['--test', '--test-concurrency=1', '--test-reporter=tap',
    '--test-name-pattern=^installed npm primitive-base nominal Subtypes reproduce and relocate ' + route + ' ' + mode + '$',
    'tests/helpers/nominal-primitive-subtype-npm-installed-tests.mjs']);
  fs.mkdirSync(output + '/records');
  fs.writeFileSync(output + '/records/partial.json', 'original ' + selection);
  process.stdout.write('original ' + selection + ' stdout\\n');
  process.stderr.write('original ' + selection + ' stderr\\n');
} else {
  assert.deepEqual(args, ['scripts/check-nominal-primitive-subtype-npm-ci.mjs', '--route', route, '--mode', mode,
    '--producer', 'a'.repeat(40), '--directory', output + '/records/' + route + '/' + mode,
    '--tap', output + '/run.tap']);
  process.stdout.write('checked ' + selection + '\\n');
}
if (process.env.FAKE_FAIL === call) process.exit(17);
`);
	await chmod(join(bin, "node"), 0o755);
	const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_")));
	const order = selections.flatMap(selection => [selection + "/producer", selection + "/checker"]);
	let sequence = 0;
	for(const failure of ["none", ...order])
	{
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const env = { ...base, PATH: bin, FAKE_FAIL: failure };
		const result = spawnSync("/bin/bash", [script, runtime], { cwd: directory, env, encoding: "utf8" });
		assert.equal(result.status, failure === "none" ? 0 : 17, result.stderr);
		const expected = failure === "none" ? order : order.slice(0, order.indexOf(failure) + 1);
		const calls = await readFile(join(directory, "calls.log"), "utf8");
		assert.equal(calls, expected.join("\n") + "\n");
		for(const call of expected)
		{
			const [selection, kind] = call.split("/"), output = join(directory, "build/nominal-primitive-subtype-npm-ci", selection);
			if(kind === "checker") assert.equal(await readFile(join(output, "verification.json"), "utf8"), `checked ${selection}\n`);
			else
			{
				const tap = await readFile(join(output, "run.tap"), "utf8");
				assert.ok(tap.includes(`original ${selection} stdout\n`) && tap.includes(`original ${selection} stderr\n`));
				assert.equal(await readFile(join(output, "records/partial.json"), "utf8"), "original " + selection);
			}
		}
		const again = spawnSync("/bin/bash", [script, runtime], { cwd: directory, env, encoding: "utf8" });
		assert.notEqual(again.status, 0); assert.equal(await readFile(join(directory, "calls.log"), "utf8"), calls);
	}
	for(const value of ["", "override"])
	{
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, runtime], { cwd: directory, env: { ...base, PATH: bin, LEAN_BRIDGE_LAKE_RUNTIME_ROOT: value }, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
	for(const args of [[], ["relative"], [""], [runtime, "extra"]])
	{
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...args], { cwd: directory, env: { ...base, PATH: bin }, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
	t.diagnostic("Nine complete/failing real-shell scenarios, nine stale-output refusals and six invalid argument/override controls; no compiled acceptance claimed by stand-ins.");
});
