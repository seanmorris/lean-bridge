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
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinDiagnosticCiSource } from "./native-fin-diagnostic-ci-history.mjs";
import { beforeFinNixBoundarySource, finNixBoundaryChangedPaths, finNixBoundaryHistoryPath, finNixBoundaryPredecessor, reverseFinNixBoundaryUpdate } from "./native-fin-nix-boundary-history.mjs";

test("the exact Nix Perl source boundary imports its engine and detects a missing Fin diagnostic module", async t => {
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
	await rm(join(root, "src/backends/c/fin-diagnostic.mjs"));
	const missing = run();
	assert.equal(missing.status, 1);
	assert.match(missing.stderr, /ERR_MODULE_NOT_FOUND/u);
	assert.match(missing.stderr, /src\/backends\/c\/fin-diagnostic\.mjs/u);
});

test("Nix Fin boundary history authenticates both source identities and preserves the earlier ledger", async () => {
	const history = JSON.parse(await readFile(finNixBoundaryHistoryPath, "utf8"));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "native-fin-nix-boundary-v1");
	assert.equal(history.predecessorCommit, finNixBoundaryPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), finNixBoundaryChangedPaths);
	for(const update of history.updates)
	{
		const current = beforeFinDiagnosticCiSource(update.path, await readFile(update.path, "utf8")), previous = reverseFinNixBoundaryUpdate(current, update);
		assert.equal(beforeFinNixBoundarySource(update.path, current), previous);
		assert.equal(beforeFinNixBoundarySource(update.path, previous), previous);
		assert.equal(beforeFinNixBoundarySource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unrelated edit\n";
		assert.equal(beforeFinNixBoundarySource(update.path, changed), changed);
		assert.throws(() => reverseFinNixBoundaryUpdate(changed, update));
		assert.throws(() => reverseFinNixBoundaryUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseFinNixBoundaryUpdate(current, { ...update, path: "unknown" }));
		assert.throws(() => reverseFinNixBoundaryUpdate(current, { ...update, edits: [] }));
		assert.throws(() => reverseFinNixBoundaryUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
		assert.throws(() => reverseFinNixBoundaryUpdate(current, { ...update, edits: [{ ...update.edits[0], current: "wrong" }, ...update.edits.slice(1)] }));
	}
	assert.equal(sha256(await readFile("docs/evidence/native-fin-diagnostic-source-history-20261010.json")), "2bc3b1217601bb0eb0c19b9f1496d00ab5df831e3a1bd1881a4429b28fd210ab");
});

test("Nix Fin boundary refreshes exactly eighteen source pins without changing support or observations", async () => {
	const path = "docs/type-surface.v1.json", source = beforeFinDiagnosticCiSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeFinNixBoundarySource(path, source));
	const boundaryPath = "nix/perl-engine-source-boundary.json", boundary = await readFile(boundaryPath, "utf8");
	const previousDigest = sha256(beforeFinNixBoundarySource(boundaryPath, boundary)), currentDigest = sha256(boundary);
	const expected = structuredClone(previous); let count = 0;
	for(const entry of expected.evidence) for(const file of entry.files) if(file.path === boundaryPath)
	{
		assert.equal(file.sha256, previousDigest); file.sha256 = currentDigest; count++;
	}
	assert.equal(count, 18);
	assert.deepEqual(current, expected);
	assert.deepEqual(current.observations, previous.observations);
});
