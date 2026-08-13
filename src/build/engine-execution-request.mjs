import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateComponentBuildPlan } from "./component-plan.mjs";
import { validateComponentCompilationPlan } from "./component-compilation-plan.mjs";

/**
 * Reports engine execution request failures with stable machine-readable codes and structured diagnostic context.
 */
export class EngineExecutionRequestError extends Error
{
	/**
   * Initializes the error used to report engine execution request failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "EngineExecutionRequestError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new EngineExecutionRequestError(code, message, details);
};

const exactKeys = (value, expected, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-engine-execution-request", `${label} must be an object`);
	const actual = Object.keys(value).sort();
	const wanted = [...expected].sort();
	if(JSON.stringify(actual) !== JSON.stringify(wanted)) fail("invalid-engine-execution-request", `${label} fields must be closed`, { actual, expected: wanted });
};

const hash = (value, label) => {
	if(typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail("invalid-engine-execution-request", `${label} must be a SHA-256 identity`);
};

const safePath = path => typeof path === "string" && path !== "" && !path.startsWith("/") && !path.includes("\\") && !path.split("/").includes("..");

export const engineIdentityFiles = Object.freeze([
	"flake.lock"
	, "flake.nix"
	, "nix/component-engine-source-boundary.json"
	, "nix/core-source-boundary.json"
	, "nix/wasm-toolchain.nix"
	, "scripts/build-lean-runtime.sh"
	, "scripts/env.sh"
	, "scripts/lean-runtime-config.sh"
].sort());

const fileRecord = async (root, path) => {
	let bytes;
	try
	{
		bytes = await readFile(join(root, path));
	} catch(error)
	{
		fail("engine-identity-input-missing", `Engine identity input is unavailable: ${path}`, { path, cause: error.message });
	}
	return Object.freeze({ path, bytes: bytes.length, sha256: sha256(bytes) });
};

const readBoundary = async (root, path) => {
	let boundary;
	try
	{
		boundary = JSON.parse(await readFile(join(root, path), "utf8"));
	} catch(error)
	{
		fail("engine-identity-boundary-invalid", `Engine source boundary is unavailable or invalid: ${path}`, { path, cause: error.message });
	}
	if(
		boundary?.schemaVersion !== 1
    || !Array.isArray(boundary.includedFiles)
    || (boundary.includedDirectoryPrefixes !== undefined && !Array.isArray(boundary.includedDirectoryPrefixes))
	) fail("engine-identity-boundary-invalid", `Engine source boundary has an unsupported shape: ${path}`, { path });
	return boundary;
};

const listBoundaryDirectory = async (root, prefix) => {
	const files = [];
	const visit = async relative => {
		for(const entry of await readdir(join(root, relative), { withFileTypes: true }))
		{
			const path = `${relative}/${entry.name}`;
			if(entry.isDirectory()) await visit(path);
			else if(entry.isFile()) files.push(path);
      else fail("engine-identity-input-unsupported-entry", `Engine identity boundary contains a non-file entry: ${path}`, { path });
		}
	};
	await visit(prefix);
	return files;
};

const resolveEngineIdentityFiles = async root => {
	const boundaryPaths = ["nix/component-engine-source-boundary.json", "nix/core-source-boundary.json"];
	const files = new Set(engineIdentityFiles);
	for(const path of boundaryPaths)
	{
		const boundary = await readBoundary(root, path);
		for(const file of boundary.includedFiles) files.add(file);
		for(const prefix of boundary.includedDirectoryPrefixes ?? [])
		{
			for(const file of await listBoundaryDirectory(root, prefix)) files.add(file);
		}
	}
	return [...files].sort();
};

/**
 * Hashes the pinned engine files and declared source boundaries into a closed build-engine identity.
 *
 * @param engineRoot - Component-engine checkout containing identity files and source-boundary manifests.
 */
export const identifyBuildEngine = async engineRoot => {
	const root = resolve(engineRoot);
	const paths = await resolveEngineIdentityFiles(root);
	const files = Object.freeze(await Promise.all(paths.map(path => fileRecord(root, path))));
	return Object.freeze({
		identitySha256: sha256(canonicalJson(files))
		, fileCount: files.length
		, files
	});
};

const listFiles = async root => {
	const files = [];
	const visit = async relative => {
		for(const entry of await readdir(join(root, relative), { withFileTypes: true }))
		{
			const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
			if(entry.isDirectory()) await visit(path);
			else if(entry.isFile()) files.push(path);
      else fail("component-input-unsupported-entry", `Component input closure contains a non-file entry: ${path}`, { path });
		}
	};
	await visit("");
	return files.sort();
};

/**
 * Recursively catalogs regular files under the component input root and hashes the canonical catalog.
 *
 * @param inputRoot - Closed component input directory, which must contain only directories and regular files.
 */
export const identifyComponentInputClosure = async inputRoot => {
	const root = resolve(inputRoot);
	const paths = await listFiles(root);
	const files = Object.freeze(await Promise.all(paths.map(path => fileRecord(root, path))));
	return Object.freeze({
		identitySha256: sha256(canonicalJson(files))
		, fileCount: files.length
		, files
	});
};

const authorizedBundleFiles = ({ componentPlan, compilationPlan }) => Object.freeze([
	"README.md"
	, compilationPlan.document.outputs.sideModule
	, "binding/binding-ir.json"
	, "binding/private-abi.json"
	, "component-release-bundle.json"
	, "generated/LeanBridgeGenerated.lean"
	, "locks/compiler-adapters.json"
	, "locks/component-build-plan.json"
	, "locks/component-compilation-plan.json"
	, "locks/lean-target-c-manifest.json"
	, "locks/side-module-link-manifest.json"
	, "metadata/assurance.json"
	, "metadata/component-artifact-manifest.json"
	, "metadata/provenance.json"
	, "metadata/runtime-requirement.json"
	, "metadata/side-module-audit.json"
	, ...componentPlan.document.source.inputs.map(input => `source/${input.path}`)
].sort());

/**
 * Validates engine execution request against its closed contract before it enters the isolated component build pipeline.
 *
 * @param request - Engine execution request checked for closed fields, authorized paths, and matching identities.
 */
export const validateEngineExecutionRequest = request => {
	exactKeys(request, ["schemaVersion", "kind", "engine", "component", "source", "output", "cache", "targets", "policies"], "engine execution request");
	if(request.schemaVersion !== 1 || request.kind !== "lean-bridge-engine-execution") fail("invalid-engine-execution-request", "Engine execution request version or kind is unsupported");
	exactKeys(request.engine, ["identitySha256", "fileCount"], "engine");
	hash(request.engine.identitySha256, "engine identity");
	if(!Number.isSafeInteger(request.engine.fileCount) || request.engine.fileCount < 1) fail("invalid-engine-execution-request", "Engine file count must be positive");
	exactKeys(request.component, ["id", "componentPlanSha256", "compilationPlanSha256", "sourceTreeSha256", "inputClosureSha256"], "component");
	if(typeof request.component.id !== "string" || request.component.id === "") fail("invalid-engine-execution-request", "Component id is required");
	for(const key of ["componentPlanSha256", "compilationPlanSha256", "sourceTreeSha256", "inputClosureSha256"]) hash(request.component[key], `component ${key}`);
	exactKeys(request.source, ["kind", "mount", "readOnly"], "source");
	if(request.source.kind !== "closed-component-input" || request.source.mount !== "component" || request.source.readOnly !== true) fail("invalid-engine-execution-request", "Component source must be one closed read-only input mount");
	exactKeys(request.output, ["kind", "bundleDirectory", "executionReport", "authorizedFiles"], "output");
	if(request.output.kind !== "component-neutral-release-bundle" || request.output.bundleDirectory !== "bundle" || request.output.executionReport !== "engine-execution-report.json") fail("invalid-engine-execution-request", "Output contract is unsupported");
	if(!Array.isArray(request.output.authorizedFiles) || request.output.authorizedFiles.length < 1 || new Set(request.output.authorizedFiles).size !== request.output.authorizedFiles.length || request.output.authorizedFiles.some(path => !safePath(path))) fail("invalid-engine-execution-request", "Authorized output files must be unique safe paths");
	exactKeys(request.cache, ["policy"], "cache");
	if(!new Set(["use", "refresh", "off"]).has(request.cache.policy)) fail("invalid-engine-execution-request", "Cache policy must be use, refresh, or off");
	if(!Array.isArray(request.targets) || new Set(request.targets).size !== request.targets.length || request.targets.some(target => typeof target !== "string" || target === "")) fail("invalid-engine-execution-request", "Targets must be unique non-empty strings");
	exactKeys(request.policies, ["backendNeutral", "sameRequestBytes", "sourceReadOnly", "compileOnce", "sharedRuntime", "copyAuthorizedOutputsOnly"], "policies");
	if(Object.values(request.policies).some(value => value !== true)) fail("invalid-engine-execution-request", "Execution policies must preserve backend-neutral shared-runtime compilation");
	return true;
};

/**
 * Binds engine and input-closure identities to backend-neutral outputs, targets, cache policy, and read-only execution constraints.
 *
 * @param root0 - Named inputs and dependency overrides used to create engine execution request.
 * @param root0.engineRoot - Filesystem root containing the engine.
 * @param root0.inputRoot - Filesystem root containing the input.
 * @param root0.componentPlan - Validated component plan defining exports, targets, and generated adapter requirements.
 * @param root0.compilationPlan - Validated compilation plan binding authorized inputs, outputs, toolchain, and runtime profile.
 * @param root0.cachePolicy - Closed policy selecting reuse, refresh, or complete cache bypass.
 * @param root0.targets - Closed target identifiers selected for planning, building, or reproducibility comparison.
 */
export const createEngineExecutionRequest = async ({ engineRoot, inputRoot, componentPlan, compilationPlan, cachePolicy = "use", targets = [] }) => {
	validateComponentBuildPlan(componentPlan.document);
	validateComponentCompilationPlan(compilationPlan.document);
	if(componentPlan.sha256 !== compilationPlan.document.componentPlanSha256) fail("engine-request-plan-drift", "Component and compilation plans do not share one identity");
	const [engine, input] = await Promise.all([
		identifyBuildEngine(engineRoot)
		, identifyComponentInputClosure(inputRoot)
	]);
	const document = Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-engine-execution"
		, engine: Object.freeze({ identitySha256: engine.identitySha256, fileCount: engine.fileCount })
		, component: Object.freeze({
			id: componentPlan.document.component.id
			, componentPlanSha256: componentPlan.sha256
			, compilationPlanSha256: compilationPlan.sha256
			, sourceTreeSha256: componentPlan.document.source.treeSha256
			, inputClosureSha256: input.identitySha256
		})
		, source: Object.freeze({ kind: "closed-component-input", mount: "component", readOnly: true })
		, output: Object.freeze({
			kind: "component-neutral-release-bundle"
			, bundleDirectory: "bundle"
			, executionReport: "engine-execution-report.json"
			, authorizedFiles: authorizedBundleFiles({ componentPlan, compilationPlan })
		})
		, cache: Object.freeze({ policy: cachePolicy })
		, targets: Object.freeze([...targets].sort())
		, policies: Object.freeze({ backendNeutral: true, sameRequestBytes: true, sourceReadOnly: true, compileOnce: true, sharedRuntime: true, copyAuthorizedOutputsOnly: true })
	});
	validateEngineExecutionRequest(document);
	return Object.freeze({ document, sha256: sha256(canonicalJson(document)), engine, input });
};

/**
 * Writes engine execution request in deterministic form with the metadata required by the isolated component build pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to write engine execution request.
 * @param root0.output - Destination path or output record that receives the generated artifact.
 */
export const writeEngineExecutionRequest = async ({ output, ...inputs }) => {
	const destination = resolve(output);
	try
	{
		await stat(destination);
		fail("engine-execution-request-exists", `Engine execution request already exists: ${destination}`);
	} catch(error)
	{
		if(error instanceof EngineExecutionRequestError) throw error;
		if(error.code !== "ENOENT") throw error;
	}
	const request = await createEngineExecutionRequest(inputs);
	await mkdir(dirname(destination), { recursive: true });
	const staging = `${destination}.tmp-${process.pid}-${Date.now()}`;
	try
	{
		await writeFile(staging, canonicalJson(request.document), { mode: 0o444, flag: "wx" });
		await rename(staging, destination);
	} catch(error)
	{
		await rm(staging, { force: true });
		throw error;
	}
	return Object.freeze({ ...request, output: destination });
};

/**
 * Loads verified engine execution request, verifies its structure and identity, and returns it to the isolated component build pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to read verified engine execution request.
 * @param root0.requestPath - Filesystem path to the request.
 * @param root0.engineRoot - Filesystem root containing the engine.
 * @param root0.inputRoot - Filesystem root containing the input.
 */
export const readVerifiedEngineExecutionRequest = async ({ requestPath, engineRoot, inputRoot }) => {
	const source = await readFile(resolve(requestPath), "utf8");
	let document;
	try
	{
		document = JSON.parse(source);
	} catch(error)
	{
		fail("invalid-engine-execution-request-json", "Engine execution request is not valid JSON", { cause: error.message });
	}
	validateEngineExecutionRequest(document);
	const [engine, input] = await Promise.all([
		identifyBuildEngine(engineRoot)
		, identifyComponentInputClosure(inputRoot)
	]);
	if(engine.identitySha256 !== document.engine.identitySha256 || engine.fileCount !== document.engine.fileCount) fail("engine-execution-identity-drift", "Installed build engine differs from the requested engine identity");
	if(input.identitySha256 !== document.component.inputClosureSha256) fail("component-input-identity-drift", "Mounted component input closure differs from the execution request");
	return Object.freeze({ document: Object.freeze(document), sha256: sha256(canonicalJson(document)), engine, input });
};
