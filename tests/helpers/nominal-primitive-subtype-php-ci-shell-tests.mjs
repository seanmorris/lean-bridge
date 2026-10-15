/**
 * Exercise the real native PHP CI shell with stand-in tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/run-nominal-primitive-subtype-php-ci.sh");
const selections = ["ordinary-full", "reviewed-full", "ordinary-result-only", "reviewed-result-only"];

test("primitive-base native PHP CI runs all selections and preserves producer or checker failures", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-php-ci-shell-"));
	t.after(() => rm(root, { recursive: true }));
	const bin = join(root, "bin"), tools = join(root, "Tool Chains"); await mkdir(bin); await mkdir(tools);
	const php = join(tools, "php"), composer = join(tools, "composer");
	await writeFile(php, "php"); await writeFile(composer, "composer"); await chmod(php, 0o755);
	for(const name of ["mkdir", "readlink", "tee"]) await symlink(`/usr/bin/${name}`, join(bin, name));
	await writeFile(join(bin, "git"), `#!/bin/bash
if [[ "$*" != 'rev-parse HEAD' ]]; then exit 99; fi
printf '%s\n' '${"a".repeat(40)}'
`); await chmod(join(bin, "git"), 0o755);
	await writeFile(join(bin, "node"), `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === 'scripts/select-nominal-subtype-php-ci-tools.mjs') {
  fs.appendFileSync('calls.log', 'tools\\n');
  if (process.env.FAKE_FAIL === 'tools') process.exit(17);
  process.stdout.write(JSON.stringify({selected:{php:${JSON.stringify(php)},composer:${JSON.stringify(composer)},phpVersion:'8.3.6',composerVersion:'2.7.1'}}));
  process.exit(0);
}
if (args[0] === '--input-type=module') {
  process.stdout.write(args[2].includes('phpVersion') ? '8.3.6' : '2.7.1');
  process.exit(0);
}
const producer = args.includes('--test'), route = process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_ROUTES;
const mode = process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_MODES, selection = route + '-' + mode;
const output = 'build/nominal-primitive-subtype-php-ci/' + selection;
for (const key of ['LEAN_NUM_THREADS','OMP_NUM_THREADS','CMAKE_BUILD_PARALLEL_LEVEL']) assert.equal(process.env[key], '1');
assert.equal(process.env.MAKEFLAGS, '-j1'); assert.equal(process.env.LEAN_BRIDGE_PHP, ${JSON.stringify(php)});
assert.equal(process.env.LEAN_BRIDGE_COMPOSER, ${JSON.stringify(composer)});
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION, '8.3.6');
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION, '2.7.1');
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_TEST, '1');
assert.equal(process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, '2.38');
assert.equal(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_OUTPUT, output + '/records');
const call = selection + '/' + (producer ? 'producer' : 'checker'); fs.appendFileSync('calls.log', call + '\\n');
if (producer) {
  assert.deepEqual(args, ['--test','--test-concurrency=1','--test-reporter=tap',
    '--test-name-pattern=^installed primitive-base nominal PHP packages reproduce and relocate ' + route + ' ' + mode + '$',
    'tests/helpers/nominal-primitive-subtype-php-installed-tests.mjs']);
  fs.mkdirSync(output + '/records/' + route + '/' + mode, {recursive:true});
  fs.writeFileSync(output + '/records/' + route + '/' + mode + '/partial.json', 'original ' + selection);
  process.stdout.write('original ' + selection + ' stdout\\n'); process.stderr.write('original ' + selection + ' stderr\\n');
} else {
  assert.deepEqual(args, ['scripts/check-nominal-primitive-subtype-php-ci.mjs','--route',route,'--mode',mode,
    '--producer','a'.repeat(40),'--directory',output + '/records/' + route + '/' + mode,
    '--tap',output + '/run.tap','--glibc','2.38','--php',${JSON.stringify(php)},'--composer',${JSON.stringify(composer)},
    '--php-version','8.3.6','--composer-version','2.7.1']);
  process.stdout.write('checked ' + selection + '\\n');
}
if (process.env.FAKE_FAIL === call) process.exit(17);
`); await chmod(join(bin, "node"), 0o755);
	const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_")));
	const order = ["tools", ...selections.flatMap(selection => [selection + "/producer", selection + "/checker"])];
	let sequence = 0;
	for(const failure of ["none", "tools", "reviewed-full/producer", "ordinary-result-only/checker"])
	{
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const env = { ...base, PATH: bin + ":/usr/bin", FAKE_FAIL: failure };
		const result = spawnSync("/bin/bash", [script, php, composer], { cwd: directory, env, encoding: "utf8" });
		assert.equal(result.status, failure === "none" ? 0 : 17, result.stderr);
		const expected = failure === "none" ? order : order.slice(0, order.indexOf(failure) + 1);
		assert.equal(await readFile(join(directory, "calls.log"), "utf8"), expected.join("\n") + "\n");
		const again = spawnSync("/bin/bash", [script, php, composer], { cwd: directory, env, encoding: "utf8" });
		assert.notEqual(again.status, 0);
	}
	for(const name of [
		"LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR"
		, "LEAN_BRIDGE_PHP", "LEAN_BRIDGE_COMPOSER"
		, "LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION"
		, "LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION"
		, ...["TEST", "ROUTES", "MODES", "OUTPUT", "MAX_LOAD"]
			.map(item => "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_" + item)
	]) {
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, php, composer], {
			cwd: directory
			, env: { ...base, PATH: bin + ":/usr/bin", [name]: "override" }
			, encoding: "utf8"
		});
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
	for(const args of [[], [php], ["relative", composer], [php, "relative"], [php, php], [php, composer, "extra"]])
	{
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...args], { cwd: directory
			, env: { ...base, PATH: bin + ":/usr/bin" }, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
	t.diagnostic("Four complete/failing shell scenarios plus stale-output, argument, and override controls; stand-ins claim no compiled acceptance.");
});
