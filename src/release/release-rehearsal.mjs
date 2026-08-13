import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { canonicalJson } from "../capsule/node.mjs";
import { buildCPackage, buildCppPackage } from "./c-family-package.mjs";
import { buildCargoPackage } from "./cargo-package.mjs";
import { readVerifiedCanonicalBundle } from "./canonical-bundle-input.mjs";
import { buildNpmPackage } from "./npm-package.mjs";
import { buildNugetPackage } from "./nuget-package.mjs";
import { buildPyPiPackage } from "./pypi-package.mjs";
import { buildMavenPackage } from "./maven-package.mjs";
import { buildRubyGemsPackage } from "./rubygems-package.mjs";
import { buildWasiPackage } from "./wasi-package.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const predicateType = "urn:lean-bridge:attestation:publication-rehearsal:v1";

export class PublicationIndexError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PublicationIndexError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new PublicationIndexError(code, message, details);
};

const exactKeys = (value, keys, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid-publication-index", `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("invalid-publication-index", `${label} fields must be closed`, { actual, expected });
  }
};

const string = (value, label) => {
  if (typeof value !== "string" || value === "") fail("invalid-publication-index", `${label} must be a non-empty string`);
};

const digest = (value, label) => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail("invalid-publication-index", `${label} must be a SHA-256 identity`);
  }
};

const path = (value, label) => {
  string(value, label);
  if (value.startsWith("/") || value.includes("\\") || value.split("/").includes("..")) {
    fail("invalid-publication-index", `${label} must be a relative package path`);
  }
};

const packageIdentityKeys = [
  "bindingIrSha256",
  "canonicalManifestSha256",
  "coreArtifactSetSha256",
  "flakeLockSha256",
  "graphLockSha256",
];

export const validatePublicationIndex = index => {
  exactKeys(index, [
    "schemaVersion", "mode", "createdAt", "bundle", "publication", "attestation", "packages",
  ], "publication index");
  if (index.schemaVersion !== 1) fail("unsupported-publication-index", "publication index version is not supported");
  if (index.mode !== "no-publish") fail("invalid-publication-index", "publication index must remain in no-publish mode");
  string(index.createdAt, "createdAt");
  if (!Number.isFinite(Date.parse(index.createdAt))) fail("invalid-publication-index", "createdAt must be an ISO timestamp");

  exactKeys(index.bundle, [
    "component", "version", "canonicalManifestSha256", "coreArtifactSetSha256", "sourceRevision",
    "flakeLock", "graphLock", "bindingIr", "runtime",
  ], "bundle");
  string(index.bundle.component, "bundle.component");
  string(index.bundle.version, "bundle.version");
  digest(index.bundle.canonicalManifestSha256, "bundle.canonicalManifestSha256");
  digest(index.bundle.coreArtifactSetSha256, "bundle.coreArtifactSetSha256");
  string(index.bundle.sourceRevision, "bundle.sourceRevision");
  exactKeys(index.bundle.flakeLock, ["path", "sha256", "inputClosureSha256"], "flake lock");
  exactKeys(index.bundle.graphLock, ["path", "sha256", "id", "profile"], "graph lock");
  exactKeys(index.bundle.bindingIr, ["path", "fileSha256", "semanticSha256"], "Binding IR");
  exactKeys(index.bundle.runtime, ["abiVersion", "leanCommit", "patchSetSha256", "profile", "scope"], "runtime");
  for (const [record, fields] of [
    [index.bundle.flakeLock, ["sha256", "inputClosureSha256"]],
    [index.bundle.graphLock, ["sha256"]],
    [index.bundle.bindingIr, ["fileSha256", "semanticSha256"]],
    [index.bundle.runtime, ["patchSetSha256"]],
  ]) fields.forEach(field => digest(record[field], field));

  exactKeys(index.publication, ["networkAccess", "externalRegistryWrites", "ready", "omitted"], "publication policy");
  if (index.publication.networkAccess !== false || index.publication.externalRegistryWrites !== false) {
    fail("publish-enabled", "release rehearsal cannot allow network access or external registry writes");
  }
  if (!Number.isInteger(index.publication.ready) || !Number.isInteger(index.publication.omitted)) {
    fail("invalid-publication-index", "publication package counts must be integers");
  }
  exactKeys(index.attestation, ["path", "predicateType"], "attestation");
  path(index.attestation.path, "attestation.path");
  if (index.attestation.predicateType !== predicateType) fail("invalid-publication-index", "publication predicate type differs");

  if (!Array.isArray(index.packages) || index.packages.length === 0) {
    fail("invalid-publication-index", "publication index must contain package mappings");
  }
  const ecosystems = new Set();
  let ready = 0;
  let omitted = 0;
  for (const item of index.packages) {
    exactKeys(item, [
      "ecosystem", "name", "version", "target", "status", "reason", "backendPlan", "archives",
      "coreArtifacts", "identity",
    ], "package mapping");
    for (const field of ["ecosystem", "name", "version", "target", "status"]) string(item[field], `package.${field}`);
    if (ecosystems.has(item.ecosystem)) fail("invalid-publication-index", `duplicate package ecosystem ${item.ecosystem}`);
    ecosystems.add(item.ecosystem);
    if (!new Set(["ready", "omitted"]).has(item.status)) fail("invalid-publication-index", `invalid package status ${item.status}`);
    exactKeys(item.identity, packageIdentityKeys, "package identity");
    packageIdentityKeys.forEach(field => digest(item.identity[field], `package.identity.${field}`));
    if (
      item.identity.canonicalManifestSha256 !== index.bundle.canonicalManifestSha256 ||
      item.identity.coreArtifactSetSha256 !== index.bundle.coreArtifactSetSha256 ||
      item.identity.flakeLockSha256 !== index.bundle.flakeLock.sha256 ||
      item.identity.graphLockSha256 !== index.bundle.graphLock.sha256 ||
      item.identity.bindingIrSha256 !== index.bundle.bindingIr.semanticSha256
    ) fail("package-identity-drift", `${item.ecosystem} package identity differs from the release bundle`);
    if (!Array.isArray(item.archives) || !Array.isArray(item.coreArtifacts)) {
      fail("invalid-publication-index", `${item.ecosystem} artifacts must be arrays`);
    }
    for (const archive of item.archives) {
      exactKeys(archive, ["kind", "path", "bytes", "sha256"], "package archive");
      string(archive.kind, "archive.kind");
      path(archive.path, "archive.path");
      if (!Number.isInteger(archive.bytes) || archive.bytes < 0) fail("invalid-publication-index", "archive bytes must be non-negative");
      digest(archive.sha256, "archive.sha256");
    }
    for (const artifact of item.coreArtifacts) {
      exactKeys(artifact, ["sourcePath", "packagePath", "sourceSha256", "packageSha256"], "core artifact");
      path(artifact.sourcePath, "coreArtifact.sourcePath");
      path(artifact.packagePath, "coreArtifact.packagePath");
      digest(artifact.sourceSha256, "coreArtifact.sourceSha256");
      digest(artifact.packageSha256, "coreArtifact.packageSha256");
      if (artifact.sourceSha256 !== artifact.packageSha256) {
        fail("core-artifact-drift", `${item.ecosystem} package changed core artifact ${artifact.sourcePath}`);
      }
    }
    if (item.status === "ready") {
      ready += 1;
      if (item.reason !== null || item.archives.length === 0 || item.backendPlan === null) {
        fail("contradictory-package-status", `${item.ecosystem} ready package lacks archives or backend plan`);
      }
      exactKeys(item.backendPlan, ["path", "bytes", "sha256"], "backend plan");
      path(item.backendPlan.path, "package.backendPlan.path");
      if (!Number.isInteger(item.backendPlan.bytes) || item.backendPlan.bytes < 0) {
        fail("invalid-publication-index", "backend plan bytes must be non-negative");
      }
      digest(item.backendPlan.sha256, "package.backendPlan.sha256");
    } else {
      omitted += 1;
      string(item.reason, "package.reason");
      if (item.backendPlan !== null || item.archives.length !== 0 || item.coreArtifacts.length !== 0) {
        fail("contradictory-package-status", `${item.ecosystem} omitted package carries release artifacts`);
      }
    }
  }
  if (ready !== index.publication.ready || omitted !== index.publication.omitted) {
    fail("publication-count-drift", "publication counts differ from package statuses");
  }
  return true;
};

export const parsePublicationIndex = source => {
  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    fail("invalid-publication-index-json", "publication index is not valid JSON", { cause: error.message });
  }
  validatePublicationIndex(value);
  return value;
};

const builders = Object.freeze({
  npm: buildNpmPackage,
  cargo: buildCargoPackage,
  pypi: buildPyPiPackage,
  c: buildCPackage,
  cpp: buildCppPackage,
  nuget: buildNugetPackage,
  maven: buildMavenPackage,
  rubygems: buildRubyGemsPackage,
  "wit-wasi": buildWasiPackage,
});

const backendPlans = Object.freeze({
  npm: "npm-projection.json",
  cargo: "cargo-projection.json",
  pypi: "pypi-projection.json",
  c: "c-projection.json",
  cpp: "cpp-projection.json",
  nuget: "nuget-projection.json",
  maven: "maven-projection.json",
  rubygems: "rubygems-projection.json",
  "wit-wasi": "wit-wasi-projection.json",
});

const archiveProperties = Object.freeze({
  npm: [["package", "archive"]],
  cargo: [["crate", "archive"]],
  pypi: [["wheel", "wheel"], ["sdist", "sdist"]],
  c: [["archive", "archive"]],
  cpp: [["archive", "archive"]],
  nuget: [["nupkg", "archive"]],
  maven: [["jar", "jar"], ["pom", "pom"]],
  rubygems: [["gem", "archive"]],
  "wit-wasi": [["archive", "archive"]],
});

const archiveRecord = async ({ output, kind, absolute }) => {
  const bytes = await readFile(absolute);
  const facts = await stat(absolute);
  return {
    kind,
    path: relative(output, absolute).replaceAll("\\", "/"),
    bytes: facts.size,
    sha256: sha256(bytes),
  };
};

const planRecord = async ({ output, absolute }) => {
  const bytes = await readFile(absolute);
  const facts = await stat(absolute);
  return {
    path: relative(output, absolute).replaceAll("\\", "/"),
    bytes: facts.size,
    sha256: sha256(bytes),
  };
};

const ensureEmptyOutput = async output => {
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length !== 0) fail("output-not-empty", `release rehearsal output is not empty: ${output}`);
};

export const rehearseRelease = async ({ bundleRoot, outputRoot }) => {
  const output = resolve(outputRoot);
  await ensureEmptyOutput(output);
  const { root: bundle, manifest, manifestSha256 } = await readVerifiedCanonicalBundle(bundleRoot);
  const core = JSON.parse(await readFile(join(bundle, "metadata/core-artifact-set.json"), "utf8"));
  const identity = Object.freeze({
    canonicalManifestSha256: manifestSha256,
    coreArtifactSetSha256: core.identitySha256,
    flakeLockSha256: manifest.locks.flake.sha256,
    graphLockSha256: manifest.locks.graph.sha256,
    bindingIrSha256: manifest.bindingIr.semanticSha256,
  });

  const packages = [];
  for (const mapping of [...manifest.packages].sort((left, right) => left.ecosystem.localeCompare(right.ecosystem))) {
    if (!mapping.eligible) {
      packages.push({
        ecosystem: mapping.ecosystem,
        name: mapping.name,
        version: mapping.version,
        target: mapping.target,
        status: "omitted",
        reason: mapping.reason,
        backendPlan: null,
        archives: [],
        coreArtifacts: [],
        identity,
      });
      continue;
    }
    const packageOutput = join(output, "packages", mapping.ecosystem);
    const result = await builders[mapping.ecosystem]({ bundleRoot: bundle, outputRoot: packageOutput });
    if (result.canonicalManifestSha256 !== manifestSha256) {
      fail("backend-identity-drift", `${mapping.ecosystem} backend returned a different canonical identity`);
    }
    const archives = [];
    for (const [kind, property] of archiveProperties[mapping.ecosystem]) {
      archives.push(await archiveRecord({ output, kind, absolute: result[property] }));
    }
    const backendPlan = await planRecord({
      output,
      absolute: join(packageOutput, backendPlans[mapping.ecosystem]),
    });
    packages.push({
      ecosystem: mapping.ecosystem,
      name: mapping.name,
      version: mapping.version,
      target: mapping.target,
      status: "ready",
      reason: null,
      backendPlan,
      archives,
      coreArtifacts: result.coreArtifacts,
      identity,
    });
  }

  const index = {
    schemaVersion: 1,
    mode: "no-publish",
    createdAt: new Date(manifest.provenance.sourceDateEpoch * 1000).toISOString(),
    bundle: {
      component: manifest.component.id,
      version: manifest.component.version,
      canonicalManifestSha256: manifestSha256,
      coreArtifactSetSha256: core.identitySha256,
      sourceRevision: manifest.source.revision,
      flakeLock: manifest.locks.flake,
      graphLock: manifest.locks.graph,
      bindingIr: {
        path: manifest.bindingIr.path,
        fileSha256: manifest.bindingIr.fileSha256,
        semanticSha256: manifest.bindingIr.semanticSha256,
      },
      runtime: {
        abiVersion: manifest.runtime.abiVersion,
        leanCommit: manifest.runtime.leanCommit,
        patchSetSha256: manifest.runtime.patchSetSha256,
        profile: manifest.runtime.profile,
        scope: manifest.runtime.scope,
      },
    },
    publication: {
      networkAccess: false,
      externalRegistryWrites: false,
      ready: packages.filter(item => item.status === "ready").length,
      omitted: packages.filter(item => item.status === "omitted").length,
    },
    attestation: {
      path: "publication-index.intoto.json",
      predicateType,
    },
    packages,
  };
  validatePublicationIndex(index);
  const indexSource = canonicalJson(index);
  const indexSha256 = sha256(indexSource);
  await writeFile(join(output, "publication-index.json"), indexSource);
  await writeFile(join(output, "publication-index.sha256"), `${indexSha256}  publication-index.json\n`);

  const archiveSubjects = packages
    .flatMap(item => item.archives)
    .map(archive => ({ name: archive.path, digest: { sha256: archive.sha256 } }));
  const planSubjects = packages
    .filter(item => item.backendPlan !== null)
    .map(item => ({ name: item.backendPlan.path, digest: { sha256: item.backendPlan.sha256 } }));
  const attestation = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [
      { name: "publication-index.json", digest: { sha256: indexSha256 } },
      ...archiveSubjects,
      ...planSubjects,
    ],
    predicateType,
    predicate: {
      mode: "no-publish",
      externalRegistryWrites: false,
      networkAccess: false,
      bundle: index.bundle,
      packages: packages.map(item => ({
        ecosystem: item.ecosystem,
        name: item.name,
        version: item.version,
        status: item.status,
        identity: item.identity,
      })),
    },
  };
  const attestationSource = canonicalJson(attestation);
  await writeFile(join(output, index.attestation.path), attestationSource);

  return Object.freeze({
    output,
    index: join(output, "publication-index.json"),
    indexSha256,
    attestation: join(output, index.attestation.path),
    attestationSha256: sha256(attestationSource),
    ready: index.publication.ready,
    omitted: index.publication.omitted,
    archives: Object.freeze(packages.flatMap(item => item.archives.map(archive => join(output, archive.path)))),
  });
};
