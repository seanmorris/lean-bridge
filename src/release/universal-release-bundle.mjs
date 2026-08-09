import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import { parseBindingIr } from "../binding-ir/canonical.mjs";
import { generateBindingPackages } from "../binding-ir/package-gate.mjs";
import { compileJavaScriptProjection } from "../backends/javascript/projection.mjs";
import { alphaPrivateAbi } from "../../poc/lean-link-spike/private-abi.mjs";
import {
  canonicalPackageManifestJson,
  hashCanonicalPackageManifest,
  validateCanonicalPackageManifest,
} from "./canonical-package-manifest.mjs";
import {
  createCoreArtifactSetManifest,
  validateCoreArtifactSetManifest,
} from "./core-artifact-set.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;

const mediaTypeFor = path => {
  if (path.endsWith(".wasm")) return "application/wasm";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".md")) return "text/markdown";
  if (path.endsWith(".lean")) return "text/x-lean";
  if (path.endsWith(".mjs")) return "text/javascript";
  if (path.endsWith(".ts")) return "text/typescript";
  if (path.endsWith(".c") || path.endsWith(".h")) return "text/x-c";
  if (path.endsWith(".rs")) return "text/x-rust";
  if (path.endsWith(".py")) return "text/x-python";
  if (path.endsWith(".php")) return "application/x-httpd-php";
  return "text/plain";
};

const artifactId = (prefix, path) => {
  const stem = path.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[^a-z0-9]+/, "");
  return `${prefix}-${stem}-${sha256(path).slice(0, 8)}`;
};

const write = async (root, path, value) => {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, value);
};

const copy = async (root, path, source) => {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
};

const record = async (root, { id, path, role, target = null, core = false }) => {
  const absolute = join(root, path);
  const [bytes, facts] = await Promise.all([readFile(absolute), stat(absolute)]);
  return {
    id,
    path,
    mediaType: mediaTypeFor(path),
    role,
    target,
    bytes: facts.size,
    sha256: sha256(bytes),
    core,
    executable: (facts.mode & 0o111) !== 0,
  };
};

const generatedReadme = component => `# ${component.name}\n\nThis immutable bundle contains the compiled shared-runtime component, generated host bindings, proof and trust metadata, locked inputs, SBOM, and provenance for ${component.id}. Registry backends may arrange these files, but they cannot compile or alter the core artifacts.\n`;

const coreLayout = Object.freeze([
  Object.freeze({ source: "lazy/main.mjs", path: "artifacts/browser/runtime.mjs", id: "browser-runtime-loader", role: "runtime" }),
  Object.freeze({ source: "lazy/main.wasm", path: "artifacts/browser/runtime.wasm", id: "browser-runtime-wasm", role: "runtime" }),
  Object.freeze({ source: "lazy/alpha.so.wasm", path: "artifacts/browser/alpha.so.wasm", id: "browser-alpha-component", role: "component" }),
  Object.freeze({ source: "lazy/beta.so.wasm", path: "artifacts/browser/beta.so.wasm", id: "browser-beta-component", role: "component" }),
  Object.freeze({ source: "lazy/gamma.so.wasm", path: "artifacts/browser/gamma.so.wasm", id: "browser-gamma-component", role: "component" }),
]);

const ensureEmptyOutput = async output => {
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length !== 0) throw new Error(`release bundle output is not empty: ${output}`);
};

export const buildUniversalReleaseBundle = async ({
  projectRoot,
  coreRoot,
  outputRoot,
  revision,
  sourceDateEpoch = 1786261809,
  builder = "nix-flake-v1",
}) => {
  const root = resolve(projectRoot);
  const core = resolve(coreRoot);
  const output = resolve(outputRoot);
  if (output === root || output === dirname(root)) throw new Error("refusing to replace the project tree with a release bundle");
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error("source revision must be a 40-character Git identity");
  await ensureEmptyOutput(output);

  const [irSource, graphSource, flakeSource, leanSource, licenseSource, toolchainSource] = await Promise.all([
    readFile(join(root, "poc/lean-link-spike/bindings/alpha.binding-ir.json")),
    readFile(join(root, "poc/lean-link-spike/graph-lock.json")),
    readFile(join(root, "flake.lock")),
    readFile(join(root, "poc/lean-link-spike/Alpha.lean")),
    readFile(join(root, "LICENSE")),
    readFile(join(root, "nix/wasm-toolchain.nix")),
  ]);
  const ir = parseBindingIr(irSource.toString("utf8"));
  const graph = JSON.parse(graphSource);
  const coreManifest = await createCoreArtifactSetManifest(core);
  validateCoreArtifactSetManifest(coreManifest);
  const alphaLibrary = graph.libraries.find(library => library.id === ir.component.id);
  if (!alphaLibrary) throw new Error(`graph lock does not contain ${ir.component.id}`);

  const artifacts = [];
  for (const item of coreLayout) {
    await copy(output, item.path, join(core, item.source));
    artifacts.push(await record(output, { ...item, target: "node-esm", core: true }));
  }

  const fixedFiles = [
    ["source/Alpha.lean", leanSource, "lean-source", "source"],
    ["locks/flake.lock", flakeSource, "flake-lock", "lock"],
    ["locks/graph-lock.json", graphSource, "graph-lock", "lock"],
    ["binding-ir/alpha.binding-ir.json", irSource, "binding-ir", "binding"],
    ["schema/binding-ir.schema.json", await readFile(join(root, "schema/binding-ir.schema.json")), "binding-ir-schema", "schema"],
    ["schema/canonical-package-manifest.schema.json", await readFile(join(root, "schema/canonical-package-manifest.schema.json")), "canonical-manifest-schema", "schema"],
    ["validators/src/release/canonical-package-manifest.mjs", await readFile(join(root, "src/release/canonical-package-manifest.mjs")), "canonical-manifest-validator", "validator"],
    ["validators/src/capsule/node.mjs", await readFile(join(root, "src/capsule/node.mjs")), "validator-capsule-node", "validator"],
    ["validators/src/capsule/contract.mjs", await readFile(join(root, "src/capsule/contract.mjs")), "validator-capsule-contract", "validator"],
    ["validators/src/binding-ir/canonical.mjs", await readFile(join(root, "src/binding-ir/canonical.mjs")), "validator-binding-ir-canonical", "validator"],
    ["validators/src/binding-ir/contract.mjs", await readFile(join(root, "src/binding-ir/contract.mjs")), "validator-binding-ir-contract", "validator"],
    ["docs/README.md", generatedReadme(ir.component), "package-readme", "documentation"],
    ["LICENSE", licenseSource, "license", "license"],
  ];
  for (const [path, value, id, role] of fixedFiles) {
    await write(output, path, value);
    artifacts.push(await record(output, { id, path, role }));
  }

  const bindingArtifacts = new Map();
  for (const [backend, files] of Object.entries(generateBindingPackages(ir)).sort(([left], [right]) => left.localeCompare(right))) {
    const ids = [];
    for (const [packagePath, source] of Object.entries(files).sort(([left], [right]) => left.localeCompare(right))) {
      const path = `bindings/${backend}/${packagePath}`;
      const id = artifactId(`binding-${backend}`, packagePath);
      await write(output, path, source);
      artifacts.push(await record(output, {
        id,
        path,
        role: packagePath.endsWith("README.md") ? "documentation" : "binding",
        target: backend === "javascript" ? "node-esm" : "native-ffi",
      }));
      ids.push(id);
    }
    bindingArtifacts.set(backend, ids);
  }

  const alphaCapsule = JSON.parse(await readFile(join(root, "poc/lean-link-spike/capsules/alpha.json"), "utf8"));
  const alphaProjection = compileJavaScriptProjection(ir, alphaPrivateAbi);
  if (alphaProjection.bindingIrSha256 !== alphaLibrary.bindingIr.semanticSha256) {
    throw new Error("JavaScript runtime descriptor differs from the locked Binding IR");
  }
  const runtimeDescriptor = {
    schemaVersion: 1,
    id: alphaCapsule.id,
    buildHash: alphaLibrary.capsule.sha256,
    integrity: coreManifest.files.find(file => file.path === "lazy/alpha.so.wasm")?.sha256,
    dependencies: [],
    capsule: alphaCapsule,
    bindingIr: ir,
    bindingIrSha256: alphaProjection.bindingIrSha256,
    privateAbi: alphaPrivateAbi,
    bindings: alphaProjection.bindings,
  };
  if (typeof runtimeDescriptor.integrity !== "string") throw new Error("core artifact set has no Alpha side module");
  const runtimeSupport = [
    ["runtime/javascript/alpha-descriptor.json", json(runtimeDescriptor), "javascript-alpha-descriptor"],
    ["runtime/javascript/poc/link-spike/loader.mjs", await readFile(join(root, "poc/link-spike/loader.mjs")), "javascript-library-loader"],
    ["runtime/javascript/src/runtime/pending-operations.mjs", await readFile(join(root, "src/runtime/pending-operations.mjs")), "javascript-pending-operations"],
    ["runtime/javascript/src/runtime/callbacks.mjs", await readFile(join(root, "src/runtime/callbacks.mjs")), "javascript-callback-runtime"],
    ["runtime/javascript/src/runtime/weak-value-map.mjs", await readFile(join(root, "src/runtime/weak-value-map.mjs")), "javascript-weak-value-map"],
    ["runtime/javascript/src/binding-ir/canonical.mjs", await readFile(join(root, "src/binding-ir/canonical.mjs")), "javascript-binding-ir-canonical"],
    ["runtime/javascript/src/binding-ir/contract.mjs", await readFile(join(root, "src/binding-ir/contract.mjs")), "javascript-binding-ir-contract"],
  ];
  const runtimeSupportIds = [];
  for (const [path, value, id] of runtimeSupport) {
    await write(output, path, value);
    artifacts.push(await record(output, { id, path, role: "binding", target: "node-esm" }));
    runtimeSupportIds.push(id);
  }

  const assurance = {
    schemaVersion: 1,
    component: ir.component.id,
    bindingIrSha256: alphaLibrary.bindingIr.semanticSha256,
    claims: ir.assurance,
  };
  await write(output, "metadata/assurance.json", json(assurance));
  artifacts.push(await record(output, { id: "assurance", path: "metadata/assurance.json", role: "assurance" }));

  await write(output, "metadata/core-artifact-set.json", json(coreManifest));
  artifacts.push(await record(output, { id: "core-artifact-set", path: "metadata/core-artifact-set.json", role: "provenance" }));

  const sbom = {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `${ir.component.id}-release-bundle`,
    documentNamespace: `https://lean-bridge.invalid/spdx/${coreManifest.identitySha256}`,
    creationInfo: { creators: ["Tool: lean-bridge-universal-bundle/1"] },
    packages: [
      {
        SPDXID: "SPDXRef-LeanAlpha",
        name: ir.component.name,
        versionInfo: ir.component.version,
        downloadLocation: "NOASSERTION",
        licenseConcluded: "MIT",
        filesAnalyzed: false,
        checksums: [{ algorithm: "SHA256", checksumValue: coreManifest.identitySha256 }],
      },
    ],
  };
  await write(output, "metadata/sbom.spdx.json", json(sbom));
  artifacts.push(await record(output, { id: "sbom", path: "metadata/sbom.spdx.json", role: "sbom" }));

  const inputClosureSha256 = sha256(flakeSource);
  const toolchainSha256 = sha256(Buffer.concat([toolchainSource, graphSource]));
  const provenance = {
    _type: "https://in-toto.io/Statement/v1",
    subject: coreManifest.files.map(file => ({ name: file.path, digest: { sha256: file.sha256 } })),
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://lean-bridge.invalid/build-types/nix-flake-v1",
        externalParameters: { component: ir.component.id, profile: "side-lazy" },
        resolvedDependencies: [
          { uri: "git+https://github.com/seanmorris/lean-bridge", digest: { gitCommit: revision } },
          { uri: "file:flake.lock", digest: { sha256: inputClosureSha256 } },
          { uri: "file:graph-lock.json", digest: { sha256: sha256(graphSource) } },
        ],
      },
      runDetails: { builder: { id: builder }, metadata: { invocationId: coreManifest.identitySha256 } },
    },
  };
  await write(output, "metadata/provenance.intoto.json", json(provenance));
  artifacts.push(await record(output, { id: "provenance", path: "metadata/provenance.intoto.json", role: "provenance" }));

  const packages = [
    {
      ecosystem: "npm",
      name: "@lean-bridge/alpha",
      version: ir.component.version,
      target: "node-esm",
      eligible: true,
      reason: null,
      publicArtifacts: [
        "browser-runtime-loader",
        "browser-runtime-wasm",
        "browser-alpha-component",
        ...bindingArtifacts.get("javascript"),
        ...runtimeSupportIds,
        "license",
        "assurance",
        "core-artifact-set",
        "sbom",
        "provenance",
      ],
    },
    ...[
      ["cargo", "lean_bridge_alpha", "native-ffi"],
      ["pypi", "lean-bridge-alpha", "native-ffi"],
      ["c", "lean-bridge-alpha", "native-ffi"],
      ["cpp", "lean-bridge-alpha", "native-ffi"],
    ].map(([ecosystem, name, target]) => ({
      ecosystem,
      name,
      version: ir.component.version,
      target,
      eligible: false,
      reason: "The canonical bundle requires a registry projection before publication.",
      publicArtifacts: [],
    })),
  ];
  const docs = artifacts.filter(item => item.role === "documentation").map(item => item.id);
  const manifest = {
    schemaVersion: 1,
    component: ir.component,
    locks: {
      flake: { path: "locks/flake.lock", sha256: sha256(flakeSource), inputClosureSha256 },
      graph: { path: "locks/graph-lock.json", sha256: sha256(graphSource), id: graph.graphId, profile: "side-lazy" },
    },
    source: {
      repository: "https://github.com/seanmorris/lean-bridge",
      revision,
      path: "source/Alpha.lean",
      sha256: sha256(leanSource),
    },
    bindingIr: {
      schemaVersion: ir.schemaVersion,
      path: "binding-ir/alpha.binding-ir.json",
      fileSha256: sha256(irSource),
      semanticSha256: alphaLibrary.bindingIr.semanticSha256,
    },
    runtime: {
      abiVersion: graph.runtime.abiVersion,
      leanCommit: graph.runtime.leanCommit,
      patchSetSha256: graph.runtime.patchSetSha256,
      profile: "side-lazy",
      shared: true,
      scope: "wasm-main-module",
    },
    artifacts,
    targets: [
      {
        id: "node-esm",
        eligible: true,
        reason: null,
        platforms: ["wasm32-emscripten"],
        capabilities: ["callbacks", "copied-values", "identity-resources", "literal-wasm-assets", "promises", "shared-runtime"],
        entryPoints: [
          { name: "runtime", kind: "library", artifact: "browser-runtime-loader" },
          { name: "component", kind: "library", artifact: "browser-alpha-component" },
          { name: "types", kind: "types", artifact: "binding-ir" },
          { name: "documentation", kind: "documentation", artifact: "package-readme" },
        ],
      },
      {
        id: "native-ffi",
        eligible: false,
        reason: "This bundle contains generated native bindings but no native component library.",
        platforms: [],
        capabilities: ["copied-values", "identity-resources"],
        entryPoints: [],
      },
    ],
    dependencies: [],
    capabilities: {
      provided: ["callbacks", "copied-values", "identity-resources", "promises", "shared-runtime", "typed-bindings"],
      requiredHosts: ["javascript"],
      gaps: [{ target: "native-ffi", feature: "native-library-artifact", reason: "The current core derivation builds the Wasm shared-runtime profile." }],
    },
    packages,
    documentation: { generated: true, artifacts: docs },
    licenses: { expression: "MIT", artifacts: ["license"] },
    assurance: {
      artifact: "assurance",
      claims: ir.assurance.map(claim => ({
        id: claim.id,
        subject: claim.subject,
        state: claim.state,
        theorems: claim.theorems,
        assumptions: claim.assumptions,
        artifacts: ["browser-alpha-component", "assurance"],
      })),
    },
    provenance: {
      sourceDateEpoch,
      builder,
      toolchainSha256,
      inputClosureSha256,
      sbomArtifact: "sbom",
      attestationArtifact: "provenance",
    },
  };
  validateCanonicalPackageManifest(manifest);
  const canonical = canonicalPackageManifestJson(manifest);
  const manifestSha256 = hashCanonicalPackageManifest(manifest);
  await write(output, "canonical-package.json", `${canonical}\n`);
  await write(output, "canonical-package.sha256", `${manifestSha256}  canonical-package.json\n`);
  await write(output, "bundle-identity.json", json({
    schemaVersion: 1,
    component: ir.component.id,
    canonicalManifestSha256: manifestSha256,
    coreArtifactSetSha256: coreManifest.identitySha256,
  }));
  return Object.freeze({
    component: ir.component.id,
    output,
    manifestSha256,
    coreArtifactSetSha256: coreManifest.identitySha256,
    artifactCount: artifacts.length,
    generatedBackends: Object.freeze([...bindingArtifacts.keys()]),
  });
};

export const listBundleFiles = async bundleRoot => {
  const files = [];
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) files.push(relative(bundleRoot, absolute));
    }
  };
  await visit(bundleRoot);
  return files.sort();
};
