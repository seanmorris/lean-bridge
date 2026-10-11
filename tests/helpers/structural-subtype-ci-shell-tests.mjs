/**
 * Execute the real shell with stand-in tools; these controls do not claim installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { structuralSubtypeCiTestName } from "./structural-subtype-ci-report.mjs";

const script = resolve("scripts/run-structural-subtype-ci.sh");
const cases = [
	["c-cpp", "", "tests/structural-subtype-installed.test.mjs"]
	, ["python311", "_PYTHON", "python"], ["python312", "_PYTHON", "python"]
	, ["rust", "_RUST", "rust"], ["ruby", "_RUBY", "ruby"]
	, ["dotnet", "_DOTNET", "dotnet"], ["jvm", "_JVM", "jvm"]
	, ["php-native", "_PHP", "php"], ["wit-wasi", "_WIT", "wit"]
	, ["perl", "_PERL", "perl"], ["php-wasm", "_PHP_WASM", "php-wasm"]
	, ["node-browser", "_NPM", "tests/structural-subtype-npm-installed.test.mjs"]
];

test("structural CI shell runs both routes in every lane and preserves failed output", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-ci-shell-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	for(const command of ["mkdir", "tee"]) await symlink(`/usr/bin/${command}`, join(bin, command));
	const fakeNode = `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2), producer = args.includes('--test');
const prefix = process.env.FAKE_PREFIX, route = process.env[prefix + '_ROUTES'];
assert.ok(['ordinary', 'reviewed'].includes(route));
const lane = process.env.FAKE_LANE, output = 'build/structural-subtype-ci/' + lane + '/' + route;
fs.appendFileSync('calls.log', route + '/' + (producer ? 'producer' : 'checker') + '\\n');
if (producer) {
  const expected = JSON.parse(process.env.FAKE_NAMES)[route];
  assert.deepEqual(args, ['--test', '--test-concurrency=1', '--test-reporter=tap', '--test-name-pattern=^' + expected + '$', process.env.FAKE_FILE]);
  assert.equal(process.env[prefix + '_OUTPUT'], output + '/records');
  if (lane === 'c-cpp') assert.equal(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PROFILES, 'c,cpp');
  else assert.equal(process.env[prefix + '_TEST'], '1');
  if (lane.startsWith('python')) assert.equal(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PYTHON_MINOR, lane === 'python311' ? '3.11' : '3.12');
  if (lane === 'node-browser') {
    assert.equal(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_BROWSER_TEST, '1');
    assert.equal(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, 'chromium,firefox,webkit');
  }
  fs.mkdirSync(output + '/records');
  fs.writeFileSync(output + '/records/partial.json', 'original ' + route);
  process.stdout.write('original ' + route + ' stdout\\n');
  process.stderr.write('original ' + route + ' stderr\\n');
} else {
  const extra = ['node-browser', 'php-wasm'].includes(lane) ? [] : ['--glibc', '2.38'];
  assert.deepEqual(args, ['scripts/check-structural-subtype-ci.mjs', '--lane', lane,
    '--route', route, '--producer', 'a'.repeat(40), '--directory', output + '/records/' + route,
    '--tap', output + '/run.tap', ...extra]);
}
if (process.env.FAKE_FAIL === route + '/' + (producer ? 'producer' : 'checker')) process.exit(17);
`;
	await writeFile(join(bin, "node"), fakeNode); await chmod(join(bin, "node"), 0o755);
	await writeFile(join(bin, "git"), `#!/bin/bash\nif [[ "$*" != 'rev-parse HEAD' ]]; then exit 99; fi\nprintf '%s\\n' '${"a".repeat(40)}'\n`);
	await chmod(join(bin, "git"), 0o755);
	const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_STRUCTURAL_SUBTYPE") && !["LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR"].includes(key)));
	let sequence = 0;
	for(const [lane, suffix, target] of cases)
		for(const failure of ["none", "ordinary/producer", "ordinary/checker", "reviewed/producer", "reviewed/checker"])
		{
			const directory = join(root, String(sequence++)); await mkdir(directory);
			const env = {
				...base, PATH: bin, FAKE_LANE: lane
				, FAKE_PREFIX: "LEAN_BRIDGE_STRUCTURAL_SUBTYPE" + suffix
				, FAKE_FILE: target.startsWith("tests/") ? target : `tests/helpers/structural-subtype-${target}-installed-tests.mjs`
				, FAKE_NAMES: JSON.stringify(Object.fromEntries(["ordinary", "reviewed"].map(route => [route, structuralSubtypeCiTestName(lane, route)])))
				, FAKE_FAIL: failure };
			const result = spawnSync("/bin/bash", [script, lane], { cwd: directory, env, encoding: "utf8" });
			assert.equal(result.status, failure === "none" ? 0 : 17, result.stderr);
			const order = ["ordinary/producer", "ordinary/checker", "reviewed/producer", "reviewed/checker"];
			const expected = failure === "none" ? order : order.slice(0, order.indexOf(failure) + 1);
			const calls = await readFile(join(directory, "calls.log"), "utf8"); assert.equal(calls, expected.join("\n") + "\n");
			for(const route of expected.filter(item => item.endsWith("/producer")).map(item => item.split("/")[0]))
			{
				const output = join(directory, "build/structural-subtype-ci", lane, route), tap = await readFile(join(output, "run.tap"), "utf8");
				assert.ok(tap.includes(`original ${route} stdout\n`) && tap.includes(`original ${route} stderr\n`));
				assert.equal(await readFile(join(output, "records/partial.json"), "utf8"), "original " + route);
			}
			const again = spawnSync("/bin/bash", [script, lane], { cwd: directory, env, encoding: "utf8" });
			assert.notEqual(again.status, 0); assert.equal(await readFile(join(directory, "calls.log"), "utf8"), calls);
		}
	for(const [args, override] of [
		[[], {}], [["unknown"], {}], [["../escape"], {}]
		, [["rust", "extra"], {}]
		, [["rust"], { LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36" }]
		, [["perl"], { LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "" }]
		, [["perl"], { LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PERLS: "{}" }]]) {
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...args], { cwd: directory, env: { ...base, PATH: bin, ...override }, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
		}
	t.diagnostic("60 real-shell stand-in scenarios across twelve lanes; failures stop before the next route and retain original output.");
});
