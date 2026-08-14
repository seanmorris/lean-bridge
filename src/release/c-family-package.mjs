/**
 * Implements the C family package module in the release subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import {
	copyFile,
	mkdir,
	readFile,
	readdir,
	writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";

import { validatePackagingBackendPlan } from "./backend-policy.mjs";
import { readVerifiedCanonicalBundle } from "./canonical-bundle-input.mjs";
import { createDeterministicTarGz } from "./deterministic-archive.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;

const fail = (code, message, details = {}) => {
	const error = new Error(message);
	error.name = "CFamilyPackageError";
	error.code = code;
	error.details = details;
	throw error;
};

const ensureEmptyOutput = async output => {
	await mkdir(output, { recursive: true });
	if((await readdir(output)).length !== 0)
	{
		fail("output-not-empty", `C family package output is not empty: ${output}`);
	}
};

const copy = async (source, destination) => {
	await mkdir(dirname(destination), { recursive: true });
	await copyFile(source, destination);
};

const pascal = value => value
  .split(/[^A-Za-z0-9]+/)
  .filter(Boolean)
  .map(part => `${part[0].toUpperCase()}${part.slice(1)}`)
  .join("");

const cmakeNames = manifest => {
	const packageStem = manifest.component.id
    .slice(0, manifest.component.id.lastIndexOf("@"))
    .split("/")
    .at(-1)
    .replace(/^lean[-_.]?/i, "");
	const component = pascal(packageStem) || "Component";
	return {
		package: `LeanBridge${component}`
		, target: `LeanBridge::${component}`
	};
};

const ecosystemLabel = ecosystem => ecosystem === "cpp" ? "C++" : "C";

const nativeExtensions = new Set([".a", ".so", ".dylib", ".dll", ".lib"]);
const nativeLibraries = selected => selected.filter(artifact =>
	nativeExtensions.has(extname(artifact.path)) || /\.so(?:\.[0-9]+)+$/.test(artifact.path));

const pkgConfig = ({ mapping, manifest, generatedManifest, libraries }) => {
	const libraryFlags = libraries.map(artifact => {
    const file = basename(artifact.path);
    if(file.startsWith("lib") && new Set([".a", ".so", ".dylib"]).has(extname(file)))
{
      return `-l${file.slice(3, -extname(file).length)}`;
}
    return `\${libdir}/${file}`;
	});
	return `# Generated from ${manifest.component.id}.
prefix=\${pcfiledir}/../..
includedir=\${prefix}/include
internalincludedir=\${prefix}/internal
libdir=\${prefix}/lib
lean_bridge_binding_source=\${prefix}/${generatedManifest.implementation}
lean_bridge_abi=${manifest.runtime.abiVersion}

Name: ${mapping.name}
Description: Generated C bindings for ${manifest.component.name}
Version: ${mapping.version}
Libs: ${libraryFlags.length === 0 ? "" : `-L\${libdir} ${libraryFlags.join(" ")}`}
Cflags: -I\${includedir} -I\${internalincludedir}
`;
};

const cmakeTargets = ({ manifest, generatedManifest, libraries }) => {
	const names = cmakeNames(manifest);
	if(libraries.length > 0)
	{
		const locations = libraries.map(library => `\${_LEAN_BRIDGE_PREFIX}/lib/${basename(library.path)}`).join(";");
		return `get_filename_component(_LEAN_BRIDGE_PREFIX "\${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
if(NOT TARGET ${names.target})
  add_library(${names.target} INTERFACE IMPORTED)
  set_target_properties(${names.target} PROPERTIES
    INTERFACE_LINK_LIBRARIES "${locations}"
    INTERFACE_INCLUDE_DIRECTORIES "\${_LEAN_BRIDGE_PREFIX}/include;\${_LEAN_BRIDGE_PREFIX}/internal"
    INTERFACE_LEAN_BRIDGE_ABI_VERSION "${manifest.runtime.abiVersion}"
  )
endif()
unset(_LEAN_BRIDGE_PREFIX)
`;
	}
	return `get_filename_component(_LEAN_BRIDGE_PREFIX "\${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
if(NOT TARGET ${names.target})
  add_library(${names.target} INTERFACE IMPORTED)
  set_target_properties(${names.target} PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES "\${_LEAN_BRIDGE_PREFIX}/include;\${_LEAN_BRIDGE_PREFIX}/internal"
    INTERFACE_SOURCES "\${_LEAN_BRIDGE_PREFIX}/${generatedManifest.implementation}"
    INTERFACE_LEAN_BRIDGE_ABI_VERSION "${manifest.runtime.abiVersion}"
  )
endif()
unset(_LEAN_BRIDGE_PREFIX)
`;
};

const cmakeConfig = manifest => {
	const names = cmakeNames(manifest);
	return `set(${names.package}_VERSION "${manifest.component.version}")
set(${names.package}_LEAN_BRIDGE_ABI_VERSION "${manifest.runtime.abiVersion}")
include("\${CMAKE_CURRENT_LIST_DIR}/${names.package}Targets.cmake")
`;
};

const cmakeVersion = manifest => `set(PACKAGE_VERSION "${manifest.component.version}")
if(PACKAGE_FIND_VERSION VERSION_GREATER PACKAGE_VERSION)
  set(PACKAGE_VERSION_COMPATIBLE FALSE)
else()
  set(PACKAGE_VERSION_COMPATIBLE TRUE)
  if(PACKAGE_FIND_VERSION VERSION_EQUAL PACKAGE_VERSION)
    set(PACKAGE_VERSION_EXACT TRUE)
  endif()
endif()
`;

const metadataCopies = [
	["canonical-package.json", "canonical-package.json"]
	, ["canonical-package.sha256", "canonical-package.sha256"]
	, ["bundle-identity.json", "bundle-identity.json"]
	, ["metadata/assurance.json", "assurance.json"]
	, ["metadata/core-artifact-set.json", "core-artifact-set.json"]
	, ["metadata/sbom.spdx.json", "sbom.spdx.json"]
	, ["metadata/provenance.intoto.json", "provenance.intoto.json"]
];

const build = async ({ bundleRoot, outputRoot, ecosystem }) => {
	if(!new Set(["c", "cpp"]).has(ecosystem)) fail("unsupported-ecosystem", `unsupported C family ecosystem ${ecosystem}`);
	const output = resolve(outputRoot);
	const label = ecosystemLabel(ecosystem);
	await ensureEmptyOutput(output);
	const { root: bundle, manifest, manifestSha256 } = await readVerifiedCanonicalBundle(bundleRoot);
	const mapping = manifest.packages.find(packageMapping => packageMapping.ecosystem === ecosystem);
	if(!mapping) fail("mapping-absent", `canonical bundle has no ${label} package mapping`);
	if(!mapping.eligible)
	{
		fail("package-ineligible", `canonical bundle is not eligible for ${label} projection: ${mapping.reason}`, {
			ecosystem
			, reason: mapping.reason
		});
	}
	const target = manifest.targets.find(candidate => candidate.id === mapping.target);
	if(!target?.eligible) fail("target-ineligible", `${label} target is not eligible: ${mapping.target}`);

	const prefix = `bindings/${ecosystem}/`;
	const generatedArtifacts = manifest.artifacts.filter(artifact => artifact.path.startsWith(prefix));
	if(generatedArtifacts.length === 0)
	{
		fail("binding-artifacts-absent", `canonical bundle has no generated ${label} binding projection`);
	}
	const artifacts = new Map(manifest.artifacts.map(artifact => [artifact.id, artifact]));
	const selected = mapping.publicArtifacts.map(id => artifacts.get(id));
	if(selected.some(artifact => !artifact)) fail("artifact-absent", `${label} mapping names an absent artifact`);
	for(const artifact of generatedArtifacts)
	{
		if(!mapping.publicArtifacts.includes(artifact.id))
		{
			fail("binding-artifact-omitted", `${label} mapping omits generated binding artifact ${artifact.path}`);
		}
	}

	const generatedManifestPath = `${prefix}binding-manifest.json`;
	const generatedManifest = JSON.parse(await readFile(join(bundle, generatedManifestPath), "utf8"));
	if(generatedManifest.bindingIrSha256 !== manifest.bindingIr.semanticSha256)
	{
		fail("binding-identity-drift", `${label} binding manifest differs from the canonical Binding IR`);
	}
	if(
		typeof generatedManifest.publicHeader !== "string"
    || typeof generatedManifest.implementation !== "string"
    || !Array.isArray(generatedManifest.files)
	) {
		fail("unsupported-binding-manifest", `${label} binding manifest does not describe a C family source package`);
	}
	const listedFiles = new Set();
	for(const path of generatedManifest.files)
	{
		if(
			typeof path !== "string"
      || path === ""
      || path.startsWith("/")
      || path.includes("\\")
      || path.split("/").includes("..")
      || listedFiles.has(path)
		) {
			fail("invalid-binding-file", `${label} binding manifest contains an invalid or duplicate file path`);
		}
		listedFiles.add(path);
	}
	const inventoriedFiles = new Set(generatedArtifacts.map(artifact => artifact.path.slice(prefix.length)));
	if(
		listedFiles.size !== inventoriedFiles.size
    || [...listedFiles].some(path => !inventoriedFiles.has(path))
	) {
		fail("binding-file-inventory-drift", `${label} binding manifest and canonical artifact inventory differ`);
	}

	const rootName = `${mapping.name}-${mapping.version}-${ecosystem}`;
	const packageRoot = join(output, rootName);
	for(const path of generatedManifest.files)
	{
		await copy(join(bundle, `${prefix}${path}`), join(packageRoot, path));
	}
	await mkdir(join(packageRoot, "internal"), { recursive: true });
	await copy(join(bundle, "LICENSE"), join(packageRoot, "LICENSE"));

	const libraries = nativeLibraries(selected);
	if(
		libraries.length === 0
    && (!target.capabilities.includes("source-bindings") || !target.capabilities.includes("external-runtime-adapter"))
	) {
		fail("runtime-artifact-absent", `${label} source package must declare its generated source and external runtime adapter`);
	}
	for(const artifact of libraries) await copy(join(bundle, artifact.path), join(packageRoot, "lib", basename(artifact.path)));
	const installedHeaders = new Map(generatedManifest.files
    .filter(path => path.endsWith(".h") || path.endsWith(".hpp"))
    .map(path => [basename(path), join(bundle, `${prefix}${path}`)]));
	for(const artifact of selected.filter(artifact => artifact.path.endsWith(".h") || artifact.path.endsWith(".hpp")))
	{
		const name = basename(artifact.path);
		const source = join(bundle, artifact.path);
		const installed = installedHeaders.get(name);
		if(installed !== undefined)
		{
			if(!(await readFile(installed)).equals(await readFile(source)))
			{
				fail("header-destination-collision", `${label} package maps different headers to include/${name}`);
			}
			continue;
		}
		await copy(source, join(packageRoot, "include", name));
		installedHeaders.set(name, source);
	}
	const names = cmakeNames(manifest);
	await mkdir(join(packageRoot, "lib/pkgconfig"), { recursive: true });
	await writeFile(join(packageRoot, "lib/pkgconfig", `${mapping.name}.pc`), pkgConfig({ mapping, manifest, generatedManifest, libraries }));
	const cmakeRoot = join(packageRoot, "lib/cmake", names.package);
	await mkdir(cmakeRoot, { recursive: true });
	await writeFile(join(cmakeRoot, `${names.package}Config.cmake`), cmakeConfig(manifest));
	await writeFile(join(cmakeRoot, `${names.package}ConfigVersion.cmake`), cmakeVersion(manifest));
	await writeFile(join(cmakeRoot, `${names.package}Targets.cmake`), cmakeTargets({ manifest, generatedManifest, libraries }));

	const shareRoot = join(packageRoot, "share", mapping.name);
	for(const [source, destination] of metadataCopies) await copy(join(bundle, source), join(shareRoot, "metadata", destination));
	for(const artifact of selected)
	{
		await copy(join(bundle, artifact.path), join(shareRoot, "artifacts", artifact.path));
	}

	const coreArtifacts = selected.filter(artifact => artifact.core).map(artifact => ({
		sourcePath: artifact.path
		, packagePath: `${rootName}/share/${mapping.name}/artifacts/${artifact.path}`
		, sourceSha256: artifact.sha256
		, packageSha256: artifact.sha256
	}));
	const plan = {
		schemaVersion: 1
		, backend: `c-family-${ecosystem}-v1`
		, ecosystem
		, bundle: { id: manifest.component.id, manifestSha256 }
		, compilerAccess: false
		, scriptPolicy: "disabled"
		, versionSource: "canonical-manifest"
		, semanticSource: "canonical-manifest"
		, operations: ["select", "arrange", "copy", "rename", "render-registry-metadata", "archive", "compress"]
		, commands: ["internal-ustar package", "internal-gzip package.tar"]
		, coreArtifacts
	};
	validatePackagingBackendPlan(plan);
	await writeFile(join(output, `${ecosystem}-projection.json`), json(plan));

	const archive = await createDeterministicTarGz({
		directory: packageRoot
		, archiveRoot: rootName
		, sourceDateEpoch: manifest.provenance.sourceDateEpoch
	});
	const archivePath = join(output, `${rootName}.tar.gz`);
	await writeFile(archivePath, archive);
	return Object.freeze({
		package: `${mapping.name}@${mapping.version}`
		, ecosystem
		, output
		, archive: archivePath
		, archiveSha256: sha256(archive)
		, canonicalManifestSha256: manifestSha256
		, cmakePackage: names.package
		, cmakeTarget: names.target
		, coreArtifacts: Object.freeze(coreArtifacts)
	});
};

/**
 * Builds C package from validated inputs with deterministic output suitable for the deterministic release and independent-verification pipeline.
 *
 * @param options - Verified bundle, empty output root, and target metadata consumed by the shared C-family packager.
 */
export const buildCPackage = options => build({ ...options, ecosystem: "c" });
/**
 * Builds C++ package from validated inputs with deterministic output suitable for the deterministic release and independent-verification pipeline.
 *
 * @param options - Verified bundle, empty output root, and target metadata consumed by the shared C-family packager.
 */
export const buildCppPackage = options => build({ ...options, ecosystem: "cpp" });
