/**
 * Tests the Python wheel compatibility preflight contract.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { evaluatePythonWheelCompatibility } from "../src/release/python-wheel-preflight.mjs";

const wheel = "lean_bridge_alpha-0.0.0-py3-none-manylinux_2_38_x86_64.whl";
const tag = "py3-none-manylinux_2_38_x86_64";
const execute = promisify(execFile);

test("Python wheel preflight accepts the reviewed clean-room host profile", () => {
	const report = evaluatePythonWheelCompatibility({
		wheel
		, platform: "linux"
		, architecture: "x64"
		, glibcVersion: "2.39"
		, pythonVersion: "3.11.10"
		, pipTags: [tag]
	});
	assert.equal(report.compatible, true);
	assert.equal(report.wheel.minimumGlibcVersion, "2.38");
	assert.deepEqual(report.checks.map(check => check.id), [
		"platform", "architecture", "glibc", "python", "pip-wheel-tag"
	]);
});

test("Python wheel preflight reports every incompatible host property", () => {
	const report = evaluatePythonWheelCompatibility({
		wheel
		, platform: "linux"
		, architecture: "arm64"
		, glibcVersion: "2.36"
		, pythonVersion: "3.10.14"
		, pipTags: []
	});
	assert.equal(report.compatible, false);
	assert.deepEqual(
		report.checks.filter(check => !check.passed).map(check => check.id)
		, ["architecture", "glibc", "python", "pip-wheel-tag"]
	);
});

test("Python wheel preflight rejects filenames without a declared glibc floor", () => {
	assert.throws(
		() => evaluatePythonWheelCompatibility({
			wheel: "lean_bridge_alpha-0.0.0-py3-none-any.whl"
			, platform: "linux"
			, architecture: "x64"
			, glibcVersion: "2.39"
			, pythonVersion: "3.11.10"
			, pipTags: ["py3-none-any"]
		})
		, error => error.code === "unsupported-wheel-platform"
	);
});

test("packaged Python wheel preflight emits a machine-readable compatible report", async () => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-python-preflight-"));
	try
	{
		const wheelPath = join(scratch, wheel);
		const python = join(scratch, "python-clean-room");
		await Promise.all([
			writeFile(wheelPath, "fixture wheel\n")
			, writeFile(python, `#!/usr/bin/env bash
if [[ "\${1:-}" == "--version" ]]; then
  echo 'Python 3.11.10'
elif [[ "\${1:-}" == "-c" ]]; then
  echo '2.39'
else
  echo 'Compatible tags:'
  echo '  ${tag}'
fi
`)
		]);
		await chmod(python, 0o755);
		const result = await execute(process.execPath, [
			"src/release/python-wheel-preflight.mjs"
			, "--wheel", wheelPath
			, "--python", python
			, "--json"
		], { env: { ...process.env, PATH: `${scratch}:${process.env.PATH}` } });
		const report = JSON.parse(result.stdout);
		assert.equal(report.compatible, true);
		assert.deepEqual(report.host, {
			platform: "linux"
			, architecture: "x86_64"
			, glibcVersion: "2.39"
			, pythonVersion: "3.11.10"
		});
	} finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
});
