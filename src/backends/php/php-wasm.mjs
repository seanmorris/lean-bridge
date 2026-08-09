import { createHash } from "node:crypto";
import { posix } from "node:path";

import { canonicalJson } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import { generatePhpNativeRuntimePackage } from "./native-runtime.mjs";
import {
  assertPhpTransportSupported,
  compilePhpProjection,
  compilePhpTransportManifest,
} from "./projection.mjs";
import { generatePhpZendExtensionPackage } from "./zend-extension.mjs";

export class PhpWasmGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PhpWasmGenerationError";
    this.code = code;
    this.details = Object.freeze(structuredClone(details));
  }
}

const fail = (code, message, details = {}) => {
  throw new PhpWasmGenerationError(code, message, details);
};

const sha256 = value => createHash("sha256").update(value).digest("hex");
const hashPattern = /^[0-9a-f]{64}$/;
const phpVersionPattern = /^8\.[2-9]$/;

const requireArtifact = (value, path) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid-php-wasm-artifact", `${path} must be an object`, { path });
  }
  const required = ["name", "file", "sha256"];
  const missing = required.filter(key => !(key in value));
  const unknown = Object.keys(value).filter(key => !required.includes(key));
  if (missing.length || unknown.length) {
    fail("invalid-php-wasm-artifact", `${path} has missing or unknown fields`, { path, missing, unknown });
  }
  if (
    typeof value.name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value.name) ||
    typeof value.file !== "string" || !/^lib\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value.file) ||
    posix.normalize(value.file) !== value.file ||
    typeof value.sha256 !== "string" || !hashPattern.test(value.sha256)
  ) {
    fail("invalid-php-wasm-artifact", `${path} contains an invalid name, file, or hash`, { path, value });
  }
};

const graphRuntime = graph => {
  const runtime = graph.libraries[0]?.capsule.runtime;
  if (!runtime) fail("empty-php-wasm-graph", "PHP-Wasm transport requires at least one locked library");
  return {
    abiVersion: runtime.abiVersion,
    leanCommit: runtime.leanCommit,
    patchSetSha256: runtime.patchSetSha256,
  };
};

const graphLibrary = (library, target) => {
  const artifact = library.capsule.artifacts.targets.find(candidate => candidate.target === target)?.sideModule;
  if (!artifact) {
    fail("missing-php-wasm-target", `${library.id} has no ${target} side module`, {
      component: library.id,
      target,
    });
  }
  return {
    role: "lean-component",
    component: library.id,
    componentSha256: library.sha256,
    dependencies: library.capsule.dependencies.map(dependency => dependency.id),
    name: artifact.file.split("/").at(-1),
    file: `lib/${artifact.file}`,
    sha256: artifact.sha256,
    initializer: library.capsule.initializer.mode === "required"
      ? library.capsule.initializer.symbol
      : null,
    ini: false,
  };
};

const assertUniqueAssets = libraries => {
  const names = new Map();
  for (const library of libraries) {
    if (names.has(library.name)) {
      fail("duplicate-php-wasm-library-name", `${library.name} identifies two PHP-Wasm assets`, {
        name: library.name,
        roles: [names.get(library.name), library.role],
      });
    }
    names.set(library.name, library.role);
  }
};

const hostSource = `import { WeakerMap } from "weaker";

const protocol = 1;
const hostProperty = "__leanBridgePhpWasmHostV1";
const bootstrapProperty = "__leanBridgePhpWasmBootstrapV1";

export class PhpWasmHostError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PhpWasmHostError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const runtimeKey = manifest => [
  manifest.runtime.abiVersion,
  manifest.runtime.leanCommit,
  manifest.runtime.patchSetSha256,
].join(":");

class PhpWasmLeanHost {
  constructor(module, manifest) {
    if (!module || !module.HEAPU8 || !module.HEAPU8.buffer) {
      throw new PhpWasmHostError("missing-shared-memory", "PHP-Wasm Module does not expose its Emscripten memory");
    }
    this.protocol = protocol;
    this.module = module;
    this.memory = module.HEAPU8.buffer;
    this.table = module.wasmTable ?? module.__indirect_function_table ?? module.asm?.__indirect_function_table ?? null;
    this.runtimeKey = runtimeKey(manifest);
    this.runtimeState = "cold";
    this.runtimeInitRuns = 0;
    this.graphs = new Map();
    this.componentDefinitions = new Map();
    this.components = new Map();
    this.byObject = new WeakMap();
    this.byIdentity = new WeakerMap();
    this.nextIdentity = 0;
    this.requestActive = false;
    this.requestGeneration = 0;
    this.requestCleanups = [];
    this.attachManifest(manifest);
    module.onRefresh?.add(() => this.invalidateRequest("refresh"));
  }

  attachManifest(manifest) {
    if (!manifest || manifest.hostProtocol !== protocol) {
      throw new PhpWasmHostError("host-protocol-mismatch", "PHP-Wasm Lean manifest uses another host protocol");
    }
    if (runtimeKey(manifest) !== this.runtimeKey) {
      throw new PhpWasmHostError("shared-runtime-conflict", "Lean package requires another shared runtime", {
        expected: this.runtimeKey,
        actual: runtimeKey(manifest),
      });
    }
    const existingGraph = this.graphs.get(manifest.graph.sha256);
    if (existingGraph) return this;
    for (const library of manifest.graph.libraries) {
      const existing = this.componentDefinitions.get(library.id);
      if (existing && existing.sha256 !== library.sha256) {
        throw new PhpWasmHostError("component-content-conflict", "Two graphs select different component content", {
          component: library.id,
          expected: existing.sha256,
          actual: library.sha256,
        });
      }
      this.componentDefinitions.set(library.id, Object.freeze({
        id: library.id,
        sha256: library.sha256,
        dependencies: Object.freeze([...library.dependencies]),
      }));
    }
    this.graphs.set(manifest.graph.sha256, manifest.graph.id);
    return this;
  }

  initializeRuntime(initializer) {
    if (this.runtimeState === "ready") return false;
    if (this.runtimeState === "failed") {
      throw new PhpWasmHostError("runtime-initialization-failed", "Shared Lean runtime initialization already failed");
    }
    if (this.runtimeState === "initializing") {
      throw new PhpWasmHostError("runtime-initialization-reentry", "Shared Lean runtime initialization re-entered");
    }
    if (typeof initializer !== "function") {
      throw new PhpWasmHostError("invalid-runtime-initializer", "Shared Lean runtime initializer must be callable");
    }
    this.runtimeState = "initializing";
    this.runtimeInitRuns += 1;
    try {
      if (!initializer()) throw new Error("initializer returned false");
      this.runtimeState = "ready";
      return true;
    } catch (error) {
      this.runtimeState = "failed";
      throw new PhpWasmHostError("runtime-initialization-failed", "Shared Lean runtime initialization failed", { cause: error.message });
    }
  }

  initializeComponent(id, initializer) {
    const definition = this.componentDefinitions.get(id);
    if (!definition) {
      throw new PhpWasmHostError("component-not-locked", "Component is absent from every attached graph", { component: id });
    }
    if (this.runtimeState !== "ready") {
      throw new PhpWasmHostError("runtime-not-ready", "Shared Lean runtime must initialize before a component", { component: id });
    }
    const state = this.components.get(id);
    if (state === "ready") return false;
    if (state === "failed") {
      throw new PhpWasmHostError("component-initialization-failed", "Component initialization already failed", { component: id });
    }
    for (const dependency of definition.dependencies) {
      if (this.components.get(dependency) !== "ready") {
        throw new PhpWasmHostError("component-dependency-not-ready", "Component dependency is not initialized", {
          component: id,
          dependency,
        });
      }
    }
    if (typeof initializer !== "function") {
      throw new PhpWasmHostError("invalid-component-initializer", "Component initializer must be callable", { component: id });
    }
    this.components.set(id, "initializing");
    try {
      if (!initializer()) throw new Error("initializer returned false");
      this.components.set(id, "ready");
      return true;
    } catch (error) {
      this.components.set(id, "failed");
      throw new PhpWasmHostError("component-initialization-failed", "Component initialization failed", {
        component: id,
        cause: error.message,
      });
    }
  }

  targetIdentity(value) {
    if ((typeof value !== "object" || value === null) && typeof value !== "function") {
      throw new PhpWasmHostError("identity-requires-object", "Only objects and functions have host identity");
    }
    const existing = this.byObject.get(value);
    if (existing !== undefined && this.byIdentity.get(existing) === value) return existing;
    const identity = ++this.nextIdentity;
    this.byObject.set(value, identity);
    this.byIdentity.set(identity, value);
    return identity;
  }

  target(identity) {
    return this.byIdentity.get(identity);
  }

  releaseTarget(identity) {
    const value = this.byIdentity.get(identity);
    if (value === undefined) return false;
    this.byObject.delete(value);
    this.byIdentity.delete(identity);
    return true;
  }

  beginRequest() {
    if (this.requestActive) throw new PhpWasmHostError("request-reentry", "PHP request is already active");
    this.requestGeneration += 1;
    this.requestActive = true;
    this.requestCleanups = [];
    return this.requestGeneration;
  }

  ownForRequest(cleanup) {
    if (!this.requestActive || typeof cleanup !== "function") {
      throw new PhpWasmHostError("request-not-active", "Request cleanup requires an active PHP request");
    }
    this.requestCleanups.push(cleanup);
  }

  bindRequestCallback(callback) {
    if (!this.requestActive || typeof callback !== "function") {
      throw new PhpWasmHostError("request-not-active", "Callback binding requires an active PHP request");
    }
    const generation = this.requestGeneration;
    return (...argumentsList) => {
      if (!this.requestActive || this.requestGeneration !== generation) {
        throw new PhpWasmHostError("stale-request-callback", "Callback belongs to an expired PHP request");
      }
      return callback(...argumentsList);
    };
  }

  endRequest() {
    if (!this.requestActive) return false;
    let failure;
    for (const cleanup of [...this.requestCleanups].reverse()) {
      try { cleanup(); } catch (error) { failure ??= error; }
    }
    this.requestCleanups = [];
    this.requestActive = false;
    this.requestGeneration += 1;
    if (failure) throw new PhpWasmHostError("request-cleanup-failed", "PHP request cleanup failed", { cause: failure.message });
    return true;
  }

  invalidateRequest() {
    if (this.requestActive) return this.endRequest();
    this.requestGeneration += 1;
    return false;
  }

  snapshot() {
    return Object.freeze({
      protocol,
      runtimeState: this.runtimeState,
      runtimeInitRuns: this.runtimeInitRuns,
      graphs: this.graphs.size,
      components: [...this.components].filter(([, state]) => state === "ready").map(([id]) => id).sort(),
      identities: this.byIdentity.size,
      requestActive: this.requestActive,
      requestGeneration: this.requestGeneration,
    });
  }
}

export const installPhpWasmLeanHost = (module, manifests) => {
  const list = Array.isArray(manifests) ? manifests : [manifests];
  if (list.length === 0) throw new PhpWasmHostError("missing-manifest", "PHP-Wasm Lean host requires a manifest");
  const existing = module?.[hostProperty];
  if (existing !== undefined) {
    if (existing.protocol !== protocol || typeof existing.attachManifest !== "function") {
      throw new PhpWasmHostError("host-conflict", "PHP-Wasm Module already contains another Lean host");
    }
    for (const manifest of list) existing.attachManifest(manifest);
    return existing;
  }
  const host = new PhpWasmLeanHost(module, list[0]);
  for (const manifest of list.slice(1)) host.attachManifest(manifest);
  Object.defineProperty(module, hostProperty, { configurable: false, enumerable: false, writable: false, value: host });
  return host;
};

export const preparePhpWasmLeanHost = (wrapper, manifest) => {
  const args = wrapper?.phpArgs;
  if (!args || typeof args !== "object") {
    throw new PhpWasmHostError("missing-module-arguments", "PHP-Wasm wrapper does not expose module arguments");
  }
  let bootstrap = args[bootstrapProperty];
  if (bootstrap === undefined) {
    bootstrap = { protocol, weakerVersion: "0.0.10", manifests: new Map() };
    bootstrap.install = module => installPhpWasmLeanHost(module, [...bootstrap.manifests.values()]);
    args[bootstrapProperty] = bootstrap;
    args.__leanBridgeInstallPhpWasmHostV1 = bootstrap.install;
  }
  if (bootstrap.protocol !== protocol || bootstrap.weakerVersion !== "0.0.10") {
    throw new PhpWasmHostError("bootstrap-conflict", "PHP-Wasm wrapper already has an incompatible Lean bootstrap");
  }
  bootstrap.manifests.set(manifest.graph.sha256, manifest);
  args.WeakerMap ??= WeakerMap;
  return bootstrap;
};
`;

const phpWasmHostHeader = `#ifndef LEAN_BRIDGE_PHP_WASM_HOST_H
#define LEAN_BRIDGE_PHP_WASM_HOST_H

int lean_bridge_php_wasm_component_ready(const char *component_id);
int lean_bridge_php_wasm_request_begin(void);
void lean_bridge_php_wasm_request_end(void);

#endif
`;

const phpWasmHostC = `#include "lean_bridge_php_wasm_host.h"

#include <emscripten.h>

EM_JS(int, lean_bridge_php_wasm_component_ready, (const char *component_id), {
  try {
    if (typeof Module.__leanBridgeInstallPhpWasmHostV1 !== "function") return 0;
    const host = Module.__leanBridgeInstallPhpWasmHostV1(Module);
    host.initializeRuntime(() => true);
    host.initializeComponent(UTF8ToString(component_id), () => true);
    return 1;
  } catch (error) {
    console.error("Lean PHP-Wasm component attachment failed", error);
    return 0;
  }
});

EM_JS(int, lean_bridge_php_wasm_request_begin, (), {
  try {
    if (typeof Module.__leanBridgeInstallPhpWasmHostV1 !== "function") return 0;
    Module.__leanBridgeInstallPhpWasmHostV1(Module).beginRequest();
    return 1;
  } catch (error) {
    console.error("Lean PHP-Wasm request initialization failed", error);
    return 0;
  }
});

EM_JS(void, lean_bridge_php_wasm_request_end, (), {
  try {
    if (typeof Module.__leanBridgeInstallPhpWasmHostV1 === "function") {
      Module.__leanBridgeInstallPhpWasmHostV1(Module).endRequest();
    }
  } catch (error) {
    console.error("Lean PHP-Wasm request cleanup failed", error);
  }
});
`;

const adaptProvider = source => {
  const includeMarker = "#include \"lean_bridge_native_runtime.h\"";
  if (!source.includes(includeMarker)) fail("provider-adaptation-failed", "component provider lacks the shared runtime include");
  let adapted = source.replace(includeMarker, `${includeMarker}\n#include \"lean_bridge_php_wasm_host.h\"`);
  const marker = "  return LEAN_ALPHA_STATUS_OK;\n}\n\nstatic lean_alpha_status box_create";
  const replacement = "  if (!lean_bridge_php_wasm_component_ready(component_id)) {\n    return fail(LEAN_ALPHA_STATUS_RUNTIME_REJECTED, LEAN_ALPHA_ERROR_UNEXPECTED, \"the PHP-Wasm host rejected Alpha attachment\", error);\n  }\n  return LEAN_ALPHA_STATUS_OK;\n}\n\nstatic lean_alpha_status box_create";
  if (!adapted.includes(marker)) fail("provider-adaptation-failed", "component provider initialization shape changed");
  adapted = adapted.replace(marker, replacement);
  return adapted.replaceAll("shared native Lean runtime", "shared Lean runtime");
};

const adaptZend = source => {
  const includeMarker = "#include \"lean_bridge_native_runtime.h\"";
  if (!source.includes(includeMarker)) fail("zend-adaptation-failed", "Zend adapter lacks the shared runtime include");
  let adapted = source.replace(includeMarker, `${includeMarker}\n#include \"lean_bridge_php_wasm_host.h\"`);
  const infoMarker = "PHP_MINFO_FUNCTION(lean_alpha)";
  const requestHooks = `PHP_RINIT_FUNCTION(lean_alpha)\n{\n    return lean_bridge_php_wasm_request_begin() ? SUCCESS : FAILURE;\n}\n\nPHP_RSHUTDOWN_FUNCTION(lean_alpha)\n{\n    lean_bridge_php_wasm_request_end();\n    return SUCCESS;\n}\n\n`;
  if (!adapted.includes(infoMarker)) fail("zend-adaptation-failed", "Zend adapter module info shape changed");
  adapted = adapted.replace(infoMarker, `${requestHooks}${infoMarker}`);
  const entryMarker = "    PHP_MSHUTDOWN(lean_alpha),\n    NULL,\n    NULL,\n    PHP_MINFO(lean_alpha),";
  const entryReplacement = "    PHP_MSHUTDOWN(lean_alpha),\n    PHP_RINIT(lean_alpha),\n    PHP_RSHUTDOWN(lean_alpha),\n    PHP_MINFO(lean_alpha),";
  if (!adapted.includes(entryMarker)) fail("zend-adaptation-failed", "Zend adapter request hook slots changed");
  return adapted
    .replace(entryMarker, entryReplacement)
    .replaceAll("Lean lean_alpha native transport", "Lean lean_alpha PHP-Wasm transport");
};

const versionModule = ({ version, libraries, files }) => `import manifest from "../manifest.mjs";
import { preparePhpWasmLeanHost } from "../host.mjs";

const prepare = php => preparePhpWasmLeanHost(php, manifest);

export const getLibs = php => {
  prepare(php);
  return ${JSON.stringify(libraries.map(library => ({ name: library.name, file: library.file, ini: library.ini })), null, 2)}.map(library => ({
    name: library.name,
    url: new URL(\`../\${library.file}\`, import.meta.url),
    ini: library.ini,
  }));
};

export const getFiles = php => {
  prepare(php);
  return ${JSON.stringify(files, null, 2)}.map(file => ({
    name: file.name,
    path: file.path,
    url: new URL(\`../\${file.file}\`, import.meta.url),
  }));
};

export default { getLibs, getFiles, phpVersion: ${JSON.stringify(version)} };
`;

const indexModule = versions => `import phpWasmHostManifest from "./php-wasm-manifest.json" with { type: "json" };
${versions.map(version => `import php${version.replace(".", "_")} from "./versions/${version}.mjs";`).join("\n")}

const versions = new Map([${versions.map(version => `[${JSON.stringify(version)}, php${version.replace(".", "_")}]`).join(", ")}]);
const select = php => versions.get(php.phpVersion) ?? (() => { throw new Error(\`No generated Lean PHP-Wasm adapter for PHP \${php.phpVersion}\`); })();

export const getLibs = php => select(php).getLibs(php);
export const getFiles = php => select(php).getFiles(php);
export { phpWasmHostManifest };
export default { getLibs, getFiles };
`;

export const generatePhpWasmAdapterPackage = ({
  ir,
  graph,
  target = "browser",
  runtime,
  extensions,
}) => {
  validateBindingIr(ir);
  if (!graph || !Array.isArray(graph.libraries) || !Array.isArray(graph.order)) {
    fail("invalid-php-wasm-graph", "PHP-Wasm generation requires a resolved locked graph");
  }
  if (!new Set(["side-startup", "side-lazy"]).has(graph.profile)) {
    fail("invalid-php-wasm-profile", "PHP-Wasm adapter requires a side-module graph", { profile: graph.profile });
  }
  if (!graph.order.includes(ir.component.id)) {
    fail("component-absent-from-graph", `${ir.component.id} is absent from the resolved graph`);
  }
  requireArtifact(runtime, "runtime");
  const runtimeIdentity = graphRuntime(graph);
  if (runtime.abiVersion !== undefined || runtime.leanCommit !== undefined || runtime.patchSetSha256 !== undefined) {
    fail("invalid-php-wasm-artifact", "runtime artifact identity comes from the locked graph, not ad hoc fields");
  }
  if (extensions === null || typeof extensions !== "object" || Array.isArray(extensions)) {
    fail("invalid-php-wasm-extensions", "PHP-Wasm extensions must be keyed by PHP version");
  }
  const versions = Object.keys(extensions).sort();
  if (versions.length === 0 || versions.some(version => !phpVersionPattern.test(version))) {
    fail("invalid-php-wasm-extensions", "PHP-Wasm adapter requires PHP 8.2 or newer extension artifacts");
  }
  for (const version of versions) requireArtifact(extensions[version], `extensions.${version}`);

  const projection = compilePhpProjection(ir);
  const transport = assertPhpTransportSupported(compilePhpTransportManifest(projection, {
    id: "php-wasm-v1",
    capabilities: projection.requiredCapabilities,
  }));
  const graphLibraries = graph.libraries.map(library => graphLibrary(library, target));
  const metadataPrefix = `/preload/lean-bridge/${graph.graphId.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
  const metadataFiles = [
    { name: "graph.json", file: "metadata/graph.json", path: `${metadataPrefix}/graph.json` },
    { name: "binding-ir.json", file: "metadata/binding-ir.json", path: `${metadataPrefix}/binding-ir.json` },
    ...graph.libraries.map((library, index) => ({
      name: `${index.toString().padStart(3, "0")}-${library.id.replace(/[^A-Za-z0-9._-]+/g, "_")}.capsule.json`,
      file: `metadata/capsules/${index.toString().padStart(3, "0")}.json`,
      path: `${metadataPrefix}/capsules/${index.toString().padStart(3, "0")}.json`,
    })),
  ];
  const graphRecord = {
    id: graph.graphId,
    sha256: sha256(canonicalJson(graph)),
    profile: graph.profile,
    roots: graph.roots,
    order: graph.order,
    libraries: graph.libraries.map(library => ({
      id: library.id,
      sha256: library.sha256,
      dependencies: library.capsule.dependencies.map(dependency => dependency.id),
      initializer: library.capsule.initializer.mode === "required" ? library.capsule.initializer.symbol : null,
    })),
  };
  const versionRecords = {};
  for (const version of versions) {
    const libraries = [
      { role: "lean-runtime", component: null, dependencies: [], ...runtime, ini: false },
      ...graphLibraries,
      { role: "php-extension", component: ir.component.id, dependencies: [...graph.order], ...extensions[version], ini: true },
    ];
    assertUniqueAssets(libraries);
    versionRecords[version] = { libraries, files: metadataFiles };
  }
  const manifest = {
    schemaVersion: 1,
    hostProtocol: 1,
    component: ir.component.id,
    bindingIrSha256: hashBindingIr(ir),
    target,
    transport,
    runtime: runtimeIdentity,
    graph: graphRecord,
    weaker: {
      package: "weaker",
      version: "0.0.10",
      sourceCommit: "8e147cc8832589f582ab61a12b9c429dee1e15b0",
    },
    lifecycle: {
      runtime: "php-wasm-host",
      component: "initialize-once-per-shared-runtime",
      phpProjection: "request",
      explicitClose: true,
      weakFinalization: "fallback-only",
    },
    versions: versionRecords,
  };

  const nativeZend = generatePhpZendExtensionPackage(ir);
  const nativeRuntime = generatePhpNativeRuntimePackage(ir);
  const files = {
    "host.mjs": hostSource,
    "manifest.mjs": `const manifest = ${JSON.stringify(manifest, null, 2)};\nexport default manifest;\n`,
    "metadata/graph.json": canonicalJson(graph),
    "metadata/binding-ir.json": `${JSON.stringify(ir, null, 2)}\n`,
    "include/lean_bridge_php_wasm_host.h": phpWasmHostHeader,
    "src/lean_bridge_php_wasm_host.c": phpWasmHostC,
  };
  graph.libraries.forEach((library, index) => {
    files[`metadata/capsules/${index.toString().padStart(3, "0")}.json`] = `${JSON.stringify(library.capsule, null, 2)}\n`;
  });
  for (const [path, source] of Object.entries(nativeZend)) {
    if (path === "zend-manifest.json") continue;
    files[`extension/${path}`] = path.endsWith("_zend.c") ? adaptZend(source) : source;
  }
  const providerPath = Object.keys(nativeRuntime).find(path => /src\/.+_native\.c$/.test(path));
  files[`extension/${providerPath}`] = adaptProvider(nativeRuntime[providerPath]);
  files["extension/lean_bridge_native_runtime.h"] = nativeRuntime["include/lean_bridge_native_runtime.h"];
  for (const version of versions) files[`versions/${version}.mjs`] = versionModule({ version, ...versionRecords[version] });
  files["index.mjs"] = indexModule(versions);
  files["package.json"] = `${JSON.stringify({
    name: `php-wasm-${ir.component.name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}`,
    version: ir.component.version,
    type: "module",
    exports: { ".": "./index.mjs", "./host": "./host.mjs", "./manifest": "./php-wasm-manifest.json" },
    dependencies: { weaker: "0.0.10" },
  }, null, 2)}\n`;

  const generatedFiles = Object.keys(files).sort();
  const generatedHashes = Object.fromEntries(generatedFiles.map(path => [path, sha256(files[path])]));
  files["php-wasm-manifest.json"] = `${JSON.stringify({
    ...manifest,
    generator: { id: "lean-wasm/php-wasm", version: 1 },
    sharedCodeBase: {
      phpProjection: "lean-wasm/php",
      zendAdapter: "lean-wasm/php-zend",
      cBinding: "lean-wasm/c",
      componentProvider: "lean-wasm/php-native-runtime",
    },
    generatedFiles,
    generatedHashes,
  }, null, 2)}\n`;
  return Object.freeze(files);
};
