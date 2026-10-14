/**
 * Exercise the real CI shell with explicit command stand-ins, not compiler acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
const nominalPrimitiveSubtypeBrowserSelections = ["full", "result-only"].flatMap(mode => ["ordinary", "reviewed"].map(route => [route, mode]));
const runtime = '/toolchains/Lean WASM "runtime"';

test("primitive-base browser CI shell captures every phase failure, refuses runtime drift and preserves stale output", async t => {
	const script = resolve("scripts/run-nominal-primitive-subtype-browser-ci.sh");
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-browser-ci-shell-"));
	t.after(() => rm(root, { recursive: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	for(const command of ["mkdir", "tee", "cmp"]) await symlink(`/usr/bin/${command}`, join(bin, command));
	const fakeNode = `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2), route = process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_ROUTES, mode = process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_MODES;
assert.ok(${JSON.stringify(nominalPrimitiveSubtypeBrowserSelections)}.some(pair => pair[0] === route && pair[1] === mode));
const label = route + '/' + mode, output = 'build/nominal-primitive-subtype-browser-ci/' + route + '-' + mode;
const previous = fs.existsSync('calls.log') ? fs.readFileSync('calls.log', 'utf8').split('\\n').filter(line => line.startsWith(label + '/')) : [];
const kind = args[0] === '-p' ? (previous.length === 0 ? 'runtime-before' : 'runtime-after') : args.includes('--test') ? 'producer' : 'checker';
const phase = label + '/' + kind;
fs.appendFileSync('calls.log', phase + '\\n');
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST, '1');
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_BROWSER_TEST, '1');
assert.equal(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, 'chromium,firefox,webkit');
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_OUTPUT, output + '/records');
assert.equal(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT, ${JSON.stringify(runtime)});
for (const key of ['LEAN_NUM_THREADS', 'OMP_NUM_THREADS', 'EMCC_CORES', 'CMAKE_BUILD_PARALLEL_LEVEL']) assert.equal(process.env[key], '1');
assert.equal(process.env.MAKEFLAGS, '-j1');
if (kind.startsWith('runtime-')) {
  assert.deepEqual(args, ['-p', 'JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})']);
  process.stdout.write(JSON.stringify({node: kind === 'runtime-after' && process.env.FAKE_RUNTIME_DRIFT === '1' ? 'v0.0.0' : process.version, platform:process.platform, arch:process.arch}) + '\\n');
} else {
  if (kind === 'producer') {
    assert.deepEqual(args, ['--test', '--test-concurrency=1', '--test-reporter=tap', '--test-name-pattern=^installed npm primitive-base nominal Subtypes reproduce and relocate ' + route + ' ' + mode + '$', 'tests/helpers/nominal-primitive-subtype-npm-installed-tests.mjs']);
    fs.mkdirSync(output + '/records'); fs.writeFileSync(output + '/records/partial.json', 'original ' + label);
  } else {
    assert.deepEqual(args, ['scripts/check-nominal-primitive-subtype-browser-ci.mjs', '--route', route, '--mode', mode, '--producer', 'a'.repeat(40), '--directory', output + '/records/' + label, '--tap', output + '/run.tap', '--runtime', output + '/runtime-before.json']);
  }
  process.stdout.write(phase + ' stdout\\n'); process.stderr.write(phase + ' stderr\\n');
}
if (process.env.FAKE_FAIL === phase) process.exit(17);
`;
	await writeFile(join(bin, "node"), fakeNode); await chmod(join(bin, "node"), 0o755);
	await writeFile(join(bin, "git"), `#!/bin/bash
if [[ "$*" != 'rev-parse HEAD' ]]; then exit 99; fi
if [[ "$FAKE_HEAD_DRIFT" == '1' && -f calls.log ]]; then
  printf '%s\\n' '${"b".repeat(40)}'
else
  printf '%s\\n' '${"a".repeat(40)}'
fi
`);
	await chmod(join(bin, "git"), 0o755);
	const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_")));
	const env = { ...inherited, PATH: bin, FAKE_RUNTIME_DRIFT: "0"
		, FAKE_HEAD_DRIFT: "0"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST: "0"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_BROWSER_TEST: "0"
		, LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: "chromium"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_ROUTES: "invented"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_MODES: "invented"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_OUTPUT: "/wrong"
		, LEAN_NUM_THREADS: "99", OMP_NUM_THREADS: "99", MAKEFLAGS: "-j99" };
	const order = nominalPrimitiveSubtypeBrowserSelections.flatMap(pair => ["runtime-before", "producer", "runtime-after", "checker"].map(phase => pair.join("/") + "/" + phase));
	for(const [index, failure] of ["none", ...order].entries())
	{
		const directory = join(root, String(index)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, runtime], { cwd: directory, env: { ...env, FAKE_FAIL: failure }, encoding: "utf8" });
		assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, failure === "none" ? 0 : 17, result.stderr);
		const expected = failure === "none" ? order : order.slice(0, order.indexOf(failure) + 1);
		const calls = await readFile(join(directory, "calls.log"), "utf8"); assert.equal(calls, expected.join("\n") + "\n");
		for(const phase of expected)
		{
			const [route, mode, kind] = phase.split("/"), output = join(directory, "build/nominal-primitive-subtype-browser-ci", route + "-" + mode);
			if(kind.startsWith("runtime-"))
				assert.deepEqual(JSON.parse(await readFile(join(output, kind + ".json"))), { node: process.version, platform: process.platform, arch: process.arch });
			else
			{
				const log = await readFile(join(output, kind === "producer" ? "run.tap" : "verification.json"), "utf8");
				assert.ok(log.includes(phase + " stdout\n") && log.includes(phase + " stderr\n"));
				assert.equal(await readFile(join(output, "records/partial.json"), "utf8"), "original " + route + "/" + mode);
			}
		}
		const again = spawnSync("/bin/bash", [script, runtime], { cwd: directory, env, encoding: "utf8" });
		assert.notEqual(again.status, 0); assert.equal(await readFile(join(directory, "calls.log"), "utf8"), calls);
	}
	const drift = join(root, "runtime-drift"); await mkdir(drift);
	const refused = spawnSync("/bin/bash", [script, runtime], { cwd: drift, env: { ...env, FAKE_FAIL: "none", FAKE_RUNTIME_DRIFT: "1" }, encoding: "utf8" });
	assert.equal(refused.status, 1); assert.equal(await readFile(join(drift, "calls.log"), "utf8"), order.slice(0, 3).join("\n") + "\n");
	const headDrift = join(root, "head-drift"); await mkdir(headDrift);
	const changed = spawnSync("/bin/bash", [script, runtime], { cwd: headDrift, env: { ...env, FAKE_FAIL: "none", FAKE_HEAD_DRIFT: "1" }, encoding: "utf8" });
	assert.equal(changed.status, 1); assert.equal(await readFile(join(headDrift, "calls.log"), "utf8"), order.slice(0, 3).join("\n") + "\n");
	const invalid = join(root, "invalid"); await mkdir(invalid);
	const result = spawnSync("/bin/bash", [script, "ordinary"], { cwd: invalid, env, encoding: "utf8" });
	assert.equal(result.status, 2); assert.deepEqual(await readdir(invalid), []);
	for(const [index, args] of [[], [""], ["relative"], [runtime, "extra"]].entries())
	{
		const directory = join(root, "invalid-" + index); await mkdir(directory);
		const rejected = spawnSync("/bin/bash", [script, ...args], { cwd: directory, env, encoding: "utf8" });
		assert.equal(rejected.status, 2); assert.deepEqual(await readdir(directory), []);
	}
	for(const [index, value] of ["", "override"].entries())
	{
		const directory = join(root, "override-" + index); await mkdir(directory);
		const rejected = spawnSync("/bin/bash", [script, runtime], { cwd: directory, env: { ...env, LEAN_BRIDGE_LAKE_RUNTIME_ROOT: value }, encoding: "utf8" });
		assert.equal(rejected.status, 2); assert.deepEqual(await readdir(directory), []);
	}
	t.diagnostic("Seventeen real-shell stand-in scenarios cover all four selections and every runtime/producer/checker failure. Runtime and HEAD drift, stale output and extra arguments are also refused. No compiler or browser execution claim follows from these stand-ins.");
});
