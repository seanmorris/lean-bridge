/**
 * Import the standalone CLI's actual build modules after an offline installation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { collectModuleClosure } from "./module-closure.mjs";

const execute = promisify(execFile);
const entry = "src/build/canonical-build.mjs";
const imports = "await import('./src/build/compiler-adapters.mjs'); const api = await import('./src/build/canonical-build.mjs'); if (typeof api.buildCanonicalProject !== 'function') throw new Error('Missing build API'); console.log('cli-imports-ok');";

test("standalone CLI allowlist covers the complete build module import closure", async () => {
	const config = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	const check = admitted => {
		for(const path of admitted.closure) assert.ok(admitted.files.includes(path), `Missing standalone CLI dependency: ${path}`);
	};
	const closure = await collectModuleClosure(entry); check({ files: config.files, closure });
	for(const path of closure) assert.throws(() => check({ files: config.files.filter(file => file !== path), closure }), { message: `Missing standalone CLI dependency: ${path}` });
});

test("standalone CLI imports its installed build modules and rejects each omitted refinement dependency", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-cli-import-check-"));
	t.after(() => rm(directory, { recursive: true }));
	const candidate = await buildCliNpmPackage({ outputRoot: join(directory, "candidate") });
	const consumer = join(directory, "consumer"); await mkdir(consumer);
	await writeFile(join(consumer, "package.json"), '{"private":true}\n');
	await writeFile(join(directory, "user.npmrc"), "");
	await writeFile(join(directory, "global.npmrc"), "");
	const environment = { PATH: process.env.PATH
		, NPM_CONFIG_CACHE: join(directory, "cache")
		, NPM_CONFIG_USERCONFIG: join(directory, "user.npmrc")
		, NPM_CONFIG_GLOBALCONFIG: join(directory, "global.npmrc") };
	await execute("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", candidate.archive], { cwd: consumer, env: environment });
	const installed = join(consumer, "node_modules", candidate.report.package.name);
	await rm(candidate.output, { recursive: true });
	const check = () => execute(process.execPath, ["--input-type=module", "-e", imports], { cwd: installed, env: { PATH: "/unavailable" } });
	assert.deepEqual(await check(), { stdout: "cli-imports-ok\n", stderr: "" });
	for(const name of ["component-fin-guards", "component-refinement-mirrors", "refinement-mirrors"])
	{
		const path = join(installed, "src/build", name + ".mjs"); await rename(path, path + ".omitted");
		try
		{
			await assert.rejects(check(), error => error.code === 1 && error.stderr.includes("ERR_MODULE_NOT_FOUND") && error.stderr.includes(name + ".mjs"));
		}
		finally
		{ await rename(path + ".omitted", path); }
	}
	assert.deepEqual(await check(), { stdout: "cli-imports-ok\n", stderr: "" });
});
