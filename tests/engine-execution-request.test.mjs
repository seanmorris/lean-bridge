/**
 * Tests the engine execution request behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { collectModuleClosure } from "./helpers/module-closure.mjs";
import "./helpers/component-engine-closure-history-tests.mjs";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { prepareComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";
import {
	createEngineExecutionRequest,
	engineIdentityFiles,
	identifyBuildEngine,
	EngineExecutionRequestError,
	readVerifiedEngineExecutionRequest,
	validateEngineExecutionRequest,
	writeEngineExecutionRequest,
} from "../src/build/engine-execution-request.mjs";

const prepare = async ({ projectRoot, scratch }) => {
	const analysis = await analyzeLeanProject(projectRoot);
	const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot: process.cwd(), targets: ["npm"] });
	const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
	const compilationPlan = await prepareComponentCompilationPlan({ projectRoot, analysis, componentPlan, compilerAdapters });
	const inputRoot = join(scratch, "component");
	await writeComponentCompilationInputs({ projectRoot, outputRoot: inputRoot, analysis, componentPlan, compilerAdapters });
	return { componentPlan, compilationPlan, inputRoot };
};

test("the Nix component engine source boundary closes the executable module graph", async () => {
  const boundary = JSON.parse(await readFile("nix/component-engine-source-boundary.json", "utf8"));
  const dataFiles = ["poc/lean-link-spike/graph-lock.json", "poc/lean-link-spike/component_scalar.h", "src/build/ResolveLakeWorkspace.lean", "src/analyze/NativeExports.lean"];
  assert.ok(boundary.includedFiles.includes("src/build/ResolveLakeWorkspace.lean"));
  assert.ok(boundary.includedFiles.includes("src/analyze/NativeExports.lean"));
  assert.match(await readFile("src/build/lean-component-compiler.mjs", "utf8"), /"src\/analyze\/NativeExports\.lean"/);
  assert.match(await readFile("src/build/lake-workspace.mjs", "utf8"), /new URL\("ResolveLakeWorkspace\.lean", import\.meta\.url\)/);
  const executableFiles = boundary.includedFiles.filter(path => !dataFiles.includes(path)).sort();
  assert.deepEqual(await collectModuleClosure("scripts/run-component-engine.mjs"), executableFiles);
});

test("the filtered Nix engine retains every input needed to authenticate a host request", async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-filtered-engine-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const boundary = JSON.parse(await readFile("nix/component-engine-source-boundary.json", "utf8"));
	const core = JSON.parse(await readFile("nix/core-source-boundary.json", "utf8"));
	assert.deepEqual(boundary.identityFiles, [...engineIdentityFiles]);
	for(const path of new Set([...boundary.includedFiles, ...boundary.identityFiles, ...core.includedFiles, ...core.includedDirectoryPrefixes]))
	{
		await mkdir(dirname(join(scratch, path)), { recursive: true });
		await cp(path, join(scratch, path), { recursive: true });
	}
	assert.deepEqual(await identifyBuildEngine(scratch), await identifyBuildEngine(process.cwd()));
	const source = await readFile("flake.nix", "utf8");
	const filter = source.slice(source.indexOf("componentEngineSource = builtins.path"), source.indexOf("portablePackages = rec"));
	assert.match(filter, /componentEngineSourceBoundary\.identityFiles/);
	assert.match(filter, /coreSourceBoundary\.includedFiles/);
	assert.match(filter, /coreSourceBoundary\.includedDirectoryPrefixes/);
	assert.match(filter, /includedDirectory \|\| parentDirectory \|\| parentFile/);
});

test("the filtered Nix engine imports its real module graph and refuses omitted refinement dependencies", async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-filtered-engine-imports-"));
	t.after(() => rm(scratch, { recursive: true }));
	const boundary = JSON.parse(await readFile("nix/component-engine-source-boundary.json", "utf8"));
	const core = JSON.parse(await readFile("nix/core-source-boundary.json", "utf8"));
	for(const path of new Set([...boundary.includedFiles, ...boundary.identityFiles, ...core.includedFiles, ...core.includedDirectoryPrefixes]))
	{
		await mkdir(dirname(join(scratch, path)), { recursive: true });
		await cp(path, join(scratch, path), { recursive: true });
	}
	const entries = ["src/build/component-engine.mjs", "src/build/lean-component-compiler.mjs", "src/build/engine-execution-request.mjs"];
	const run = () => spawnSync(process.execPath, ["--input-type=module", "-e"
		, "for (const path of process.argv.slice(1)) await import(path);"
		, ...entries.map(path => pathToFileURL(join(scratch, path)).href)]
	, { cwd: scratch, encoding: "utf8", env: { PATH: "/unavailable" }, timeout: 30_000 });
	const complete = run();
	assert.equal(complete.status, 0, complete.stderr); assert.equal(complete.stdout, ""); assert.equal(complete.stderr, "");
	const dependencies = ["src/abi/generic-specialization.mjs"
		, "src/build/component-fin-guards.mjs"
		, "src/build/component-refinement-mirrors.mjs"
		, "src/build/refinement-mirrors.mjs"];
	for(const path of dependencies)
	{
		const file = join(scratch, path), omitted = file + ".omitted";
		await rename(file, omitted);
		try
		{
			const missing = run(); assert.equal(missing.status, 1);
			assert.ok(missing.stderr.includes("ERR_MODULE_NOT_FOUND"));
			assert.ok(missing.stderr.includes(file), path);
		}
		finally
		{ await rename(omitted, file); }
	}
	assert.equal(run().status, 0);
});

test("one closed execution request names engine, component, source, output, cache, and targets", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-engine-request-"));
  try
{
    const prepared = await prepare({ projectRoot: "tests/fixtures/onboarding/small", scratch });
      const request = await createEngineExecutionRequest({
        engineRoot: process.cwd()
        , ...prepared
        , cachePolicy: "refresh"
      , targets: ["npm"]
      });
    assert.equal(validateEngineExecutionRequest(request.document), true);
    assert.equal(request.document.component.id, "onboarding-small@1.0.0");
    assert.equal(request.document.source.readOnly, true);
    assert.equal(request.document.cache.policy, "refresh");
    assert.deepEqual(request.document.targets, ["npm"]);
    assert.equal(request.document.policies.sameRequestBytes, true);
    assert.ok(request.document.output.authorizedFiles.includes("binding/binding-ir.json"));
    assert.ok(request.document.output.authorizedFiles.some(path => path.endsWith(".so.wasm")));
    assert.match(request.sha256, /^[0-9a-f]{64}$/);
    const engineFiles = new Set(request.engine.files.map(file => file.path));
    const boundary = JSON.parse(await readFile("nix/component-engine-source-boundary.json", "utf8"));
    for(const path of boundary.includedFiles) assert.ok(engineFiles.has(path), `engine identity omits ${path}`);
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("request bytes and identities survive checkout relocation", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-engine-request-root-"));
  try
{
    const relocated = join(scratch, "source");
    await cp("tests/fixtures/onboarding/small", relocated, { recursive: true });
    const first = await prepare({ projectRoot: "tests/fixtures/onboarding/small", scratch: join(scratch, "first") });
    const second = await prepare({ projectRoot: relocated, scratch: join(scratch, "second") });
    const firstRequest = await createEngineExecutionRequest({ engineRoot: process.cwd(), ...first, targets: ["npm"] });
    const secondRequest = await createEngineExecutionRequest({ engineRoot: process.cwd(), ...second, targets: ["npm"] });
    assert.equal(firstRequest.sha256, secondRequest.sha256);
    assert.deepEqual(firstRequest.document, secondRequest.document);
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("the engine rejects source drift before compilation", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-engine-request-drift-"));
  try
{
    const prepared = await prepare({ projectRoot: "tests/fixtures/onboarding/small", scratch });
    const requestPath = join(scratch, "request.json");
    await writeEngineExecutionRequest({ output: requestPath, engineRoot: process.cwd(), ...prepared, targets: ["npm"] });
    const sourcePath = join(prepared.inputRoot, "source/OnboardingSmall.lean");
    await chmod(sourcePath, 0o644);
    await writeFile(sourcePath, "def changed := true\n");
    await chmod(sourcePath, 0o444);
    await assert.rejects(
      readVerifiedEngineExecutionRequest({ requestPath, engineRoot: process.cwd(), inputRoot: prepared.inputRoot }),
      error => error instanceof EngineExecutionRequestError && error.code === "component-input-identity-drift",
    );
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("the execution request schema closes backend paths and policy", async () => {
  const schema = JSON.parse(await readFile("schema/engine-execution-request.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.engine.additionalProperties, false);
  assert.equal(schema.properties.component.additionalProperties, false);
  assert.equal(schema.properties.output.additionalProperties, false);
  assert.equal(schema.properties.policies.additionalProperties, false);
});
