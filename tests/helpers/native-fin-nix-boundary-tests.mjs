/**
 * Exercise the Perl engine's filtered source tree before invoking a package build.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

test("the exact Nix Perl source boundary imports its engine and detects missing refinement modules", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-boundary-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const boundary = JSON.parse(await readFile("nix/perl-engine-source-boundary.json", "utf8"));
	const flake = await readFile("flake.nix", "utf8");
	assert.match(flake, /else builtins\.elem relative perlEngineSourceBoundary\.includedFiles/u);
	for(const path of boundary.includedFiles)
	{
		await mkdir(dirname(join(root, path)), { recursive: true });
		await copyFile(path, join(root, path));
	}
	const args = ["--input-type=module", "-e", 'import { buildNativeProject } from "./src/build/native-project.mjs"; if (typeof buildNativeProject !== "function") throw Error("missing engine"); console.log("engine-import-ok");'];
	const run = () => spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: 30_000, env: { PATH: process.env.PATH } });
	const complete = run();
	assert.equal(complete.status, 0, complete.stderr);
	assert.equal(complete.stdout, "engine-import-ok\n");
	const entrypoint = spawnSync(process.execPath, ["scripts/run-perl-engine.mjs"], { cwd: root, encoding: "utf8", timeout: 30_000, env: { PATH: process.env.PATH } });
	assert.equal(entrypoint.status, 1);
	assert.match(entrypoint.stderr, /project and output are required/u);
	assert.doesNotMatch(entrypoint.stderr, /ERR_MODULE_NOT_FOUND/u);
	for(const path of ["src/build/refinement-mirrors.mjs", "src/build/component-refinement-mirrors.mjs", "src/build/component-fin-guards.mjs"])
	{
		assert.ok(boundary.includedFiles.includes(path));
		await rm(join(root, path));
		const missing = run();
		assert.equal(missing.status, 1);
		assert.match(missing.stderr, /ERR_MODULE_NOT_FOUND/u);
		assert.ok(missing.stderr.includes(path));
		await copyFile(path, join(root, path));
		assert.equal(run().status, 0);
	}
	await rm(join(root, "src/backends/c/fin-diagnostic.mjs"));
	const missing = run();
	assert.equal(missing.status, 1);
	assert.match(missing.stderr, /ERR_MODULE_NOT_FOUND/u);
	assert.match(missing.stderr, /src\/backends\/c\/fin-diagnostic\.mjs/u);
});
