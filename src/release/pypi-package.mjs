import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { validatePackagingBackendPlan } from "./backend-policy.mjs";
import { readVerifiedCanonicalBundle } from "./canonical-bundle-input.mjs";
import { createDeterministicTarGz } from "./deterministic-archive.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const normalizedDistribution = name => name.toLowerCase().replace(/[-_.]+/g, "_");

const fail = (code, message, details = {}) => {
  const error = new Error(message);
  error.name = "PyPiPackageError";
  error.code = code;
  error.details = details;
  throw error;
};

const ensureEmptyOutput = async output => {
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length !== 0) fail("output-not-empty", `PyPI package output is not empty: ${output}`);
};

const copy = async (source, destination) => {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
};

const wheelTag = target => {
  const declared = target.capabilities.find(capability => capability.startsWith("wheel-tag:"));
  if (declared) return declared.slice("wheel-tag:".length);
  if (target.capabilities.includes("pure-python-bindings")) return "py3-none-any";
  fail("wheel-tag-absent", `eligible PyPI target ${target.id} does not declare a wheel tag`);
};

const pyproject = ({ mapping, moduleName, manifest }) => `[build-system]
requires = ["setuptools>=65"]
build-backend = "setuptools.build_meta"

[project]
name = ${JSON.stringify(mapping.name)}
version = ${JSON.stringify(mapping.version)}
description = ${JSON.stringify(`Generated Python bindings for ${manifest.component.name}.`)}
readme = "README.md"
requires-python = ">=3.11"
license = { text = ${JSON.stringify(manifest.licenses.expression)} }

[tool.setuptools.package-data]
${JSON.stringify(moduleName)} = ["py.typed", "*.pyi", "lean_bridge/**/*"]
`;

const metadata = ({ mapping, manifest, readme }) => `Metadata-Version: 2.1
Name: ${mapping.name}
Version: ${mapping.version}
Summary: Generated Python bindings for ${manifest.component.name}.
Home-page: ${manifest.source.repository}
License: ${manifest.licenses.expression}
Requires-Python: >=3.11
Description-Content-Type: text/markdown

${readme}`;

const collectFiles = async root => {
  const files = [];
  const visit = async (directory, prefix = "") => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, path);
      if (entry.isFile()) files.push({ path, bytes: await readFile(absolute) });
    }
  };
  await visit(root);
  return files;
};

const recordHash = bytes => createHash("sha256").update(bytes).digest("base64url");

const writeWheelRecord = async (wheelRoot, distInfo) => {
  const lines = [];
  for (const file of await collectFiles(wheelRoot)) {
    lines.push(`${file.path},sha256=${recordHash(file.bytes)},${file.bytes.length}`);
  }
  lines.push(`${distInfo}/RECORD,,`);
  await writeFile(join(wheelRoot, distInfo, "RECORD"), `${lines.join("\n")}\n`);
};

export const buildPyPiPackage = async ({ bundleRoot, outputRoot }) => {
  const output = resolve(outputRoot);
  await ensureEmptyOutput(output);
  const { root: bundle, manifest, manifestSha256 } = await readVerifiedCanonicalBundle(bundleRoot);
  const mapping = manifest.packages.find(packageMapping => packageMapping.ecosystem === "pypi");
  if (!mapping) fail("mapping-absent", "canonical bundle has no PyPI package mapping");
  if (!mapping.eligible) {
    fail("package-ineligible", `canonical bundle is not eligible for PyPI projection: ${mapping.reason}`, {
      ecosystem: "pypi",
      reason: mapping.reason,
    });
  }
  const target = manifest.targets.find(candidate => candidate.id === mapping.target);
  if (!target?.eligible) fail("target-ineligible", `PyPI target is not eligible: ${mapping.target}`);
  const tag = wheelTag(target);

  const artifacts = new Map(manifest.artifacts.map(artifact => [artifact.id, artifact]));
  const selected = mapping.publicArtifacts.map(id => artifacts.get(id));
  if (selected.some(artifact => !artifact)) fail("artifact-absent", "PyPI mapping names an absent artifact");
  const pythonPrefix = "bindings/python/";
  const pythonArtifacts = manifest.artifacts.filter(artifact => artifact.path.startsWith(pythonPrefix));
  for (const artifact of pythonArtifacts) {
    if (!mapping.publicArtifacts.includes(artifact.id)) {
      fail("binding-artifact-omitted", `PyPI mapping omits generated Python artifact ${artifact.path}`);
    }
  }
  const generatedManifest = JSON.parse(await readFile(join(bundle, `${pythonPrefix}binding-manifest.json`), "utf8"));
  if (generatedManifest.bindingIrSha256 !== manifest.bindingIr.semanticSha256) {
    fail("binding-identity-drift", "Python binding manifest differs from the canonical Binding IR");
  }
  const moduleName = generatedManifest.publicModule.split("/")[0];
  const distribution = normalizedDistribution(mapping.name);
  const versionedName = `${distribution}-${mapping.version}`;
  const distInfo = `${versionedName}.dist-info`;
  const readme = await readFile(join(bundle, `${pythonPrefix}README.md`), "utf8");
  const metadataText = metadata({ mapping, manifest, readme });

  const wheelRoot = join(output, "wheel");
  for (const path of generatedManifest.files) {
    if (path === "pyproject.toml" || path === "README.md") continue;
    if (!path.startsWith(`${moduleName}/`)) continue;
    await copy(join(bundle, `${pythonPrefix}${path}`), join(wheelRoot, path));
  }
  await mkdir(join(wheelRoot, distInfo), { recursive: true });
  await writeFile(join(wheelRoot, distInfo, "METADATA"), metadataText);
  await writeFile(join(wheelRoot, distInfo, "WHEEL"), `Wheel-Version: 1.0\nGenerator: lean-bridge-pypi/1\nRoot-Is-Purelib: ${tag.endsWith("-any") ? "true" : "false"}\nTag: ${tag}\n`);
  await writeFile(join(wheelRoot, distInfo, "top_level.txt"), `${moduleName}\n`);
  await copy(join(bundle, "LICENSE"), join(wheelRoot, distInfo, "licenses/LICENSE"));

  const sdistRoot = join(output, versionedName);
  for (const path of generatedManifest.files) {
    if (path === "pyproject.toml") continue;
    await copy(join(bundle, `${pythonPrefix}${path}`), join(sdistRoot, path));
  }
  await writeFile(join(sdistRoot, "pyproject.toml"), pyproject({ mapping, moduleName, manifest }));
  await writeFile(join(sdistRoot, "PKG-INFO"), metadataText);
  await copy(join(bundle, "LICENSE"), join(sdistRoot, "LICENSE"));

  const metadataCopies = [
    ["canonical-package.json", "canonical-package.json"],
    ["canonical-package.sha256", "canonical-package.sha256"],
    ["bundle-identity.json", "bundle-identity.json"],
    ["metadata/assurance.json", "assurance.json"],
    ["metadata/core-artifact-set.json", "core-artifact-set.json"],
    ["metadata/sbom.spdx.json", "sbom.spdx.json"],
    ["metadata/provenance.intoto.json", "provenance.intoto.json"],
  ];
  for (const [source, destination] of metadataCopies) {
    await copy(join(bundle, source), join(wheelRoot, moduleName, "lean_bridge/metadata", destination));
    await copy(join(bundle, source), join(sdistRoot, moduleName, "lean_bridge/metadata", destination));
  }
  for (const artifact of selected) {
    await copy(join(bundle, artifact.path), join(wheelRoot, moduleName, "lean_bridge/artifacts", artifact.path));
    await copy(join(bundle, artifact.path), join(sdistRoot, moduleName, "lean_bridge/artifacts", artifact.path));
  }
  await writeWheelRecord(wheelRoot, distInfo);

  const coreArtifacts = selected.filter(artifact => artifact.core).flatMap(artifact => [
    {
      sourcePath: artifact.path,
      packagePath: `wheel/${moduleName}/lean_bridge/artifacts/${artifact.path}`,
      sourceSha256: artifact.sha256,
      packageSha256: artifact.sha256,
    },
    {
      sourcePath: artifact.path,
      packagePath: `${versionedName}/${moduleName}/lean_bridge/artifacts/${artifact.path}`,
      sourceSha256: artifact.sha256,
      packageSha256: artifact.sha256,
    },
  ]);
  const plan = {
    schemaVersion: 1,
    backend: "pypi-v1",
    ecosystem: "pypi",
    bundle: { id: manifest.component.id, manifestSha256 },
    compilerAccess: false,
    scriptPolicy: "disabled",
    versionSource: "canonical-manifest",
    semanticSource: "canonical-manifest",
    operations: ["select", "arrange", "copy", "rename", "render-registry-metadata", "archive", "compress"],
    commands: ["internal-zip wheel", "internal-ustar sdist", "internal-gzip sdist.tar"],
    coreArtifacts,
  };
  validatePackagingBackendPlan(plan);
  await writeFile(join(output, "pypi-projection.json"), json(plan));

  const wheel = await createDeterministicZip({
    directory: wheelRoot,
    sourceDateEpoch: manifest.provenance.sourceDateEpoch,
  });
  const wheelPath = join(output, `${versionedName}-${tag}.whl`);
  await writeFile(wheelPath, wheel);
  const sdist = await createDeterministicTarGz({
    directory: sdistRoot,
    archiveRoot: versionedName,
    sourceDateEpoch: manifest.provenance.sourceDateEpoch,
  });
  const sdistPath = join(output, `${versionedName}.tar.gz`);
  await writeFile(sdistPath, sdist);
  return Object.freeze({
    package: `${mapping.name}@${mapping.version}`,
    output,
    wheel: wheelPath,
    wheelSha256: sha256(wheel),
    sdist: sdistPath,
    sdistSha256: sha256(sdist),
    canonicalManifestSha256: manifestSha256,
    tag,
    coreArtifacts: Object.freeze(coreArtifacts),
  });
};
