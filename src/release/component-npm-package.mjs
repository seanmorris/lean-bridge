import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { generateJavaScriptPackage } from "../backends/javascript/generate.mjs";
import { canonicalJson } from "../capsule/node.mjs";
import { validateComponentReleaseBundleManifest } from "./component-release-bundle.mjs";
import { createDeterministicTarGz } from "./deterministic-archive.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;

const ensureEmpty = async output => {
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length !== 0) throw new Error(`component npm output is not empty: ${output}`);
};

const copy = async (source, destination) => {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
};

const verifiedBundle = async bundleRoot => {
  const root = resolve(bundleRoot);
  const manifest = JSON.parse(await readFile(join(root, "component-release-bundle.json"), "utf8"));
  validateComponentReleaseBundleManifest(manifest);
  for (const item of manifest.files) {
    const bytes = await readFile(join(root, item.path));
    if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) {
      throw new Error(`component bundle file differs from its manifest: ${item.path}`);
    }
  }
  return Object.freeze({ root, manifest: Object.freeze(manifest), manifestSha256: sha256(canonicalJson(manifest)) });
};

const runtimeVersion = runtime =>
  `0.0.0-abi${runtime.abiVersion}.${runtime.leanCommit.slice(0, 12)}.${runtime.patchSetSha256.slice(0, 12)}`;

const runtimeModule = () => `import createMain from "./internal/main.mjs";

const mainWasm = new URL("./internal/main.wasm", import.meta.url);
const componentAssets = new Map();
const module = await createMain({
  locateFile(path) {
    if (path === "main.wasm") return mainWasm.href;
    return componentAssets.get(path) ?? path;
  },
});
if (!module._bridge_lean_runtime_init()) throw new Error("The shared Lean runtime failed to initialize");

const loaded = new Map();
const encoder = new TextEncoder();

const digest = async bytes => {
  const value = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, "0")).join("");
};

const readArtifact = async url => {
  if (url.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    return new Uint8Array(await readFile(url));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(\`Unable to read Lean component: HTTP \${response.status}\`);
  return new Uint8Array(await response.arrayBuffer());
};

const withBytes = (bytes, operation) => {
  const pointer = module._malloc(Math.max(1, bytes.length + 1));
  try {
    module.HEAP8.set(bytes, pointer);
    module.HEAP8[pointer + bytes.length] = 0;
    return operation(pointer, bytes.length);
  } finally {
    module._free(pointer);
  }
};

const withCString = (value, operation) => withBytes(encoder.encode(value), operation);

const checkCall = (component, result) => {
  const code = module._bridge_lean_component_last_error();
  if (code !== 0) throw new Error(\`Lean component \${component} rejected an internal call (\${code})\`);
  return result;
};

const compileCall = (descriptor, declaration, abi) => {
  const parameters = abi.parameters.map(type => type.kind === "primitive" ? type.name : null);
  const result = abi.result.kind === "primitive" ? abi.result.name : null;
  if (parameters.length === 2 && parameters.every(type => type === "nat") && result === "nat") {
    return args => {
      if (args.length !== 2) throw new TypeError(\`\${declaration.name} expects 2 arguments\`);
      return withCString(abi.symbol, pointer => checkCall(
        descriptor.id,
        module._bridge_lean_component_call_nat2_nat(pointer, args[0], args[1]),
      ));
    };
  }
  if (parameters.length === 1 && parameters[0] === "string" && result === "bool") {
    return args => {
      if (args.length !== 1) throw new TypeError(\`\${declaration.name} expects 1 argument\`);
      return withCString(abi.symbol, symbol => withBytes(encoder.encode(args[0]), (input, size) =>
        checkCall(descriptor.id, module._bridge_lean_component_call_string_bool(symbol, input, size)) === 1));
    };
  }
  throw new TypeError(\`The installed shared runtime does not support \${declaration.id}\`);
};

export const loadComponent = async descriptor => {
  const existing = loaded.get(descriptor.id);
  if (existing) {
    if (existing.buildHash !== descriptor.buildHash) throw new Error(\`Lean component identity conflict for \${descriptor.id}\`);
    return existing.runtime;
  }
  const bytes = await readArtifact(descriptor.sideModule);
  const actual = await digest(bytes);
  if (actual !== descriptor.integrity) throw new Error(\`Lean component integrity mismatch for \${descriptor.id}\`);
  const name = decodeURIComponent(descriptor.sideModule.pathname.split("/").at(-1));
  componentAssets.set(name, descriptor.sideModule.href);
  await module.loadDynamicLibrary(name, { global: true, loadAsync: true, nodelete: true });
  const initialized = withCString(descriptor.initializer, pointer =>
    module._bridge_lean_component_initialize(pointer));
  checkCall(descriptor.id, initialized);
  if (!initialized) throw new Error(\`Lean component initialization failed for \${descriptor.id}\`);

  const declarations = new Map(descriptor.bindingIr.declarations.map(item => [item.id, item]));
  const calls = new Map(descriptor.privateAbi.exports.map(item => {
    const declaration = declarations.get(item.bindingId);
    if (!declaration) throw new Error(\`Private binding does not match \${descriptor.id}\`);
    return [item.bindingId, compileCall(descriptor, declaration, item)];
  }));
  const requireCall = id => {
    const call = calls.get(id);
    if (!call) throw new TypeError(\`Unknown Lean declaration \${id}\`);
    return call;
  };
  const runtime = Object.freeze({
    call: (id, args) => requireCall(id)(args),
    method() { throw new TypeError("This component has no projected classes"); },
    construct() { throw new TypeError("This component has no projected classes"); },
    dispose() { return false; },
    iterate: (id, args) => requireCall(id)(args),
    iterateAsync: (id, args) => requireCall(id)(args),
  });
  loaded.set(descriptor.id, Object.freeze({ buildHash: descriptor.buildHash, runtime }));
  return runtime;
};
`;

const descriptorModule = ({ manifest, ir, abi, artifact, initializer }) => `const sideModule = new URL(${JSON.stringify(`./wasm/${basename(artifact.path)}`)}, import.meta.url);

export default Object.freeze({
  schemaVersion: 1,
  id: ${JSON.stringify(manifest.component.id)},
  buildHash: ${JSON.stringify(manifest.identitySha256)},
  integrity: ${JSON.stringify(artifact.sha256)},
  initializer: ${JSON.stringify(initializer)},
  sideModule,
  bindingIr: Object.freeze(${JSON.stringify(ir)}),
  privateAbi: Object.freeze(${JSON.stringify(abi)}),
});
`;

const componentRuntimeModule = () => `import { loadComponent } from "@lean-bridge/runtime";
import descriptor from "./descriptor.mjs";

export const runtime = await loadComponent(descriptor);
`;

export const buildComponentNpmPackages = async ({ bundleRoot, runtimeRoot, outputRoot }) => {
  const output = resolve(outputRoot);
  await ensureEmpty(output);
  const bundle = await verifiedBundle(bundleRoot);
  const runtime = resolve(runtimeRoot);
  const [ir, abi, artifactManifest, mainModule, mainWasm] = await Promise.all([
    readFile(join(bundle.root, "binding/binding-ir.json"), "utf8").then(JSON.parse),
    readFile(join(bundle.root, "binding/private-abi.json"), "utf8").then(JSON.parse),
    readFile(join(bundle.root, "metadata/component-artifact-manifest.json"), "utf8").then(JSON.parse),
    readFile(join(runtime, "main.mjs")),
    readFile(join(runtime, "main.wasm")),
  ]);
  const artifact = bundle.manifest.files.find(item => item.role === "component");
  const version = runtimeVersion(bundle.manifest.runtime);
  const runtimePackage = join(output, "runtime", "package");
  const componentPackage = join(output, "component", "package");
  await mkdir(join(runtimePackage, "internal"), { recursive: true });
  await Promise.all([
    writeFile(join(runtimePackage, "index.mjs"), runtimeModule()),
    writeFile(join(runtimePackage, "internal/main.mjs"), mainModule),
    writeFile(join(runtimePackage, "internal/main.wasm"), mainWasm),
    writeFile(join(runtimePackage, "package.json"), json({
      name: "@lean-bridge/runtime",
      version,
      description: "Shared Lean WebAssembly runtime for generated Lean Bridge packages.",
      type: "module",
      sideEffects: true,
      engines: { node: ">=22" },
      exports: { ".": "./index.mjs" },
      files: ["index.mjs", "internal"],
      leanBridge: { sharedRuntime: true, ...bundle.manifest.runtime },
    })),
  ]);

  const generated = generateJavaScriptPackage(ir);
  for (const [path, contents] of Object.entries(generated)) {
    await mkdir(dirname(join(componentPackage, path)), { recursive: true });
    await writeFile(join(componentPackage, path), contents);
  }
  const componentPackageJson = JSON.parse(generated["package.json"]);
  await writeFile(join(componentPackage, "package.json"), json({
    name: ir.component.name,
    ...componentPackageJson,
    version: ir.component.version,
    description: ir.documentation.summary,
    engines: { node: ">=22" },
    dependencies: { "@lean-bridge/runtime": version },
    leanBridge: {
      component: ir.component.id,
      componentBundleSha256: bundle.manifestSha256,
      componentIdentitySha256: bundle.manifest.identitySha256,
      bindingIrSha256: bundle.manifest.bindingIrSemanticSha256,
      sharedRuntime: true,
    },
  }));
  await writeFile(join(componentPackage, "internal/runtime.mjs"), componentRuntimeModule());
  await writeFile(join(componentPackage, "internal/descriptor.mjs"), descriptorModule({
    manifest: bundle.manifest,
    ir,
    abi,
    artifact,
    initializer: artifactManifest.structure.exports.internalInitializer,
  }));
  await copy(join(bundle.root, artifact.path), join(componentPackage, "internal/wasm", basename(artifact.path)));
  for (const [source, destination] of [
    ["component-release-bundle.json", "component-release-bundle.json"],
    ["binding/binding-ir.json", "binding-ir.json"],
    ["metadata/assurance.json", "assurance.json"],
    ["metadata/provenance.json", "provenance.json"],
    ["metadata/runtime-requirement.json", "runtime-requirement.json"],
  ]) await copy(join(bundle.root, source), join(componentPackage, "metadata", destination));

  const sourceDateEpoch = 1;
  const runtimeArchive = await createDeterministicTarGz({ directory: runtimePackage, archiveRoot: "package", sourceDateEpoch });
  const componentArchive = await createDeterministicTarGz({ directory: componentPackage, archiveRoot: "package", sourceDateEpoch });
  const runtimeArchivePath = join(output, `lean-bridge-runtime-${version}.tgz`);
  const componentArchivePath = join(output, `${ir.component.name.replaceAll("/", "-")}-${ir.component.version}.tgz`);
  await Promise.all([
    writeFile(runtimeArchivePath, runtimeArchive),
    writeFile(componentArchivePath, componentArchive),
  ]);
  const sourceManifest = bundle.manifest.files.find(item => item.path === "locks/component-build-plan.json");
  const provenance = bundle.manifest.files.find(item => item.path === "metadata/provenance.json");
  const runtimeRequirement = bundle.manifest.files.find(item => item.path === "metadata/runtime-requirement.json");
  const report = Object.freeze({
    schemaVersion: 1,
    kind: "lean-bridge-component-package-receipt",
    component: Object.freeze({ ...ir.component }),
    source: Object.freeze({ treeSha256: JSON.parse(await readFile(join(bundle.root, sourceManifest.path), "utf8")).source.treeSha256 }),
    bindingIrSha256: bundle.manifest.bindingIrSemanticSha256,
    provenanceSha256: provenance.sha256,
    componentBundleSha256: bundle.manifestSha256,
    componentIdentitySha256: bundle.manifest.identitySha256,
    componentArtifactSha256: artifact.sha256,
    runtimeRequirementSha256: runtimeRequirement.sha256,
    runtime: Object.freeze({ package: `@lean-bridge/runtime@${version}`, archive: basename(runtimeArchivePath), sha256: sha256(runtimeArchive) }),
    package: Object.freeze({ package: `${ir.component.name}@${ir.component.version}`, archive: basename(componentArchivePath), sha256: sha256(componentArchive) }),
    policies: Object.freeze({ componentCompiledOnce: true, runtimeShared: true, runtimeBinaryInComponent: false, nativeCallablesOnly: true }),
    verificationCommand: "lean-bridge verify-package-receipt --receipt component-package-receipt.json",
  });
  await writeFile(join(output, "component-package-receipt.json"), canonicalJson(report));
  return Object.freeze({ output, runtimeArchive: runtimeArchivePath, componentArchive: componentArchivePath, report });
};
