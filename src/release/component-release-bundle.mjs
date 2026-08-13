import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { canonicalJson, sha256 } from "../capsule/node.mjs";

/**
 * Reports component release bundle failures with stable machine-readable codes and structured diagnostic context.
 */
export class ComponentReleaseBundleError extends Error
{
	/**
   * Initializes the error used to report component release bundle failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "ComponentReleaseBundleError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new ComponentReleaseBundleError(code, message, details);
};

const exactKeys = (value, expected, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-component-release-bundle", `${label} must be an object`);
	const actual = Object.keys(value).sort();
	const wanted = [...expected].sort();
	if(JSON.stringify(actual) !== JSON.stringify(wanted)) fail("invalid-component-release-bundle", `${label} fields must be closed`, { actual, expected: wanted });
};

const safePath = path => typeof path === "string" && path !== "" && !path.startsWith("/") && !path.includes("\\") && !path.split("/").includes("..");

/**
 * Validates component release bundle manifest against its closed contract before it enters the deterministic release and independent-verification pipeline.
 *
 * @param manifest - Domain manifest whose schema, closed fields, and recorded identities are validated or serialized.
 */
export const validateComponentReleaseBundleManifest = manifest => {
	exactKeys(manifest, ["schemaVersion", "kind", "component", "identitySha256", "componentArtifactManifestSha256", "bindingIrSemanticSha256", "runtime", "files", "policies"], "component release bundle");
	if(manifest.schemaVersion !== 1 || manifest.kind !== "lean-bridge-component-release-bundle" || !/^[0-9a-f]{64}$/.test(manifest.identitySha256)) fail("invalid-component-release-bundle", "Bundle version, kind, or identity is invalid");
	exactKeys(manifest.component, ["id", "name", "version"], "component");
	for(const key of ["id", "name", "version"]) if(typeof manifest.component[key] !== "string" || manifest.component[key] === "") fail("invalid-component-release-bundle", `Component ${key} is required`);
	if(!/^[0-9a-f]{64}$/.test(manifest.componentArtifactManifestSha256) || !/^[0-9a-f]{64}$/.test(manifest.bindingIrSemanticSha256)) fail("invalid-component-release-bundle", "Bundle semantic identities are invalid");
	exactKeys(manifest.runtime, ["kind", "artifactIncluded", "abiVersion", "leanCommit", "patchSetSha256", "profile", "shared", "requiredImports"], "runtime requirement");
	if(manifest.runtime.kind !== "content-addressed-peer" || manifest.runtime.artifactIncluded !== false || manifest.runtime.shared !== true || manifest.runtime.profile !== "side-lazy" || !Array.isArray(manifest.runtime.requiredImports) || JSON.stringify(manifest.runtime.requiredImports) !== JSON.stringify(["memory", "__indirect_function_table"])) fail("invalid-component-release-bundle", "Bundle must reference one shared runtime without embedding it");
	if(!Array.isArray(manifest.files) || manifest.files.length < 1) fail("invalid-component-release-bundle", "Bundle inventory is empty");
	const paths = new Set();
	for(const file of manifest.files)
	{
		exactKeys(file, ["path", "role", "mediaType", "bytes", "sha256"], "bundle file");
		if(!safePath(file.path) || paths.has(file.path) || typeof file.role !== "string" || typeof file.mediaType !== "string" || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[0-9a-f]{64}$/.test(file.sha256)) fail("invalid-component-release-bundle", `Invalid bundle file ${file.path}`);
		paths.add(file.path);
	}
	if(manifest.files.filter(file => file.role === "component" && file.mediaType === "application/wasm").length !== 1 || manifest.files.filter(file => file.mediaType === "application/wasm").length !== 1 || manifest.files.some(file => file.role === "runtime" || /runtime.*\.wasm$/.test(file.path))) fail("invalid-component-release-bundle", "Bundle must contain one component Wasm and zero runtime binaries");
	for(const role of ["component", "binding-ir", "private-abi", "assurance", "runtime-requirement", "source", "generated-source", "plan", "build-evidence", "provenance", "documentation"]) if(!manifest.files.some(file => file.role === role)) fail("invalid-component-release-bundle", `Bundle is missing ${role}`);
	exactKeys(manifest.policies, ["backendNeutral", "compileOnce", "sourceReadOnly", "runtimeBinaryIncluded", "targetPackagesIncluded"], "bundle policies");
	if(manifest.policies.backendNeutral !== true || manifest.policies.compileOnce !== true || manifest.policies.sourceReadOnly !== true || manifest.policies.runtimeBinaryIncluded !== false || manifest.policies.targetPackagesIncluded !== false) fail("invalid-component-release-bundle", "Bundle policies allow backend or runtime duplication");
	const identity = sha256(canonicalJson(manifest.files));
	if(identity !== manifest.identitySha256) fail("component-release-bundle-identity", "Bundle identity differs from its file inventory", { expected: manifest.identitySha256, actual: identity });
	return true;
};

const mediaType = path => path.endsWith(".wasm") ? "application/wasm"
	: path.endsWith(".json") ? "application/json"
		: path.endsWith(".lean") ? "text/x-lean"
			: path.endsWith(".toml") ? "application/toml"
				: path.endsWith(".md") ? "text/markdown"
					: "text/plain";

const listFiles = async root => {
	const result = [];
	const visit = async relative => {
		for(const entry of await readdir(join(root, relative), { withFileTypes: true }))
		{
			const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
			if(entry.isDirectory()) await visit(path);
			else if(entry.isFile()) result.push(path);
		}
	};
	await visit("");
	return result.sort();
};

const write = async (root, path, contents) => {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), contents);
};

const copy = async (root, path, source) => {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await copyFile(source, join(root, path));
};

const readme = component => `# ${component.name}

This component was compiled once from Lean and is ready for package backends to arrange without recompilation.

The bundle contains one WebAssembly side module. Applications resolve the content-addressed shared Lean runtime separately, so multiple components use one runtime, memory, table, and heap.
`;

/**
 * Builds component release bundle from validated inputs with deterministic output suitable for the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to build component release bundle.
 * @param root0.projectRoot - Filesystem root containing the project.
 * @param root0.inputRoot - Filesystem root containing the input.
 * @param root0.targetCRoot - Filesystem root containing the target C.
 * @param root0.sideRoot - Filesystem root containing the side.
 * @param root0.outputRoot - Filesystem root containing the output.
 * @param root0.analysis - Completed project analysis containing source identities, diagnostics, export evidence, and proposed Binding IR.
 * @param root0.componentPlan - Validated component plan defining exports, targets, and generated adapter requirements.
 * @param root0.compilerAdapters - Generated adapter manifest and source files that connect Lean declarations to the component ABI.
 * @param root0.compilationPlan - Validated compilation plan binding authorized inputs, outputs, toolchain, and runtime profile.
 * @param root0.compiled - Compiler result containing the generated target-C closure and its recorded identities.
 * @param root0.linked - Link result containing the side module and deterministic link manifest.
 * @param root0.audited - Side-module audit result proving the linked artifact has the required structure and exports.
 * @param root0.componentArtifact - Packaged component artifact and receipt included in the release bundle.
 */
export const buildComponentReleaseBundle = async ({
	projectRoot
	, inputRoot
	, targetCRoot
	, sideRoot
	, outputRoot
	, analysis
	, componentPlan
	, compilerAdapters
	, compilationPlan
	, compiled
	, linked
	, audited
	, componentArtifact
}) => {
	const project = resolve(projectRoot);
	const inputs = resolve(inputRoot);
	const targetC = resolve(targetCRoot);
	const side = resolve(sideRoot);
	const output = resolve(outputRoot);
	try
	{
		await stat(output);
		fail("component-release-bundle-exists", `Component release bundle already exists: ${output}`);
	} catch(error)
	{
		if(error instanceof ComponentReleaseBundleError) throw error;
		if(error.code !== "ENOENT") throw error;
	}
	if(componentArtifact.sha256 !== sha256(canonicalJson(componentArtifact.document)) || componentArtifact.document.wasm.artifact.sha256 !== linked.manifest.artifact.sha256 || componentArtifact.document.bindingIr.semanticSha256 !== analysis.bindingIr.semanticSha256) fail("component-release-input-drift", "Artifact, Wasm, and Binding IR inputs do not form one component identity");
	await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-component-bundle-"));
	try
	{
		const artifactName = linked.manifest.artifact.path.split("/").at(-1);
		await copy(staging, `artifacts/${artifactName}`, join(side, linked.manifest.artifact.path));
		await write(staging, "binding/binding-ir.json", canonicalJson(analysis.bindingIr.document));
		await write(staging, "binding/private-abi.json", canonicalJson(compilerAdapters.plan.privateAbi));
		await write(staging, "metadata/assurance.json", canonicalJson({ schemaVersion: 1, component: analysis.bindingIr.document.component.id, bindingIrSemanticSha256: analysis.bindingIr.semanticSha256, claims: analysis.bindingIr.document.assurance }));
		const runtimeRequirement = Object.freeze({ schemaVersion: 1, kind: "lean-bridge-shared-runtime-requirement", artifactIncluded: false, ...componentPlan.document.runtime, requiredImports: Object.freeze(["memory", "__indirect_function_table"]) });
		await write(staging, "metadata/runtime-requirement.json", canonicalJson(runtimeRequirement));
		await write(staging, "metadata/component-artifact-manifest.json", canonicalJson(componentArtifact.document));
		await write(staging, "metadata/side-module-audit.json", canonicalJson(audited));
		await write(staging, "metadata/provenance.json", canonicalJson({ schemaVersion: 1, component: componentPlan.document.component.id, sourceTreeSha256: componentPlan.document.source.treeSha256, componentPlanSha256: componentPlan.sha256, compilationPlanSha256: compilationPlan.sha256, targetCManifestSha256: compiled.manifestSha256, linkManifestSha256: linked.manifestSha256, componentArtifactManifestSha256: componentArtifact.sha256, compiler: compiled.manifest.compiler, linker: linked.manifest.linker }));
		for(const [path, source] of [
			["locks/component-build-plan.json", join(inputs, "component-build-plan.json")]
			, ["locks/component-compilation-plan.json", join(inputs, "component-compilation-plan.json")]
			, ["locks/compiler-adapters.json", join(inputs, "generated/compiler-adapters.json")]
			, ["locks/lean-target-c-manifest.json", join(targetC, "lean-target-c-manifest.json")]
			, ["locks/side-module-link-manifest.json", join(side, "side-module-link-manifest.json")]
		]) await copy(staging, path, source);
		await copy(staging, "generated/LeanBridgeGenerated.lean", join(inputs, "generated/LeanBridgeGenerated.lean"));
		for(const input of componentPlan.document.source.inputs)
		{
			const source = join(project, input.path);
			const bytes = await readFile(source);
			if(bytes.length !== input.bytes || sha256(bytes) !== input.sha256) fail("component-release-source-drift", `Source changed before bundle assembly: ${input.path}`);
			await write(staging, `source/${input.path}`, bytes);
		}
		await write(staging, "README.md", readme(componentPlan.document.component));
		const roles = path => path.startsWith("artifacts/") ? "component"
			: path === "binding/binding-ir.json" ? "binding-ir"
				: path === "binding/private-abi.json" ? "private-abi"
					: path === "metadata/assurance.json" ? "assurance"
						: path === "metadata/runtime-requirement.json" ? "runtime-requirement"
							: path === "metadata/provenance.json" ? "provenance"
								: path.startsWith("metadata/") ? "build-evidence"
									: path.startsWith("locks/") ? "plan"
										: path.startsWith("source/") ? "source"
											: path.startsWith("generated/") ? "generated-source"
												: "documentation";
		const files = [];
		for(const path of await listFiles(staging))
		{
			const bytes = await readFile(join(staging, path));
			files.push(Object.freeze({ path, role: roles(path), mediaType: mediaType(path), bytes: bytes.length, sha256: sha256(bytes) }));
		}
		const manifest = Object.freeze({
			schemaVersion: 1
			, kind: "lean-bridge-component-release-bundle"
			, component: Object.freeze({ ...componentPlan.document.component })
			, identitySha256: sha256(canonicalJson(files))
			, componentArtifactManifestSha256: componentArtifact.sha256
			, bindingIrSemanticSha256: analysis.bindingIr.semanticSha256
			, runtime: Object.freeze({ kind: "content-addressed-peer", artifactIncluded: false, ...componentPlan.document.runtime, requiredImports: Object.freeze(["memory", "__indirect_function_table"]) })
			, files: Object.freeze(files)
			, policies: Object.freeze({ backendNeutral: true, compileOnce: true, sourceReadOnly: true, runtimeBinaryIncluded: false, targetPackagesIncluded: false })
		});
		validateComponentReleaseBundleManifest(manifest);
		await write(staging, "component-release-bundle.json", canonicalJson(manifest));
		await rename(staging, output);
		return Object.freeze({ output, manifest, manifestSha256: sha256(canonicalJson(manifest)), fileCount: files.length + 1 });
	} catch(error)
	{
		await rm(staging, { recursive: true, force: true });
		throw error;
	}
};
