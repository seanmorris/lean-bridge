/**
 * Independent caller controls and exact Python author selections, without installed claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypePythonConfiguration, structuralSubtypePythonCaller, structuralSubtypePythonCounts, parseStructuralSubtypePythonResult } from "./structural-subtype-python-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import "./structural-subtype-python-evidence-tests.mjs";

test("structural Python configurations retain independent ordinary and reviewed contracts", async () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const configured = structuralSubtypePythonConfiguration(route), previous = structuralSubtypeConfiguration(route, ["c"]);
		assert.deepEqual({ ...configured, targets: previous.targets }, previous);
		assert.deepEqual(configured.targets, { pypi: { name: "structuralsubtypes", version: "1.0.0" } });
	}
	assert.equal(await structuralSubtypePythonCaller("reviewed"), (await structuralSubtypePythonCaller("ordinary")).replaceAll(/arg([01])/gu, "value$1"));
	assert.throws(() => structuralSubtypePythonConfiguration("unknown"));
	await assert.rejects(structuralSubtypePythonCaller("unknown"));
	assert.deepEqual(parseStructuralSubtypePythonResult(JSON.stringify(structuralSubtypePythonCounts)), structuralSubtypePythonCounts);
	for(const key of Object.keys(structuralSubtypePythonCounts))
		assert.throws(() => parseStructuralSubtypePythonResult(JSON.stringify({ ...structuralSubtypePythonCounts, [key]: 0 })));
});

test("Python caller detects dropped checks, normalization, NUL loss and mutation of either input", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-python-controls-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of ["ordinary", "reviewed"])
	{
		await saveLakeFile(root, `${route}.py`, await structuralSubtypePythonCaller(route));
		const run = await runCopied(process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", [
			"-I", "-B"
			, resolve("tests/helpers/structural-subtype-python-model.py")
			, join(root, `${route}.py`)
			, route === "ordinary" ? "arg" : "value"], root);
		assert.equal(run.stderr, "");
		assert.deepEqual(JSON.parse(run.stdout), { ...structuralSubtypePythonCounts, callerMutationControls: 8 });
	}
});
