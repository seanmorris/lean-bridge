import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { validatePackagingBackendPlan } from "./backend-policy.mjs";
import { readVerifiedCanonicalBundle } from "./canonical-bundle-input.mjs";

export const sha256 = value => createHash("sha256").update(value).digest("hex");
export const json = value => `${JSON.stringify(value, null, 2)}\n`;

export const failManagedPackage = (ecosystem, code, message, details = {}) => {
  const error = new Error(message);
  error.name = "ManagedRegistryPackageError";
  error.code = code;
  error.details = { ecosystem, ...details };
  throw error;
};

export const ensureEmptyOutput = async (outputRoot, ecosystem) => {
  const output = resolve(outputRoot);
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length !== 0) {
    failManagedPackage(ecosystem, "output-not-empty", `${ecosystem} package output is not empty: ${output}`);
  }
  return output;
};

export const copy = async (source, destination) => {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
};

export const prepareManagedPackage = async ({ bundleRoot, outputRoot, ecosystem, targetId }) => {
  const output = await ensureEmptyOutput(outputRoot, ecosystem);
  const { root: bundle, manifest, manifestSha256 } = await readVerifiedCanonicalBundle(bundleRoot);
  const mapping = manifest.packages.find(candidate => candidate.ecosystem === ecosystem);
  if (!mapping) failManagedPackage(ecosystem, "mapping-absent", `canonical bundle has no ${ecosystem} package mapping`);
  if (!mapping.eligible) {
    failManagedPackage(ecosystem, "package-ineligible", `canonical bundle is not eligible for ${ecosystem} projection: ${mapping.reason}`, { reason: mapping.reason });
  }
  if (mapping.target !== targetId) {
    failManagedPackage(ecosystem, "target-drift", `${ecosystem} mapping targets ${mapping.target}, expected ${targetId}`);
  }
  const target = manifest.targets.find(candidate => candidate.id === targetId);
  if (!target?.eligible) failManagedPackage(ecosystem, "target-ineligible", `${targetId} is not eligible`);
  const artifactMap = new Map(manifest.artifacts.map(artifact => [artifact.id, artifact]));
  const selected = mapping.publicArtifacts.map(id => artifactMap.get(id));
  if (selected.some(artifact => !artifact)) failManagedPackage(ecosystem, "artifact-absent", `${ecosystem} mapping names an absent artifact`);
  return { output, bundle, manifest, manifestSha256, mapping, target, selected };
};

export const coreProjection = ({ selected, packagePath }) => selected
  .filter(artifact => artifact.core)
  .map(artifact => ({
    sourcePath: artifact.path,
    packagePath: packagePath(artifact),
    sourceSha256: artifact.sha256,
    packageSha256: artifact.sha256,
  }));

export const writeProjectionPlan = async ({ output, backend, ecosystem, manifest, manifestSha256, coreArtifacts, commands }) => {
  const plan = {
    schemaVersion: 1,
    backend,
    ecosystem,
    bundle: { id: manifest.component.id, manifestSha256 },
    compilerAccess: false,
    scriptPolicy: "disabled",
    versionSource: "canonical-manifest",
    semanticSource: "canonical-manifest",
    operations: ["select", "arrange", "copy", "rename", "render-registry-metadata", "archive", "compress"],
    commands,
    coreArtifacts,
  };
  validatePackagingBackendPlan(plan);
  await writeFile(join(output, `${ecosystem}-projection.json`), json(plan));
  return plan;
};

export const readBindingManifest = async ({ bundle, targetId }) => {
  const path = join(bundle, `bindings/${targetId}/binding-manifest.json`);
  return JSON.parse(await readFile(path, "utf8"));
};
