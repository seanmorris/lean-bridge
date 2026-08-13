import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { prepareComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";
import {
	createEngineExecutionRequest,
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

const collectModuleClosure = async entry => {
	const files = new Set();
	const visit = async path => {
		if(files.has(path)) return;
		files.add(path);
		const source = await readFile(path, "utf8");
		const patterns = [
			/(?:^|\n)\s*import\s+(?:[^'"\n]*?\s+from\s+)?["'](\.\.?\/[^"']+)["']/g
			, /(?:^|\n)\s*export\s+[^'"\n]*?\s+from\s+["'](\.\.?\/[^"']+)["']/g
			, /import\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g
		];
		for(const pattern of patterns)
		{
			for(const match of source.matchAll(pattern))
			{
				const imported = normalize(join(dirname(path), extname(match[1]) === "" ? `${match[1]}.mjs` : match[1]));
				await visit(imported);
			}
		}
	};
	await visit(entry);
	return [...files].sort();
};

test("the Nix component engine source boundary closes the executable module graph", async () => {
  const boundary = JSON.parse(await readFile("nix/component-engine-source-boundary.json", "utf8"));
  const dataFiles = ["poc/lean-link-spike/graph-lock.json"];
  const executableFiles = boundary.includedFiles.filter(path => !dataFiles.includes(path)).sort();
  assert.deepEqual(await collectModuleClosure("scripts/run-component-engine.mjs"), executableFiles);
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
    await writeFile(join(prepared.inputRoot, "source/OnboardingSmall.lean"), "def changed := true\n");
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
