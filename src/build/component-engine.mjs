import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { analyzeLeanProject } from "../analyze/lean-project.mjs";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateComponentBuildPlan } from "./component-plan.mjs";
import { generateCompilerAdapters } from "./compiler-adapters.mjs";
import { prepareComponentCompilationPlan, validateComponentCompilationPlan } from "./component-compilation-plan.mjs";
import { readVerifiedEngineExecutionRequest, identifyComponentInputClosure } from "./engine-execution-request.mjs";
import { compileLeanComponentSources } from "./lean-component-compiler.mjs";
import { linkComponentSideModule } from "./component-side-linker.mjs";
import { auditComponentSideModule } from "./side-module-audit.mjs";
import { writeComponentArtifactManifest } from "./component-artifact-manifest.mjs";
import { buildComponentReleaseBundle } from "../release/component-release-bundle.mjs";

/**
 * Reports component engine failures with stable machine-readable codes and structured diagnostic context.
 */
export class ComponentEngineError extends Error
{
	/**
   * Initializes the error used to report component engine failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "ComponentEngineError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new ComponentEngineError(code, message, details);
};

const parseJson = async (path, label) => {
	try
	{
		return JSON.parse(await readFile(path, "utf8"));
	} catch(error)
	{
		fail("component-engine-invalid-input", `${label} is missing or invalid`, { path, cause: error.message });
	}
};

const assertAbsent = async output => {
	try
	{
		await stat(output);
		fail("component-engine-output-exists", `Component engine output already exists: ${output}`);
	} catch(error)
	{
		if(error instanceof ComponentEngineError) throw error;
		if(error.code !== "ENOENT") throw error;
	}
};

const listFiles = async root => {
	const files = [];
	const visit = async relative => {
		for(const entry of await readdir(join(root, relative), { withFileTypes: true }))
		{
			const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
			if(entry.isDirectory()) await visit(path);
			else if(entry.isFile()) files.push(path);
      else fail("component-engine-unauthorized-output", `Engine emitted a non-file output: ${path}`, { path });
		}
	};
	await visit("");
	return files.sort();
};

const verifyGeneratedInputs = async ({ inputs, analysis, componentPlan }) => {
	const generated = generateCompilerAdapters({ analysis, componentPlan });
	for(const [path, expected] of Object.entries(generated.files))
	{
		let actual;
		try
		{
			actual = await readFile(join(inputs, "generated", path), "utf8");
		} catch(error)
		{
			fail("component-engine-generated-input-missing", `Generated compiler input is missing: ${path}`, { path, cause: error.message });
		}
		if(actual !== expected) fail("component-engine-generated-input-drift", `Generated compiler input changed: ${path}`, { path });
	}
	return generated;
};

const readPlans = async inputs => {
	const componentDocument = await parseJson(join(inputs, "component-build-plan.json"), "Component build plan");
	const compilationDocument = await parseJson(join(inputs, "component-compilation-plan.json"), "Component compilation plan");
	validateComponentBuildPlan(componentDocument);
	validateComponentCompilationPlan(compilationDocument);
	return Object.freeze({
		componentPlan: Object.freeze({ document: Object.freeze(componentDocument), sha256: sha256(canonicalJson(componentDocument)) })
		, compilationPlan: Object.freeze({ document: Object.freeze(compilationDocument), sha256: sha256(canonicalJson(compilationDocument)) })
	});
};

/**
 * Runs component engine request and returns a structured result suitable for the isolated component build pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to execute component engine request.
 * @param root0.requestPath - Filesystem path to the request.
 * @param root0.inputRoot - Filesystem root containing the input.
 * @param root0.outputRoot - Filesystem root containing the output.
 * @param root0.engineRoot - Filesystem root containing the engine.
 * @param root0.backend - Backend identifier or implementation selected for generation, execution, or package projection.
 * @param root0.runner - Process runner used for isolated external commands.
 * @param root0.environment - Environment variables used to resolve tools and policy.
 */
export const executeComponentEngineRequest = async ({
	requestPath
	, inputRoot
	, outputRoot
	, engineRoot
	, backend = "direct-test"
	, runner = undefined
	, environment = process.env
} = {}) => {
	const inputs = resolve(inputRoot);
	const output = resolve(outputRoot);
	const engine = resolve(engineRoot);
	await assertAbsent(output);
	const verifiedRequest = await readVerifiedEngineExecutionRequest({ requestPath, engineRoot: engine, inputRoot: inputs });
	const { componentPlan, compilationPlan } = await readPlans(inputs);
	const requested = verifiedRequest.document;
	if(
		requested.component.id !== componentPlan.document.component.id
    || requested.component.componentPlanSha256 !== componentPlan.sha256
    || requested.component.compilationPlanSha256 !== compilationPlan.sha256
    || requested.component.sourceTreeSha256 !== componentPlan.document.source.treeSha256
	) fail("component-engine-request-plan-drift", "Execution request and mounted component plans identify different inputs");

	const sourceRoot = join(inputs, "source");
	const analysis = await analyzeLeanProject(sourceRoot, { targets: requested.targets });
	if(analysis.sourceTreeSha256 !== componentPlan.document.source.treeSha256 || analysis.bindingIr?.semanticSha256 !== componentPlan.document.bindingIr.semanticSha256) fail("component-engine-analysis-drift", "Mounted source no longer produces the requested source and Binding IR identities");
	const compilerAdapters = await verifyGeneratedInputs({ inputs, analysis, componentPlan });
	const preparedCompilationPlan = await prepareComponentCompilationPlan({ projectRoot: sourceRoot, analysis, componentPlan, compilerAdapters });
	if(preparedCompilationPlan.sha256 !== compilationPlan.sha256 || canonicalJson(preparedCompilationPlan.document) !== canonicalJson(compilationPlan.document)) fail("component-engine-compilation-plan-drift", "Mounted source no longer produces the requested compilation plan");

	await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-engine-output-"));
	try
	{
		const compilerOptions = { inputRoot: inputs, outputRoot: join(staging, "target-c"), engineRoot: engine, compilationPlan, environment };
		if(runner !== undefined) compilerOptions.runner = runner;
		const compiled = await compileLeanComponentSources(compilerOptions);
		const linkerOptions = { targetCRoot: join(staging, "target-c"), outputRoot: join(staging, "side-module"), engineRoot: engine, compilationPlan, environment };
		if(runner !== undefined) linkerOptions.runner = runner;
		const linked = await linkComponentSideModule(linkerOptions);
		const audited = await auditComponentSideModule({ sideRoot: join(staging, "side-module"), compilationPlan, reportPath: join(staging, "side-module/audit/component-side-module-audit.json") });
		const componentArtifact = await writeComponentArtifactManifest({ sideRoot: join(staging, "side-module"), analysis, componentPlan, compilerAdapters, compilationPlan, compiled, linked, audited });
		const bundle = await buildComponentReleaseBundle({
			projectRoot: sourceRoot
			, inputRoot: inputs
			, targetCRoot: join(staging, "target-c")
			, sideRoot: join(staging, "side-module")
			, outputRoot: join(staging, requested.output.bundleDirectory)
			, analysis
			, componentPlan
			, compilerAdapters
			, compilationPlan
			, compiled
			, linked
			, audited
			, componentArtifact
		});
		const actualFiles = await listFiles(join(staging, requested.output.bundleDirectory));
		if(JSON.stringify(actualFiles) !== JSON.stringify(requested.output.authorizedFiles)) fail("component-engine-unauthorized-output", "Component engine bundle differs from the authorized output contract", { expected: requested.output.authorizedFiles, actual: actualFiles });
		const inputAfter = await identifyComponentInputClosure(inputs);
		if(inputAfter.identitySha256 !== requested.component.inputClosureSha256) fail("component-engine-source-write", "Component input closure changed during engine execution");
		const report = Object.freeze({
			schemaVersion: 1
			, kind: "lean-bridge-engine-execution-report"
			, backend
			, requestSha256: verifiedRequest.sha256
			, engineIdentitySha256: requested.engine.identitySha256
			, component: requested.component.id
			, componentPlanSha256: componentPlan.sha256
			, compilationPlanSha256: compilationPlan.sha256
			, inputClosureSha256: inputAfter.identitySha256
			, bundleManifestSha256: bundle.manifestSha256
			, bundleIdentitySha256: bundle.manifest.identitySha256
			, sourceReadOnly: true
			, authorizedOutputsOnly: true
			, runtimeBinaryIncluded: false
		});
		await writeFile(join(staging, requested.output.executionReport), canonicalJson(report));
		await rm(join(staging, "target-c"), { recursive: true, force: true });
		await rm(join(staging, "side-module"), { recursive: true, force: true });
		await rename(staging, output);
		return Object.freeze({ output, request: verifiedRequest, report, bundle });
	} catch(error)
	{
		await rm(staging, { recursive: true, force: true });
		throw error;
	}
};
