/**
 * Exercise the real dependent checked-record JVM CI shell with inert stand-in tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/run-dependent-checked-record-jvm-ci.sh");
const routes = [
	"ordinary-source", "reviewed-ir"
	, "result-only-ordinary-source", "result-only-reviewed-ir"
];

test("dependent checked-record JVM CI preserves every producer and checker failure"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-dependent-checked-record-jvm-ci-shell-"
		));
		t.after(() => rm(root, { recursive: true }));
		const bin = join(root, "bin");
		await mkdir(bin);
		for(const name of ["dirname", "mkdir", "readlink", "tee"])
			await symlink(`/usr/bin/${name}`, join(bin, name));
		await writeFile(join(bin, "git"), `#!/bin/bash
if [[ "$*" != 'rev-parse HEAD' ]]; then exit 99; fi
printf '%s\\n' '${"a".repeat(40)}'
`);
		await chmod(join(bin, "git"), 0o755);
		const jdkBin = join(root, "toolchains", "JDK 22.0.2", "bin");
		const kotlinBin = join(root, "toolchains", "Kotlin 2.2.0", "bin");
		await mkdir(jdkBin, { recursive: true });
		await mkdir(kotlinBin, { recursive: true });
		for(const path of [
			join(jdkBin, "java"), join(jdkBin, "javac"), join(jdkBin, "jar")
			, join(kotlinBin, "kotlinc")
		]) {
			await writeFile(path, "#!/bin/sh\nexit 0\n");
			await chmod(path, 0o755);
		}
		const java = join(jdkBin, "java"), javac = join(jdkBin, "javac");
		const kotlinc = join(kotlinBin, "kotlinc");
		await writeFile(join(bin, "node"), `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2), producer = args[0] === '--test';
const routes = ${JSON.stringify(routes)};
const route = process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_ROUTES;
assert.ok(routes.includes(route));
assert.equal(process.env.LEAN_BRIDGE_JAVA, ${JSON.stringify(java)});
assert.equal(process.env.LEAN_BRIDGE_JAVAC, ${JSON.stringify(javac)});
assert.equal(process.env.LEAN_BRIDGE_KOTLINC, ${JSON.stringify(kotlinc)});
assert.equal(process.env.LEAN_BRIDGE_KOTLIN_HOME, ${JSON.stringify(dirname(kotlinBin))});
assert.equal(process.env.LEAN_BRIDGE_JAR, ${JSON.stringify(join(jdkBin, "jar"))});
assert.equal(process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_TEST, '1');
assert.equal(process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_MAX_LOAD, '8');
assert.equal(process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, '2.38');
assert.equal(process.env.LEAN_NUM_THREADS, '1');
assert.equal(process.env.OMP_NUM_THREADS, '1');
assert.equal(process.env.MAKEFLAGS, '-j1');
assert.equal(process.env.CMAKE_BUILD_PARALLEL_LEVEL, '1');
for (const name of ['CLASSPATH', 'JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS',
  'JDK_JAVAC_OPTIONS', '_JAVA_OPTIONS', 'JAVA_OPTS', 'KOTLIN_OPTS',
  'KOTLIN_RUNNER']) assert.equal(process.env[name], undefined);
const output = 'build/dependent-checked-record-jvm-ci/' + route;
assert.equal(process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_OUTPUT, output + '/records');
const call = route + '/' + (producer ? 'producer' : 'checker');
fs.appendFileSync('calls.log', call + '\\n');
if (producer) {
  const name = 'installed dependent checked-record JVM packages reproduce and relocate for ' + route;
  assert.deepEqual(args, ['--test', '--test-concurrency=1', '--test-reporter=tap',
    '--test-name-pattern=^' + name + '$',
    'tests/helpers/dependent-checked-record-jvm-installed-tests.mjs']);
  fs.mkdirSync(output + '/records/' + route, { recursive: true });
  fs.writeFileSync(output + '/records/' + route + '/partial.json', 'original ' + route);
  process.stdout.write('original ' + route + ' stdout\\n');
  process.stderr.write('original ' + route + ' stderr\\n');
} else {
  assert.deepEqual(args, ['scripts/check-dependent-checked-record-jvm-ci.mjs',
    '--route', route, '--producer', 'a'.repeat(40), '--consumer', 'a'.repeat(40),
    '--directory', output + '/records/' + route, '--tap', output + '/run.tap',
    '--glibc', '2.38', '--java', process.env.LEAN_BRIDGE_JAVA,
    '--javac', process.env.LEAN_BRIDGE_JAVAC,
    '--kotlinc', process.env.LEAN_BRIDGE_KOTLINC]);
  process.stdout.write('checked ' + route + '\\n');
}
if (process.env.FAKE_FAIL === call) process.exit(17);
`);
		await chmod(join(bin, "node"), 0o755);
		const rejected = new Set([
			"LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_JAVA"
			, "LEAN_BRIDGE_JAVAC", "LEAN_BRIDGE_KOTLINC"
			, "LEAN_BRIDGE_KOTLIN_HOME", "LEAN_BRIDGE_JAR"
			, "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_TEST"
			, "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_ROUTES"
			, "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_OUTPUT"
			, "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_MAX_LOAD"
		]);
		const base = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("LEAN_BRIDGE_")
				&& !rejected.has(key)));
		for(const name of [
			"CLASSPATH", "JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS"
			, "JDK_JAVAC_OPTIONS", "_JAVA_OPTIONS", "JAVA_OPTS"
			, "KOTLIN_OPTS", "KOTLIN_RUNNER"
		]) base[name] = "ambient-refused-by-child";
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
				"/bin/bash", [script, java, javac, kotlinc, "8"]
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
					, "build/dependent-checked-record-jvm-ci", route);
				if(kind === "checker") assert.equal(await readFile(
					join(output, "verification.json"), "utf8"
				), `checked ${route}\n`);
				else
				{
					const tap = await readFile(join(output, "run.tap"), "utf8");
					assert.ok(tap.includes(`original ${route} stdout\n`)
						&& tap.includes(`original ${route} stderr\n`));
					assert.equal(await readFile(join(
						output, "records", route, "partial.json"
					), "utf8"), "original " + route);
				}
			}
			const again = spawnSync(
				"/bin/bash", [script, java, javac, kotlinc, "8"]
				, { cwd: directory, env, encoding: "utf8" }
			);
			assert.notEqual(again.status, 0);
			assert.equal(await readFile(join(directory, "calls.log"), "utf8")
				, calls);
		}
		for(const name of rejected) for(const value of ["", "override"])
		{
			const directory = join(root, String(sequence++));
			await mkdir(directory);
			const result = spawnSync(
				"/bin/bash", [script, java, javac, kotlinc, "8"], {
					cwd: directory, env: { ...base, PATH: bin, [name]: value }
					, encoding: "utf8"
				}
			);
			assert.equal(result.status, 2);
			assert.deepEqual(await readdir(directory), []);
		}
		for(const args of [
			[], ["relative", javac, kotlinc], [java, "relative", kotlinc]
			, [java, javac, "relative"], [java, javac, kotlinc, "7"]
			, [java, javac, kotlinc, "8", "extra"]
		]) {
			const directory = join(root, String(sequence++));
			await mkdir(directory);
			const result = spawnSync("/bin/bash", [script, ...args], {
				cwd: directory, env: { ...base, PATH: bin }, encoding: "utf8"
			});
			assert.equal(result.status, 2);
			assert.deepEqual(await readdir(directory), []);
		}
		t.diagnostic(`Nine complete/failing scenarios, nine stale-output refusals and ${rejected.size * 2 + 6} invalid argument/override controls; no compiled acceptance claimed by stand-ins.`);
	}
);
