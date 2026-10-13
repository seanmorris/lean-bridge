/**
 * Exercise the real PHP CI shell with stand-ins and every failure position.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/run-nominal-subtype-php-ci.sh");
const selections = ["ordinary-full", "reviewed-full", "ordinary-result-only", "reviewed-result-only"];

test("nominal PHP CI runs four serial selections and preserves preflight, producer and checker failures", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-php-ci-shell-"));
	t.after(() => rm(root, { recursive: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	const commands = [join(root, 'PHP "8.2"/php'), join(root, 'Composer "2.5"/composer')];
	for(const command of commands)
	{
		await mkdir(dirname(command), { recursive: true }); await writeFile(command, "stand-in, never invoked\n"); await chmod(command, 0o755);
	}
	for(const name of ["mkdir", "tee", "readlink"]) await symlink(`/usr/bin/${name}`, join(bin, name));
	await writeFile(join(bin, "git"), `#!/bin/bash\nif [[ "$*" != 'rev-parse HEAD' ]]; then exit 99; fi\nprintf '%s\\n' '${"a".repeat(40)}'\n`);
	await chmod(join(bin, "git"), 0o755);
	await writeFile(join(bin, "node"), `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2), producer = args.includes('--test');
assert.equal(process.env.LEAN_BRIDGE_PHP, ${JSON.stringify(commands[0])});
assert.equal(process.env.LEAN_BRIDGE_COMPOSER, ${JSON.stringify(commands[1])});
if (args[0] === 'scripts/select-nominal-subtype-php-ci-tools.mjs') {
  assert.deepEqual(args, ['scripts/select-nominal-subtype-php-ci-tools.mjs', ...${JSON.stringify(commands)}, 'build/nominal-subtype-php-ci']);
  fs.appendFileSync('calls.log', 'preflight\\n');
  process.stdout.write(JSON.stringify({selected: {phpVersion: '8.2.33', composerVersion: '2.5.5'}}) + '\\n');
  process.exit(process.env.FAKE_FAIL === 'preflight' ? 17 : 0);
}
if (args[0] === '--input-type=module') {
  assert.equal(args.length, 4); assert.equal(args[1], '-e'); assert.equal(args[3], 'build/nominal-subtype-php-ci/tools.json');
  const key = args[2].includes('selected.composerVersion') ? 'composerVersion' : 'phpVersion';
  process.stdout.write(JSON.parse(fs.readFileSync(args[3])).selected[key]); process.exit(0);
}
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION, '8.2.33');
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION, '2.5.5');
const route = process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_ROUTES;
const mode = process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_MODES;
assert.ok(['ordinary', 'reviewed'].includes(route)); assert.ok(['full', 'result-only'].includes(mode));
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_TEST, '1');
assert.equal(process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, '2.38');
assert.equal(process.env.LEAN_NUM_THREADS, '1'); assert.equal(process.env.OMP_NUM_THREADS, '1'); assert.equal(process.env.MAKEFLAGS, '-j1');
const selection = route + '-' + mode, output = 'build/nominal-subtype-php-ci/' + selection;
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_OUTPUT, output + '/records');
const call = selection + '/' + (producer ? 'producer' : 'checker'); fs.appendFileSync('calls.log', call + '\\n');
if (producer) {
  assert.deepEqual(args, ['--test', '--test-concurrency=1', '--test-reporter=tap',
    '--test-name-pattern=^installed nominal PHP packages reproduce and relocate ' + route + ' ' + mode + '$',
    'tests/helpers/nominal-subtype-php-installed-tests.mjs']);
  fs.mkdirSync(output + '/records'); fs.writeFileSync(output + '/records/partial.json', 'original ' + selection);
  process.stdout.write('original ' + selection + ' stdout\\n'); process.stderr.write('original ' + selection + ' stderr\\n');
} else {
  assert.deepEqual(args, ['scripts/check-nominal-subtype-php-ci.mjs', '--route', route, '--mode', mode,
    '--producer', 'a'.repeat(40), '--directory', output + '/records/' + route + '/' + mode,
    '--tap', output + '/run.tap', '--glibc', '2.38', '--php', process.env.LEAN_BRIDGE_PHP,
    '--composer', process.env.LEAN_BRIDGE_COMPOSER, '--php-version', '8.2.33', '--composer-version', '2.5.5']);
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
		assert.deepEqual(JSON.parse(await readFile(join(directory, "build/nominal-subtype-php-ci/tools.json"))), { selected: { phpVersion: "8.2.33", composerVersion: "2.5.5" } });
		for(const call of expected.filter(call => call !== "preflight"))
		{
			const [selection, kind] = call.split("/"), output = join(directory, "build/nominal-subtype-php-ci", selection);
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
	for(const value of ["", "2.36", "2.38"])
	{
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...commands], { cwd: directory, env: { ...base, PATH: bin, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: value }, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
	for(const args of [[], [commands[0]], [...commands, "extra"], ...commands.map((_, index) => commands.map((value, position) => index === position ? "relative" : value))])
	{
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...args], { cwd: directory, env: { ...base, PATH: bin }, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
	t.diagnostic("Ten complete/failing shell scenarios, ten stale-output refusals and eight argument/floor controls; stand-ins do not claim compiled acceptance");
});
