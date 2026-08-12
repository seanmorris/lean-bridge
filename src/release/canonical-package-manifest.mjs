import { createHash } from "node:crypto";

import { canonicalJson } from "../capsule/node.mjs";

export class CanonicalPackageManifestError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CanonicalPackageManifestError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new CanonicalPackageManifestError(code, message, details);
};

const exactKeys = (value, keys, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid-canonical-package-manifest", `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("invalid-canonical-package-manifest", `${label} fields must be closed`, { label, expected, actual });
  }
};

const string = (value, label) => {
  if (typeof value !== "string" || value.length === 0) {
    fail("invalid-canonical-package-manifest", `${label} must be a non-empty string`);
  }
};
const sha256 = (value, label) => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail("invalid-canonical-package-manifest", `${label} must be a SHA-256 identity`);
  }
};
const commit = (value, label) => {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/.test(value)) {
    fail("invalid-canonical-package-manifest", `${label} must be a 40-character revision`);
  }
};
const version = (value, label) => {
  if (typeof value !== "string" || !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(value)) {
    fail("invalid-canonical-package-manifest", `${label} must be a semantic version`);
  }
};
const path = (value, label) => {
  string(value, label);
  if (value.startsWith("/") || value.includes("\\") || value.split("/").includes("..")) {
    fail("invalid-canonical-package-manifest", `${label} must be a package-relative path`);
  }
};
const integer = (value, label, minimum = 0) => {
  if (!Number.isInteger(value) || value < minimum) {
    fail("invalid-canonical-package-manifest", `${label} must be an integer greater than or equal to ${minimum}`);
  }
};
const boolean = (value, label) => {
  if (typeof value !== "boolean") fail("invalid-canonical-package-manifest", `${label} must be a boolean`);
};
const array = (value, label, minimum = 0) => {
  if (!Array.isArray(value) || value.length < minimum) {
    fail("invalid-canonical-package-manifest", `${label} must contain at least ${minimum} item(s)`);
  }
};
const strings = (value, label, minimum = 0) => {
  array(value, label, minimum);
  value.forEach((item, index) => string(item, `${label}[${index}]`));
  if (new Set(value).size !== value.length) fail("invalid-canonical-package-manifest", `${label} must not contain duplicates`);
};
const unique = (values, field, label) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value[field])) fail("invalid-canonical-package-manifest", `${label} contains duplicate ${field} ${value[field]}`);
    seen.add(value[field]);
  }
};

const artifactRoles = new Set([
  "runtime", "component", "source", "lock", "binding", "schema", "validator",
  "documentation", "license", "assurance", "sbom", "provenance",
]);
const ecosystems = new Set(["npm", "cargo", "pypi", "c", "cpp", "wit-wasi"]);
const claimStates = new Set(["proved", "trusted-boundary", "unverified"]);

const validateReference = ({ id, artifacts, label, role = null }) => {
  const artifact = artifacts.get(id);
  if (!artifact) fail("missing-package-artifact", `${label} references absent artifact ${id}`, { id, label });
  if (role !== null && artifact.role !== role) {
    fail("contradictory-package-artifact", `${label} requires artifact role ${role}, got ${artifact.role}`, { id, label });
  }
  return artifact;
};

export const validateCanonicalPackageManifest = manifest => {
  exactKeys(manifest, [
    "schemaVersion", "component", "locks", "source", "bindingIr", "runtime", "artifacts",
    "targets", "dependencies", "capabilities", "packages", "documentation", "licenses",
    "assurance", "provenance",
  ], "canonical package manifest");
  if (manifest.schemaVersion !== 1) fail("unsupported-canonical-package-manifest", "canonical package manifest version is not supported");

  exactKeys(manifest.component, ["id", "name", "version"], "component");
  string(manifest.component.id, "component.id");
  if (!/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*@[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.component.id)) {
    fail("invalid-canonical-package-manifest", "component.id must be a versioned package identity");
  }
  string(manifest.component.name, "component.name");
  version(manifest.component.version, "component.version");
  if (!manifest.component.id.endsWith(`@${manifest.component.version}`)) {
    fail("component-version-drift", "component id and version do not agree");
  }

  exactKeys(manifest.locks, ["flake", "graph"], "locks");
  exactKeys(manifest.locks.flake, ["path", "sha256", "inputClosureSha256"], "flake lock");
  path(manifest.locks.flake.path, "locks.flake.path");
  sha256(manifest.locks.flake.sha256, "locks.flake.sha256");
  sha256(manifest.locks.flake.inputClosureSha256, "locks.flake.inputClosureSha256");
  exactKeys(manifest.locks.graph, ["path", "sha256", "id", "profile"], "graph lock");
  path(manifest.locks.graph.path, "locks.graph.path");
  sha256(manifest.locks.graph.sha256, "locks.graph.sha256");
  string(manifest.locks.graph.id, "locks.graph.id");
  string(manifest.locks.graph.profile, "locks.graph.profile");

  exactKeys(manifest.source, ["repository", "revision", "path", "sha256"], "source");
  string(manifest.source.repository, "source.repository");
  try {
    const repository = new URL(manifest.source.repository);
    if (!new Set(["https:", "http:"]).has(repository.protocol)) throw new Error("unsupported protocol");
  } catch {
    fail("invalid-canonical-package-manifest", "source.repository must be an HTTP or HTTPS URL");
  }
  commit(manifest.source.revision, "source.revision");
  path(manifest.source.path, "source.path");
  sha256(manifest.source.sha256, "source.sha256");

  exactKeys(manifest.bindingIr, ["schemaVersion", "path", "fileSha256", "semanticSha256"], "Binding IR");
  integer(manifest.bindingIr.schemaVersion, "bindingIr.schemaVersion", 1);
  path(manifest.bindingIr.path, "bindingIr.path");
  sha256(manifest.bindingIr.fileSha256, "bindingIr.fileSha256");
  sha256(manifest.bindingIr.semanticSha256, "bindingIr.semanticSha256");

  exactKeys(manifest.runtime, ["abiVersion", "leanCommit", "patchSetSha256", "profile", "shared", "scope"], "runtime");
  integer(manifest.runtime.abiVersion, "runtime.abiVersion", 1);
  commit(manifest.runtime.leanCommit, "runtime.leanCommit");
  sha256(manifest.runtime.patchSetSha256, "runtime.patchSetSha256");
  string(manifest.runtime.profile, "runtime.profile");
  if (manifest.runtime.shared !== true) fail("private-runtime-forbidden", "canonical packages must use a shared runtime");
  if (!new Set(["application", "process", "wasm-main-module"]).has(manifest.runtime.scope)) {
    fail("invalid-canonical-package-manifest", "runtime.scope is not supported");
  }
  if (manifest.runtime.profile !== manifest.locks.graph.profile) {
    fail("runtime-graph-profile-drift", "runtime and graph profiles do not agree");
  }

  array(manifest.artifacts, "artifacts", 1);
  unique(manifest.artifacts, "id", "artifacts");
  unique(manifest.artifacts, "path", "artifacts");
  const artifacts = new Map();
  for (const artifact of manifest.artifacts) {
    exactKeys(artifact, ["id", "path", "mediaType", "role", "target", "bytes", "sha256", "core", "executable"], "artifact");
    string(artifact.id, "artifact.id");
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(artifact.id)) {
      fail("invalid-canonical-package-manifest", `artifact id is invalid: ${artifact.id}`);
    }
    path(artifact.path, "artifact.path");
    string(artifact.mediaType, "artifact.mediaType");
    if (!artifactRoles.has(artifact.role)) fail("invalid-canonical-package-manifest", `unsupported artifact role ${artifact.role}`);
    if (artifact.target !== null) string(artifact.target, "artifact.target");
    integer(artifact.bytes, "artifact.bytes");
    sha256(artifact.sha256, "artifact.sha256");
    boolean(artifact.core, "artifact.core");
    boolean(artifact.executable, "artifact.executable");
    artifacts.set(artifact.id, artifact);
  }
  for (const role of ["runtime", "component", "source", "lock", "binding", "documentation", "license", "assurance", "sbom", "provenance"]) {
    if (!manifest.artifacts.some(artifact => artifact.role === role)) {
      fail("missing-artifact-role", `canonical package manifest requires a ${role} artifact`);
    }
  }
  const matchingArtifact = (role, wantedPath, wantedHash, label) => {
    if (!manifest.artifacts.some(artifact => artifact.role === role && artifact.path === wantedPath && artifact.sha256 === wantedHash)) {
      fail("artifact-identity-drift", `${label} is not bound to the artifact inventory`, { role, path: wantedPath, sha256: wantedHash });
    }
  };
  matchingArtifact("lock", manifest.locks.flake.path, manifest.locks.flake.sha256, "flake lock");
  matchingArtifact("lock", manifest.locks.graph.path, manifest.locks.graph.sha256, "graph lock");
  matchingArtifact("source", manifest.source.path, manifest.source.sha256, "source");
  matchingArtifact("binding", manifest.bindingIr.path, manifest.bindingIr.fileSha256, "Binding IR");

  array(manifest.targets, "targets", 1);
  unique(manifest.targets, "id", "targets");
  const targets = new Map();
  for (const target of manifest.targets) {
    exactKeys(target, ["id", "eligible", "reason", "platforms", "capabilities", "entryPoints"], "target");
    string(target.id, "target.id");
    boolean(target.eligible, "target.eligible");
    strings(target.platforms, "target.platforms", target.eligible ? 1 : 0);
    strings(target.capabilities, "target.capabilities");
    array(target.entryPoints, "target.entryPoints", target.eligible ? 1 : 0);
    if (target.eligible && target.reason !== null) fail("contradictory-target-eligibility", `${target.id} is eligible but has an ineligibility reason`);
    if (!target.eligible) {
      string(target.reason, "target.reason");
      if (target.entryPoints.length !== 0) fail("contradictory-target-eligibility", `${target.id} is ineligible but declares entry points`);
    }
    const names = new Set();
    for (const entryPoint of target.entryPoints) {
      exactKeys(entryPoint, ["name", "kind", "artifact"], "target entry point");
      string(entryPoint.name, "entryPoint.name");
      if (names.has(entryPoint.name)) fail("duplicate-target-entry-point", `${target.id} repeats entry point ${entryPoint.name}`);
      names.add(entryPoint.name);
      if (!new Set(["library", "types", "metadata", "documentation"]).has(entryPoint.kind)) {
        fail("invalid-canonical-package-manifest", `unsupported entry point kind ${entryPoint.kind}`);
      }
      const artifact = validateReference({ id: entryPoint.artifact, artifacts, label: `target ${target.id}` });
      if (artifact.target !== null && artifact.target !== target.id) {
        fail("target-artifact-drift", `${target.id} entry point uses artifact for ${artifact.target}`);
      }
    }
    targets.set(target.id, target);
  }
  for (const artifact of manifest.artifacts) {
    if (artifact.target !== null && !targets.has(artifact.target)) {
      fail("missing-artifact-target", `artifact ${artifact.id} names absent target ${artifact.target}`);
    }
  }

  array(manifest.dependencies, "dependencies");
  unique(manifest.dependencies, "id", "dependencies");
  for (const dependency of manifest.dependencies) {
    exactKeys(dependency, ["id", "manifestSha256", "kind"], "dependency");
    string(dependency.id, "dependency.id");
    if (dependency.id === manifest.component.id) fail("self-package-dependency", "canonical package cannot depend on itself");
    sha256(dependency.manifestSha256, "dependency.manifestSha256");
    if (!new Set(["runtime", "component", "host"]).has(dependency.kind)) {
      fail("invalid-canonical-package-manifest", `unsupported dependency kind ${dependency.kind}`);
    }
  }

  exactKeys(manifest.capabilities, ["provided", "requiredHosts", "gaps"], "capabilities");
  strings(manifest.capabilities.provided, "capabilities.provided");
  strings(manifest.capabilities.requiredHosts, "capabilities.requiredHosts");
  array(manifest.capabilities.gaps, "capabilities.gaps");
  for (const gap of manifest.capabilities.gaps) {
    exactKeys(gap, ["target", "feature", "reason"], "capability gap");
    string(gap.target, "capabilityGap.target");
    string(gap.feature, "capabilityGap.feature");
    string(gap.reason, "capabilityGap.reason");
    const target = targets.get(gap.target);
    if (!target) fail("missing-capability-target", `capability gap names absent target ${gap.target}`);
    if (target.capabilities.includes(gap.feature)) {
      fail("contradictory-target-capability", `${gap.target} both provides and lacks ${gap.feature}`);
    }
  }

  array(manifest.packages, "packages", 1);
  const packageKeys = new Set();
  for (const packageMapping of manifest.packages) {
    exactKeys(packageMapping, ["ecosystem", "name", "version", "target", "eligible", "reason", "publicArtifacts"], "registry package");
    if (!ecosystems.has(packageMapping.ecosystem)) fail("invalid-canonical-package-manifest", `unsupported ecosystem ${packageMapping.ecosystem}`);
    string(packageMapping.name, "package.name");
    version(packageMapping.version, "package.version");
    if (packageMapping.version !== manifest.component.version) {
      fail("package-version-drift", `${packageMapping.ecosystem} version differs from the component version`);
    }
    string(packageMapping.target, "package.target");
    const target = targets.get(packageMapping.target);
    if (!target) fail("missing-package-target", `${packageMapping.ecosystem} package names absent target ${packageMapping.target}`);
    boolean(packageMapping.eligible, "package.eligible");
    strings(packageMapping.publicArtifacts, "package.publicArtifacts", packageMapping.eligible ? 1 : 0);
    if (packageMapping.eligible) {
      if (!target.eligible) fail("contradictory-package-eligibility", `${packageMapping.ecosystem} package uses ineligible target ${target.id}`);
      if (packageMapping.reason !== null) fail("contradictory-package-eligibility", `${packageMapping.ecosystem} package is eligible but has a reason`);
    } else {
      string(packageMapping.reason, "package.reason");
      if (packageMapping.publicArtifacts.length !== 0) fail("contradictory-package-eligibility", `${packageMapping.ecosystem} package is ineligible but exposes artifacts`);
    }
    for (const id of packageMapping.publicArtifacts) {
      const artifact = validateReference({ id, artifacts, label: `${packageMapping.ecosystem} package` });
      if (artifact.target !== null && artifact.target !== packageMapping.target) {
        fail("package-target-artifact-drift", `${packageMapping.ecosystem} package includes artifact for ${artifact.target}`);
      }
    }
    const key = `${packageMapping.ecosystem}:${packageMapping.name}`;
    if (packageKeys.has(key)) fail("duplicate-registry-package", `registry mapping repeats ${key}`);
    packageKeys.add(key);
  }

  exactKeys(manifest.documentation, ["generated", "artifacts"], "documentation");
  boolean(manifest.documentation.generated, "documentation.generated");
  strings(manifest.documentation.artifacts, "documentation.artifacts", 1);
  manifest.documentation.artifacts.forEach(id => validateReference({ id, artifacts, label: "documentation", role: "documentation" }));

  exactKeys(manifest.licenses, ["expression", "artifacts"], "licenses");
  string(manifest.licenses.expression, "licenses.expression");
  strings(manifest.licenses.artifacts, "licenses.artifacts", 1);
  manifest.licenses.artifacts.forEach(id => validateReference({ id, artifacts, label: "licenses", role: "license" }));

  exactKeys(manifest.assurance, ["artifact", "claims"], "assurance");
  validateReference({ id: manifest.assurance.artifact, artifacts, label: "assurance", role: "assurance" });
  array(manifest.assurance.claims, "assurance.claims", 1);
  unique(manifest.assurance.claims, "id", "assurance claims");
  for (const claim of manifest.assurance.claims) {
    exactKeys(claim, ["id", "subject", "state", "theorems", "assumptions", "artifacts"], "assurance claim");
    string(claim.id, "claim.id");
    string(claim.subject, "claim.subject");
    if (!claimStates.has(claim.state)) fail("invalid-canonical-package-manifest", `unsupported assurance state ${claim.state}`);
    strings(claim.theorems, "claim.theorems");
    strings(claim.assumptions, "claim.assumptions");
    strings(claim.artifacts, "claim.artifacts", 1);
    claim.artifacts.forEach(id => validateReference({ id, artifacts, label: `claim ${claim.id}` }));
    if (claim.state === "proved" && claim.theorems.length === 0) {
      fail("proof-claim-without-theorem", `proved claim ${claim.id} has no theorem identity`);
    }
    if (claim.state === "trusted-boundary" && claim.assumptions.length === 0) {
      fail("trust-claim-without-assumption", `trusted claim ${claim.id} has no stated assumption`);
    }
  }

  exactKeys(manifest.provenance, ["sourceDateEpoch", "builder", "toolchainSha256", "inputClosureSha256", "sbomArtifact", "attestationArtifact"], "provenance");
  integer(manifest.provenance.sourceDateEpoch, "provenance.sourceDateEpoch", 1);
  string(manifest.provenance.builder, "provenance.builder");
  sha256(manifest.provenance.toolchainSha256, "provenance.toolchainSha256");
  sha256(manifest.provenance.inputClosureSha256, "provenance.inputClosureSha256");
  if (manifest.provenance.inputClosureSha256 !== manifest.locks.flake.inputClosureSha256) {
    fail("provenance-closure-drift", "provenance and flake lock name different input closures");
  }
  validateReference({ id: manifest.provenance.sbomArtifact, artifacts, label: "provenance SBOM", role: "sbom" });
  validateReference({ id: manifest.provenance.attestationArtifact, artifacts, label: "provenance attestation", role: "provenance" });
  return true;
};

export const parseCanonicalPackageManifest = source => {
  let manifest;
  try {
    manifest = typeof source === "string" ? JSON.parse(source) : structuredClone(source);
  } catch (error) {
    fail("invalid-canonical-package-json", "canonical package manifest is not valid JSON", { cause: error.message });
  }
  validateCanonicalPackageManifest(manifest);
  return Object.freeze(manifest);
};

export const canonicalPackageManifestJson = manifest => {
  validateCanonicalPackageManifest(manifest);
  return canonicalJson(manifest);
};

export const hashCanonicalPackageManifest = manifest => createHash("sha256")
  .update(canonicalPackageManifestJson(manifest))
  .digest("hex");
