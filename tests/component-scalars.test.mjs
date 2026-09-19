/**
 * Executes every ordinary primitive through installed, compiled Lean packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";

const execute = promisify(execFile);

test("installed scalar adapters preserve precision, IEEE values, Unicode, and copied bytes", async () => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-scalars-"));
	try
	{
		await execute(process.execPath, ["scripts/build-plain-component-side-module.mjs", "--project", "tests/fixtures/onboarding/scalars", "--output", join(scratch, "build")]);
		const bundleRoot = join(scratch, "build/bundle");
		const first = await buildComponentNpmPackages({ bundleRoot, runtimeRoot: "build/lean-link-spike/lazy", outputRoot: join(scratch, "packages") });
		const otherProject = join(scratch, "other-project");
		await cp("tests/fixtures/onboarding/scalars", otherProject, { recursive: true });
		const otherLakefile = join(otherProject, "lakefile.toml");
		await writeFile(otherLakefile, (await readFile(otherLakefile, "utf8")).replace('name = "onboarding-scalars"', 'name = "onboarding-scalars-other"'));
		const otherSource = join(otherProject, "OnboardingScalars.lean");
		await writeFile(otherSource, (await readFile(otherSource, "utf8")).replace("left + right", "left + right + 1").replace("Nat := 42", "Nat := 43"));
		await execute(process.execPath, ["scripts/build-plain-component-side-module.mjs", "--project", otherProject, "--output", join(scratch, "other-build")]);
		const other = await buildComponentNpmPackages({ bundleRoot: join(scratch, "other-build/bundle"), runtimeRoot: "build/lean-link-spike/lazy", outputRoot: join(scratch, "other-packages") });
		assert.equal(other.report.runtime.package, first.report.runtime.package);
		await execute("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", first.runtimeArchive, first.componentArchive, other.componentArchive], { cwd: scratch });
		await execute(process.execPath, ["--input-type=module", "-e"
		, `
import assert from "node:assert/strict";
const [first, second] = await Promise.all([import("onboarding-scalars"), import("onboarding-scalars-other")]);
assert.equal(first.add(20n, 22n), 42n);
assert.equal(second.add(20n, 22n), 43n);
assert.equal(first.answer(), 42n);
assert.equal(second.answer(), 43n);
assert.equal(first.add(1n << 100n, 7n), (1n << 100n) + 7n);
`], { cwd: scratch });
		await execute(process.execPath, ["--input-type=module", "-e"
		, `
import assert from "node:assert/strict";
import * as api from "onboarding-scalars";
assert.equal(api.answer(), 42n);
assert.equal(api.unit(undefined), undefined);
for(const value of [false, true]) assert.equal(api.boolean(value), value);
for(const value of [0n, (1n << 31n) - 1n, 1n << 31n, 1n << 64n, (1n << 4096n) + 123n]) assert.equal(api.add(value, 7n), value + 7n);
for(const value of [0n, -1n, 1n << 63n, -(1n << 4096n)]) {
  assert.equal(api.integer(value), value); assert.equal(api.negate(value), -value);
}
for(const bits of [8, 16, 32, 64]) {
  const host = value => bits === 64 ? value : Number(value);
  const max = (1n << BigInt(bits)) - 1n;
  const min = -(1n << BigInt(bits - 1));
  assert.equal(api["u" + bits](host(max)), host(max));
  assert.equal(api["i" + bits](host(min)), host(min));
  assert.throws(() => api["u" + bits](host(max + 1n)), TypeError);
  assert.throws(() => api["i" + bits](host(min - 1n)), TypeError);
}
assert.equal(api.usize(0xffffffff), 0xffffffff);
assert.equal(api.isize(-0x80000000), -0x80000000);
assert.throws(() => api.usize(0x100000000), TypeError);
assert.throws(() => api.isize(0x80000000), TypeError);
for(const name of ["f32", "f64"]) for(const value of [1.25, -0, Infinity, -Infinity, NaN]) assert.ok(Object.is(api[name](value), value));
for(const value of ["", "🌱\\0end", "λ中文é", "\\uFEFF", "\\uFEFF\\0🌱\\uFEFF"]) assert.equal(api.text(value), value);
assert.throws(() => api.text("\\ud800"), /surrogate/);
for(const value of ["a", "\\0", "🌱", "\\u{10ffff}"]) assert.equal(api.character(value), value);
for(const value of ["", "ab", "e\\u0301", "\\ud800", "\\udfff", 65]) assert.throws(() => api.character(value), TypeError);
const input = new Uint8Array([0, 128, 255]);
const output = api.bytes(input); assert.deepEqual(output, input); assert.notEqual(output, input);
input[0] = 9; assert.equal(output[0], 0);
assert.equal(api.mixed(true, 2, "abc", 40n), 45n);
for(let index = 0; index < 3000; index++) { assert.equal(api.text("loop\\0λ"), "loop\\0λ"); assert.equal(api.add(1n << 100n, 1n), (1n << 100n) + 1n); }
`], { cwd: scratch });
		const runtimeRoot = join(scratch, "changed-runtime");
		await cp(resolve("build/lean-link-spike/lazy"), runtimeRoot, { recursive: true });
		await writeFile(join(runtimeRoot, "main.mjs"), `${await readFile(join(runtimeRoot, "main.mjs"), "utf8")}\n// Changed prepared runtime wrapper.\n`);
		const changed = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(scratch, "changed-packages") });
		assert.notEqual(first.report.runtime.package, changed.report.runtime.package);
		assert.notEqual(first.report.runtime.sha256, changed.report.runtime.sha256);
		const metadata = JSON.parse(await readFile(join(first.output, "runtime/package/runtime-identity.json"), "utf8"));
		assert.ok(metadata.files.some(item => item.path === "notices/lean.txt"));
		assert.equal(metadata.metadata.name, "@lean-bridge/runtime");
	} finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
});
