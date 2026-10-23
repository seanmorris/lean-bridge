/**
 * Authenticate the core source boundary import closure: the filtered
 * universal-core derivation must carry every module its script roots import,
 * so a module omitted from `nix/core-source-boundary.json` fails here before
 * any hosted Nix build resolves it.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { collectModuleClosure } from "./module-closure.mjs";

export const coreSourceBoundaryPath = "nix/core-source-boundary.json";
export const coreSourceBoundaryRepairedModule
	= "src/abi/owned-refinement-model.mjs";
export const coreSourceBoundaryRepairedRoot
	= "scripts/generate-lean-link-projection.mjs";
const projectionEntries = Object.freeze([
	"poc/lean-link-spike/private-abi.mjs"
	, "src/backends/javascript/projection.mjs"
]);

/**
 * Script roots the universal-core derivation executes directly.
 *
 * @param boundary - Parsed core source boundary.
 */
export const coreSourceBoundaryRoots = boundary => boundary.includedFiles
	.filter(path => path.startsWith("scripts/") && path.endsWith(".mjs"));

/**
 * Report, per root, every module its closure reaches that the boundary omits.
 *
 * @param boundary - Parsed core source boundary.
 * @param closures - Map from script root to its relative module closure.
 */
export const coreSourceBoundaryGaps = (boundary, closures) => {
	const included = new Set(boundary.includedFiles);
	const admitted = path => included.has(path)
		|| boundary.includedDirectoryPrefixes
			.some(prefix => path.startsWith(`${prefix}/`));
	return Object.fromEntries([...closures]
		.map(([root, closure]) => [root, closure.filter(path => !admitted(path))])
		.filter(([, gaps]) => gaps.length > 0));
};

const readBoundary = async () => JSON.parse(
	await readFile(coreSourceBoundaryPath, "utf8")
);
const collectClosures = async boundary => new Map(await Promise.all(
	coreSourceBoundaryRoots(boundary)
		.map(async root => [root, await collectModuleClosure(root)])
));

test("the Nix core source boundary closes every script root's module graph", async () => {
	const boundary = await readBoundary();
	assert.ok(boundary.includedFiles.includes(coreSourceBoundaryRepairedModule));
	const closures = await collectClosures(boundary);
	assert.ok(closures.get(coreSourceBoundaryRepairedRoot)
		.includes(coreSourceBoundaryRepairedModule));
	assert.deepEqual(coreSourceBoundaryGaps(boundary, closures), {});
});

test("the core boundary closure control names the omitted owned-refinement model", async () => {
	const boundary = await readBoundary();
	const closures = await collectClosures(boundary);
	const omitted = { ...boundary, includedFiles: boundary.includedFiles
		.filter(path => path !== coreSourceBoundaryRepairedModule) };
	assert.deepEqual(coreSourceBoundaryGaps(omitted, closures)
		, { [coreSourceBoundaryRepairedRoot]: [coreSourceBoundaryRepairedModule] });
});

test("the filtered core source imports its projection graph and refuses the omitted model", async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-core-boundary-closure-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const boundary = await readBoundary();
	for(const path of [...boundary.includedFiles, ...boundary.includedDirectoryPrefixes])
	{
		await mkdir(dirname(join(scratch, path)), { recursive: true });
		await cp(path, join(scratch, path), { recursive: true });
	}
	const run = () => spawnSync(process.execPath, ["--input-type=module", "-e"
		, "for (const path of process.argv.slice(1)) await import(path);"
		, ...projectionEntries.map(path => pathToFileURL(join(scratch, path)).href)]
	, { cwd: scratch, encoding: "utf8", env: { PATH: "/unavailable" }, timeout: 30_000 });
	const complete = run();
	assert.equal(complete.status, 0, complete.stderr);
	assert.equal(complete.stdout, ""); assert.equal(complete.stderr, "");
	const file = join(scratch, coreSourceBoundaryRepairedModule);
	await rename(file, `${file}.omitted`);
	try
	{
		const missing = run();
		assert.equal(missing.status, 1);
		assert.ok(missing.stderr.includes("ERR_MODULE_NOT_FOUND"));
		assert.ok(missing.stderr.includes(file));
	}
	finally
	{ await rename(`${file}.omitted`, file); }
	assert.equal(run().status, 0);
});
