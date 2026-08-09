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
    file: `lib/components/${artifact.file}`,
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
        bindingIrSha256: library.id === manifest.component ? manifest.bindingIrSha256 : null,
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
    const separator = id.lastIndexOf("#");
    const componentId = separator === -1 ? id : id.slice(0, separator);
    const bindingIrSha256 = separator === -1 ? null : id.slice(separator + 1);
    const definition = this.componentDefinitions.get(componentId);
    if (!definition) {
      throw new PhpWasmHostError("component-not-locked", "Component is absent from every attached graph", { component: componentId });
    }
    if (bindingIrSha256 !== null && definition.bindingIrSha256 !== bindingIrSha256) {
      throw new PhpWasmHostError("component-binding-mismatch", "Component provider does not match the locked Binding IR", {
        component: componentId,
        expected: definition.bindingIrSha256,
        actual: bindingIrSha256,
      });
    }
    if (this.runtimeState !== "ready") {
      throw new PhpWasmHostError("runtime-not-ready", "Shared Lean runtime must initialize before a component", { component: componentId });
    }
    const state = this.components.get(componentId);
    if (state === "ready") return false;
    if (state === "failed") {
      throw new PhpWasmHostError("component-initialization-failed", "Component initialization already failed", { component: componentId });
    }
    for (const dependency of definition.dependencies) {
      if (this.components.get(dependency) !== "ready") {
        throw new PhpWasmHostError("component-dependency-not-ready", "Component dependency is not initialized", {
          component: componentId,
          dependency,
        });
      }
    }
    if (typeof initializer !== "function") {
      throw new PhpWasmHostError("invalid-component-initializer", "Component initializer must be callable", { component: id });
    }
    this.components.set(componentId, "initializing");
    try {
      if (!initializer()) throw new Error("initializer returned false");
      this.components.set(componentId, "ready");
      return true;
    } catch (error) {
      this.components.set(componentId, "failed");
      throw new PhpWasmHostError("component-initialization-failed", "Component initialization failed", {
        component: componentId,
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

const phpWasmLibuvC = `#include <stddef.h>
#include <stdint.h>
#include <lean/lean.h>
#include <uv.h>

/*
 * Lean's pinned WebAssembly libuv build deliberately leaves part of its
 * platform layer undefined. A main Emscripten module can tolerate those
 * symbols, but a dynamically loaded side module cannot. The PHP-Wasm
 * profile does not advertise Lean file-system support, so these entry points
 * form an explicit unsupported-operation boundary instead of pulling a
 * second system runtime into the shared PHP memory.
 */

static int lean_bridge_uv_unsupported(uv_fs_t *request) {
  if (request != NULL) request->result = UV_ENOSYS;
  return UV_ENOSYS;
}

const char *uv_strerror(int error) {
  (void)error;
  return "operation is unavailable in the PHP-Wasm Lean runtime profile";
}

void uv_fs_req_cleanup(uv_fs_t *request) {
  (void)request;
}

int uv_fs_stat(uv_loop_t *loop, uv_fs_t *request, const char *path, uv_fs_cb callback) {
  (void)loop; (void)path; (void)callback;
  return lean_bridge_uv_unsupported(request);
}

int uv_fs_lstat(uv_loop_t *loop, uv_fs_t *request, const char *path, uv_fs_cb callback) {
  (void)loop; (void)path; (void)callback;
  return lean_bridge_uv_unsupported(request);
}

int uv_fs_link(uv_loop_t *loop, uv_fs_t *request, const char *path, const char *new_path, uv_fs_cb callback) {
  (void)loop; (void)path; (void)new_path; (void)callback;
  return lean_bridge_uv_unsupported(request);
}

int uv_fs_unlink(uv_loop_t *loop, uv_fs_t *request, const char *path, uv_fs_cb callback) {
  (void)loop; (void)path; (void)callback;
  return lean_bridge_uv_unsupported(request);
}

int uv_fs_mkdtemp(uv_loop_t *loop, uv_fs_t *request, const char *template_path, uv_fs_cb callback) {
  (void)loop; (void)template_path; (void)callback;
  return lean_bridge_uv_unsupported(request);
}

int uv_fs_mkstemp(uv_loop_t *loop, uv_fs_t *request, const char *template_path, uv_fs_cb callback) {
  (void)loop; (void)template_path; (void)callback;
  return lean_bridge_uv_unsupported(request);
}

int uv_os_tmpdir(char *buffer, size_t *size) {
  (void)buffer; (void)size;
  return UV_ENOSYS;
}

/*
 * The link-spike components retain their JavaScript-main registration
 * constructors. PHP binds their exported Lean symbols directly, so these
 * compatibility hooks only let independently built components complete
 * construction while they share this runtime's table.
 */
typedef lean_object *(*lean_bridge_alpha_box_fn)(uint32_t);
typedef uint32_t (*lean_bridge_alpha_read_fn)(lean_object *);
typedef lean_object *(*lean_bridge_alpha_payload_fn)(
    uint8_t,
    uint32_t,
    lean_object *,
    lean_object *,
    lean_object *
);
typedef lean_object *(*lean_bridge_alpha_object_fn)(lean_object *);
typedef uint32_t (*lean_bridge_alpha_callback_fn)(uint32_t, lean_object *);
typedef lean_object *(*lean_bridge_alpha_adder_fn)(uint32_t);
typedef uint8_t (*lean_bridge_alpha_enabled_fn)(lean_object *);
typedef uint32_t (*lean_bridge_alpha_count_fn)(lean_object *);
typedef lean_object *(*lean_bridge_alpha_initializer_fn)(uint8_t);
typedef lean_object *(*lean_bridge_component_identity_fn)(lean_object *);
typedef uint32_t (*lean_bridge_component_read_fn)(lean_object *);

static lean_bridge_alpha_box_fn alpha_box;
static lean_bridge_alpha_read_fn alpha_read;
static lean_bridge_alpha_payload_fn alpha_payload;
static lean_bridge_alpha_object_fn alpha_round_trip;
static lean_bridge_alpha_callback_fn alpha_with_callback;
static lean_bridge_alpha_adder_fn alpha_make_adder;
static lean_bridge_alpha_enabled_fn alpha_payload_enabled;
static lean_bridge_alpha_count_fn alpha_payload_count;
static lean_bridge_alpha_object_fn alpha_payload_label;
static lean_bridge_alpha_object_fn alpha_payload_bytes;
static lean_bridge_alpha_object_fn alpha_payload_values;
static lean_bridge_alpha_initializer_fn alpha_initialize;
static lean_bridge_component_identity_fn beta_identity;
static lean_bridge_component_read_fn beta_read;

void bridge_register_lean_alpha(
    lean_bridge_alpha_box_fn box,
    lean_bridge_alpha_read_fn read,
    lean_bridge_alpha_payload_fn payload,
    lean_bridge_alpha_object_fn round_trip,
    lean_bridge_alpha_callback_fn with_callback,
    lean_bridge_alpha_adder_fn make_adder,
    lean_bridge_alpha_enabled_fn payload_enabled,
    lean_bridge_alpha_count_fn payload_count,
    lean_bridge_alpha_object_fn payload_label,
    lean_bridge_alpha_object_fn payload_bytes,
    lean_bridge_alpha_object_fn payload_values,
    lean_bridge_alpha_initializer_fn initialize
) {
  alpha_box = box;
  alpha_read = read;
  alpha_payload = payload;
  alpha_round_trip = round_trip;
  alpha_with_callback = with_callback;
  alpha_make_adder = make_adder;
  alpha_payload_enabled = payload_enabled;
  alpha_payload_count = payload_count;
  alpha_payload_label = payload_label;
  alpha_payload_bytes = payload_bytes;
  alpha_payload_values = payload_values;
  alpha_initialize = initialize;
}

lean_object *initialize_Alpha(uint8_t builtin) { return alpha_initialize(builtin); }
lean_object *lean_link_alpha_box(uint32_t value) { return alpha_box(value); }
uint32_t lean_link_alpha_read(lean_object *box) { return alpha_read(box); }
lean_object *lean_link_alpha_payload(
    uint8_t enabled,
    uint32_t count,
    lean_object *label,
    lean_object *bytes,
    lean_object *values
) { return alpha_payload(enabled, count, label, bytes, values); }
lean_object *lean_link_alpha_round_trip(lean_object *payload) { return alpha_round_trip(payload); }
uint32_t lean_link_alpha_with_callback(uint32_t value, lean_object *transform) {
  return alpha_with_callback(value, transform);
}
lean_object *lean_link_alpha_make_adder(uint32_t base) { return alpha_make_adder(base); }
uint8_t lean_link_alpha_payload_enabled(lean_object *payload) { return alpha_payload_enabled(payload); }
uint32_t lean_link_alpha_payload_count(lean_object *payload) { return alpha_payload_count(payload); }
lean_object *lean_link_alpha_payload_label(lean_object *payload) { return alpha_payload_label(payload); }
lean_object *lean_link_alpha_payload_bytes(lean_object *payload) { return alpha_payload_bytes(payload); }
lean_object *lean_link_alpha_payload_values(lean_object *payload) { return alpha_payload_values(payload); }

void bridge_register_lean_beta(uintptr_t identity, uintptr_t read, uintptr_t initialize) {
  beta_identity = (lean_bridge_component_identity_fn)identity;
  beta_read = (lean_bridge_component_read_fn)read;
  (void)initialize;
}

int lean_bridge_php_wasm_beta_read(lean_object *box, uint32_t *out) {
  if (box == NULL || out == NULL || beta_read == NULL) return 0;
  lean_inc(box);
  *out = beta_read(box);
  return 1;
}

int lean_bridge_php_wasm_beta_identity(lean_object *box) {
  if (box == NULL || beta_identity == NULL) return 0;
  lean_inc(box);
  lean_object *result = beta_identity(box);
  int same = result == box;
  if (result != NULL) lean_dec(result);
  return same;
}

lean_object *lean_bridge_php_wasm_beta_initialize(uint8_t builtin) {
  (void)builtin;
  return lean_io_result_mk_ok(lean_box(0));
}

int lean_bridge_php_wasm_beta_available(void) {
  return beta_identity != NULL && beta_read != NULL;
}

void bridge_register_lean_gamma(uintptr_t identity, uintptr_t read, uintptr_t initialize) {
  (void)identity; (void)read; (void)initialize;
}
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

const adaptZend = (source, profile) => {
  const includeMarker = "#include \"lean_bridge_native_runtime.h\"";
  if (!source.includes(includeMarker)) fail("zend-adaptation-failed", "Zend adapter lacks the shared runtime include");
  let adapted = source.replace(includeMarker, `${includeMarker}\n#include \"lean_bridge_php_wasm_host.h\"\n#include <emscripten/em_js.h>`);
  const externMarker = "extern void lean_alpha_native_runtime_detach(void);";
  const betaExterns = `${externMarker}\nextern uintptr_t lean_bridge_php_wasm_alpha_box_value(const lean_alpha_box *box);\nextern int lean_bridge_php_wasm_beta_available(void);\nextern int lean_bridge_php_wasm_beta_read(void *box, uint32_t *out);\nextern int lean_bridge_php_wasm_beta_identity(void *box);\nextern void *lean_bridge_php_wasm_beta_initialize(uint8_t builtin);\n\nstatic const char lean_beta_component_id[] = \"poc/lean-beta@0.0.0\";\n\nEM_ASYNC_JS(int, lean_bridge_php_wasm_beta_load, (), {\n    const name = \"/beta.so.data\";\n    if (LDSO.loadedLibsByName[name]) return 1;\n    const dso = newDSO(name, undefined, \"loading\");\n    try {\n        const flags = {loadAsync: true, global: true, nodelete: true};\n        const exports = await loadWebAssemblyModule(FS.readFile(name), flags, name, null);\n        mergeLibSymbols(exports, name);\n        dso.exports = exports;\n        return 1;\n    } catch (error) {\n        delete LDSO.loadedLibsByName[name];\n        console.error(\"Lean PHP-Wasm lazy component load failed\", error);\n        return 0;\n    }\n})`;
  if (!adapted.includes(externMarker)) fail("zend-adaptation-failed", "Zend adapter lacks the native runtime declarations");
  adapted = adapted.replace(externMarker, betaExterns);
  const methodMarker = "PHP_METHOD(LeanAlpha_NativeTransport, leanAlphaRoundTrip)";
  const betaMethods = `PHP_METHOD(LeanAlpha_NativeTransport, leanBetaRead)\n{\n    zval *self;\n    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_OBJECT_OF_CLASS(self, identity_ce) ZEND_PARSE_PARAMETERS_END();\n    lean_php_identity *identity = identity_argument(self, LEAN_PHP_IDENTITY_RESOURCE);\n    if (identity == NULL) RETURN_THROWS();\n    if (!lean_bridge_native_component_initialize(lean_beta_component_id, NULL) ||\n        !lean_bridge_php_wasm_component_ready(lean_beta_component_id)) {\n        zend_throw_exception(zend_ce_error, \"the shared PHP-Wasm runtime rejected Beta initialization\", 0);\n        RETURN_THROWS();\n    }\n    uintptr_t box = lean_bridge_php_wasm_alpha_box_value(identity->value.resource);\n    uint32_t result = 0;\n    if (box == 0 || !lean_bridge_php_wasm_beta_read((void *)box, &result)) {\n        zend_throw_exception(zend_ce_error, \"Beta is unavailable in the locked PHP-Wasm component graph\", 0);\n        RETURN_THROWS();\n    }\n    RETURN_LONG(result);\n}\n\nPHP_METHOD(LeanAlpha_NativeTransport, leanBetaIdentity)\n{\n    zval *self;\n    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_OBJECT_OF_CLASS(self, identity_ce) ZEND_PARSE_PARAMETERS_END();\n    lean_php_identity *identity = identity_argument(self, LEAN_PHP_IDENTITY_RESOURCE);\n    if (identity == NULL) RETURN_THROWS();\n    if (!lean_bridge_native_component_initialize(lean_beta_component_id, NULL) ||\n        !lean_bridge_php_wasm_component_ready(lean_beta_component_id)) {\n        zend_throw_exception(zend_ce_error, \"the shared PHP-Wasm runtime rejected Beta initialization\", 0);\n        RETURN_THROWS();\n    }\n    uintptr_t box = lean_bridge_php_wasm_alpha_box_value(identity->value.resource);\n    if (box == 0 || !lean_bridge_php_wasm_beta_identity((void *)box)) {\n        zend_throw_exception(zend_ce_error, \"Beta broke canonical Lean object identity\", 0);\n        RETURN_THROWS();\n    }\n    RETURN_ZVAL(self, 1, 0);\n}\n\n${methodMarker}`;
  if (!adapted.includes(methodMarker)) fail("zend-adaptation-failed", "Zend adapter method shape changed");
  const betaInitialization = profile === "side-lazy"
    ? "if (!lean_bridge_php_wasm_beta_load() ||\n        !lean_bridge_native_component_initialize(lean_beta_component_id, lean_bridge_php_wasm_beta_initialize)"
    : "if (!lean_bridge_native_component_initialize(lean_beta_component_id, lean_bridge_php_wasm_beta_initialize)";
  adapted = adapted.replace(
    methodMarker,
    betaMethods.replaceAll(
      "if (!lean_bridge_native_component_initialize(lean_beta_component_id, NULL)",
      betaInitialization,
    ),
  );
  const tableMarker = "    PHP_ME(LeanAlpha_NativeTransport, leanAlphaRoundTrip, arginfo_round_trip, ZEND_ACC_PUBLIC)";
  const tableReplacement = `    PHP_ME(LeanAlpha_NativeTransport, leanBetaRead, arginfo_box_read, ZEND_ACC_PUBLIC)\n    PHP_ME(LeanAlpha_NativeTransport, leanBetaIdentity, arginfo_box_identity, ZEND_ACC_PUBLIC)\n${tableMarker}`;
  if (!adapted.includes(tableMarker)) fail("zend-adaptation-failed", "Zend adapter method table shape changed");
  adapted = adapted.replace(tableMarker, tableReplacement);
  const shutdownMarker = "PHP_MSHUTDOWN_FUNCTION(lean_alpha)\n{\n    lean_alpha_native_runtime_detach();";
  const shutdownReplacement = "PHP_MSHUTDOWN_FUNCTION(lean_alpha)\n{\n    lean_bridge_native_component_detach(lean_beta_component_id);\n    lean_alpha_native_runtime_detach();";
  if (!adapted.includes(shutdownMarker)) fail("zend-adaptation-failed", "Zend adapter shutdown shape changed");
  adapted = adapted.replace(shutdownMarker, shutdownReplacement);
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

const adaptCBinding = source => {
  const marker = "struct lean_alpha_owned_transform { uintptr_t value; };";
  const replacement = `${marker}\n\nuintptr_t lean_bridge_php_wasm_alpha_box_value(const lean_alpha_box *self) {\n  return self == NULL ? 0 : self->value;\n}`;
  if (!source.includes(marker)) fail("c-binding-adaptation-failed", "C binding resource layout changed");
  return source.replace(marker, replacement);
};

const versionModule = ({ version, libraries, files, bootstrap }) => `import manifest from "../manifest.mjs";
import { preparePhpWasmLeanHost } from "../host.mjs";

const prepare = php => {
  const host = preparePhpWasmLeanHost(php, manifest);
  const bootstrap = ${JSON.stringify(bootstrap)};
  if (bootstrap) {
    const directive = \`auto_prepend_file=\${bootstrap}\`;
    const ini = php.phpArgs.ini ?? "";
    if (!ini.split("\\n").includes(directive)) php.phpArgs.ini = [ini, directive].filter(Boolean).join("\\n");
  }
  return host;
};

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
  phpPackage = null,
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
  if (phpPackage !== null && (
    typeof phpPackage !== "object" ||
    !Array.isArray(phpPackage.files) ||
    new Set(phpPackage.files).size !== phpPackage.files.length ||
    typeof phpPackage.bootstrap !== "string" ||
    !phpPackage.files.includes(phpPackage.bootstrap) ||
    phpPackage.files.some(path => !/^composer\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path) || posix.normalize(path) !== path)
  )) {
    fail("invalid-php-wasm-php-package", "PHP package files must be unique normalized Composer paths and include the bootstrap");
  }
  const metadataFiles = [
    { name: "graph.json", file: "metadata/graph.json", path: `${metadataPrefix}/graph.json` },
    { name: "binding-ir.json", file: "metadata/binding-ir.json", path: `${metadataPrefix}/binding-ir.json` },
    ...graph.libraries.map((library, index) => ({
      name: `${index.toString().padStart(3, "0")}-${library.id.replace(/[^A-Za-z0-9._-]+/g, "_")}.capsule.json`,
      file: `metadata/capsules/${index.toString().padStart(3, "0")}.json`,
      path: `${metadataPrefix}/capsules/${index.toString().padStart(3, "0")}.json`,
    })),
    ...(phpPackage?.files ?? []).map(path => ({
      name: path.split("/").at(-1),
      file: path,
      path: `/${path.replace(/^composer\//, "vendor/")}`,
    })),
  ];
  const lazyComponentFiles = graph.profile === "side-lazy"
    ? graphLibraries
      .filter(library => library.component !== ir.component.id)
      .map(library => {
        const runtimeName = library.name.replace(/\.wasm$/, ".data");
        return { name: runtimeName, file: library.file, path: `/${runtimeName}` };
      })
    : [];
  const phpBootstrap = phpPackage ? `/${phpPackage.bootstrap.replace(/^composer\//, "vendor/")}` : null;
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
    versionRecords[version] = { libraries, files: [...metadataFiles, ...lazyComponentFiles] };
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
    php: {
      bootstrap: phpBootstrap,
      composerFiles: phpPackage?.files ?? [],
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
    "src/lean_bridge_php_wasm_libuv.c": phpWasmLibuvC,
  };
  graph.libraries.forEach((library, index) => {
    files[`metadata/capsules/${index.toString().padStart(3, "0")}.json`] = `${JSON.stringify(library.capsule, null, 2)}\n`;
  });
  for (const [path, source] of Object.entries(nativeZend)) {
    if (path === "zend-manifest.json") continue;
    files[`extension/${path}`] = path.endsWith("_zend.c")
      ? adaptZend(source, graph.profile)
      : path.endsWith("src/lean_alpha.c")
        ? adaptCBinding(source)
        : source;
  }
  const providerPath = Object.keys(nativeRuntime).find(path => /src\/.+_native\.c$/.test(path));
  files[`extension/${providerPath}`] = adaptProvider(nativeRuntime[providerPath]);
  files["extension/lean_bridge_native_runtime.h"] = nativeRuntime["include/lean_bridge_native_runtime.h"];
  for (const version of versions) files[`versions/${version}.mjs`] = versionModule({
    version,
    ...versionRecords[version],
    bootstrap: phpBootstrap,
  });
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
