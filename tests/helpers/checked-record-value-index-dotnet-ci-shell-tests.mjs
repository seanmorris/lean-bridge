/**
 * Exercise the real value-index .NET CI shell with inert stand-in tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/run-checked-record-value-index-dotnet-ci.sh");
const command = '/toolchains/C# "8.0.424"/dotnet';
const routes = [
	"ordinary-source", "reviewed-ir"
	, "result-only-ordinary-source", "result-only-reviewed-ir"
];

test("value-index C# CI preserves every producer and checker failure"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-dotnet-ci-shell-"
		));
		t.after(() => rm(root, { recursive: true }));
		const bin = join(root, "bin");
		await mkdir(bin);
		for(const name of ["mkdir", "tee"])
			await symlink(`/usr/bin/${name}`, join(bin, name));
		await writeFile(join(bin, "git"), `#!/bin/bash
if [[ "$*" != 'rev-parse HEAD' ]]; then exit 99; fi
printf '%s\\n' '${"a".repeat(40)}'
`);
		await chmod(join(bin, "git"), 0o755);
		await writeFile(join(bin, "node"), `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2), producer = args.includes('--test');
assert.equal(process.env.LEAN_BRIDGE_DOTNET, ${JSON.stringify(command)});
const route = process.env.LEAN_BRIDGE_VALUE_INDEX_DOTNET_ROUTES;
assert.ok(${JSON.stringify(routes)}.includes(route));
assert.equal(process.env.LEAN_BRIDGE_VALUE_INDEX_DOTNET_TEST, '1');
assert.equal(process.env.LEAN_BRIDGE_VALUE_INDEX_DOTNET_MAX_LOAD, '8');
assert.equal(process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, '2.38');
assert.equal(process.env.LEAN_NUM_THREADS, '1');
assert.equal(process.env.MSBUILDDISABLENODEREUSE, '1');
assert.equal(process.env.OMP_NUM_THREADS, '1');
assert.equal(process.env.MAKEFLAGS, '-j1');
const output = 'build/checked-record-value-index-dotnet-ci/' + route;
assert.equal(process.env.LEAN_BRIDGE_VALUE_INDEX_DOTNET_OUTPUT, output + '/records');
const call = route + '/' + (producer ? 'producer' : 'checker');
fs.appendFileSync('calls.log', call + '\\n');
if (producer) {
  assert.deepEqual(args, ['--test', '--test-concurrency=1', '--test-reporter=tap',
    '--test-name-pattern=^installed value-index records reproduce and relocate in .NET for ' + route + '$',
    'tests/helpers/checked-record-value-index-dotnet-installed-tests.mjs']);
  fs.mkdirSync(output + '/records');
  fs.writeFileSync(output + '/records/partial.json', 'original ' + route);
  process.stdout.write('original ' + route + ' stdout\\n');
  process.stderr.write('original ' + route + ' stderr\\n');
} else {
  assert.deepEqual(args, ['scripts/check-checked-record-value-index-dotnet-ci.mjs', '--route', route,
    '--producer', 'a'.repeat(40), '--consumer', 'a'.repeat(40),
    '--directory', output + '/records/' + route, '--tap', output + '/run.tap',
    '--glibc', '2.38', '--dotnet', process.env.LEAN_BRIDGE_DOTNET]);
  process.stdout.write('checked ' + route + '\\n');
}
if (process.env.FAKE_FAIL === call) process.exit(17);
`);
		await chmod(join(bin, "node"), 0o755);
		const base = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("LEAN_BRIDGE_")));
		const order = routes.flatMap(route => [
			route + "/producer", route + "/checker"
		]);
		let sequence = 0;
		for(const failure of ["none", ...order])
		{
			const directory = join(root, String(sequence++));
			await mkdir(directory);
			const env = { ...base, PATH: bin, FAKE_FAIL: failure };
			const result = spawnSync(
				"/bin/bash", [script, command, "8"]
				, { cwd: directory, env, encoding: "utf8" }
			);
			assert.equal(result.status, failure === "none" ? 0 : 17
				, `${result.stderr}\n${result.stdout}`);
			const expected = failure === "none" ? order
				: order.slice(0, order.indexOf(failure) + 1);
			const calls = await readFile(join(directory, "calls.log"), "utf8");
			assert.equal(calls, expected.join("\n") + "\n");
			for(const call of expected)
			{
				const [route, kind] = call.split("/");
				const output = join(directory
					, "build/checked-record-value-index-dotnet-ci", route);
				if(kind === "checker") assert.equal(await readFile(
					join(output, "verification.json"), "utf8"
				), `checked ${route}\n`);
				else
				{
					const tap = await readFile(join(output, "run.tap"), "utf8");
					assert.ok(tap.includes(`original ${route} stdout\n`)
						&& tap.includes(`original ${route} stderr\n`));
					assert.equal(await readFile(join(
						output, "records/partial.json"
					), "utf8"), "original " + route);
				}
			}
			const again = spawnSync(
				"/bin/bash", [script, command, "8"]
				, { cwd: directory, env, encoding: "utf8" }
			);
			assert.notEqual(again.status, 0);
			assert.equal(await readFile(join(directory, "calls.log"), "utf8")
				, calls);
		}
		const overrideNames = [
			"LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_DOTNET"
			, "LEAN_BRIDGE_VALUE_INDEX_DOTNET_TEST"
			, "LEAN_BRIDGE_VALUE_INDEX_DOTNET_ROUTES"
			, "LEAN_BRIDGE_VALUE_INDEX_DOTNET_OUTPUT"
			, "LEAN_BRIDGE_VALUE_INDEX_DOTNET_MAX_LOAD"
		];
		for(const name of overrideNames) for(const value of ["", "override"])
		{
			const directory = join(root, String(sequence++));
			await mkdir(directory);
			const result = spawnSync("/bin/bash", [script, command, "8"], {
				cwd: directory, env: { ...base, PATH: bin, [name]: value }
				, encoding: "utf8"
			});
			assert.equal(result.status, 2);
			assert.deepEqual(await readdir(directory), []);
		}
		for(const args of [
			[], ["relative"], [command, "7"], [command, "8", "extra"]
		]) {
			const directory = join(root, String(sequence++));
			await mkdir(directory);
			const result = spawnSync("/bin/bash", [script, ...args], {
				cwd: directory, env: { ...base, PATH: bin }, encoding: "utf8"
			});
			assert.equal(result.status, 2);
			assert.deepEqual(await readdir(directory), []);
		}
		t.diagnostic(`Nine complete/failing scenarios, nine stale-output refusals and ${overrideNames.length * 2 + 4} invalid argument/override controls; no compiled acceptance claimed by stand-ins.`);
	}
);
