import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { readLockedGraph } from "../src/capsule/node.mjs";
import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
  PhpWasmGenerationError,
  generatePhpWasmAdapterPackage,
} from "../src/backends/php/php-wasm.mjs";

const graph = await readLockedGraph({
  lockPath: "poc/lean-link-spike/graph-lock.json",
  profile: "side-startup",
});

const options = {
  ir: alpha.bindingIr,
  graph,
  target: "browser",
  runtime: {
    name: "liblean_bridge_runtime.so",
    file: "lib/liblean_bridge_runtime.so",
    sha256: "1".repeat(64),
  },
  extensions: {
    "8.4": {
      name: "php8.4-lean-alpha.so",
      file: "lib/php8.4-lean-alpha.so",
      sha256: "2".repeat(64),
    },
  },
};

const writePackage = async (directory, files) => {
  for (const [path, source] of Object.entries(files)) {
    const destination = join(directory, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, source);
  }
};

test("PHP-Wasm generator emits one flat PHP-Wasm library closure", () => {
  const files = generatePhpWasmAdapterPackage(options);
  const manifest = JSON.parse(files["php-wasm-manifest.json"]);
  const libraries = manifest.versions["8.4"].libraries;

  assert.deepEqual(libraries.map(library => [library.role, library.name, library.ini]), [
    ["lean-runtime", "liblean_bridge_runtime.so", false],
    ["lean-component", "alpha.so.wasm", false],
    ["lean-component", "beta.so.wasm", false],
    ["lean-component", "gamma.so.wasm", false],
    ["php-extension", "php8.4-lean-alpha.so", true],
  ]);
  assert.deepEqual(manifest.graph.order, [
    "poc/lean-alpha@0.0.0",
    "poc/lean-beta@0.0.0",
    "poc/lean-gamma@0.0.0",
  ]);
  assert.equal(libraries.some(library => "getLibs" in library), false);
  assert.equal(manifest.transport.supported, true);
  assert.equal(manifest.weaker.version, "0.0.10");
  assert.match(files["host.mjs"], /import \{ WeakerMap \} from "weaker"/);
  assert.doesNotMatch(files["host.mjs"], /class WeakerMap/);
  assert.doesNotMatch(files["host.mjs"], /\bccall\b|\bcwrap\b/);
  assert.match(files["src/lean_bridge_php_wasm_host.c"], /Module\.__leanBridgeInstallPhpWasmHostV1/);
  assert.match(files["extension/lean_alpha_zend.c"], /PHP_RINIT_FUNCTION\(lean_alpha\)/);
  assert.match(files["extension/lean_alpha_zend.c"], /PHP_METHOD\(LeanAlpha_NativeTransport, leanBetaRead\)/);
  assert.match(files["extension/lean_alpha_zend.c"], /PHP_METHOD\(LeanAlpha_NativeTransport, leanBetaIdentity\)/);
  assert.match(files["extension/lean_alpha_zend.c"], /EM_ASYNC_JS\(int, lean_bridge_php_wasm_beta_load/);
  assert.match(files["extension/lean_alpha_zend.c"], /FS\.readFile\(name\)/);
  assert.match(files["extension/src/lean_alpha.c"], /lean_bridge_php_wasm_alpha_box_value/);
  assert.match(files["extension/src/lean_alpha_native.c"], /lean_bridge_php_wasm_component_ready/);
  assert.doesNotMatch(files["extension/src/lean_alpha.c"], /\bccall\b|\bcwrap\b/);
});

test("generated host keeps one runtime, component domain, and Vrzno-style identity index", async () => {
  await mkdir("build", { recursive: true });
  const directory = await mkdtemp(join(process.cwd(), "build/php-wasm-host-test-"));
  try {
    const files = generatePhpWasmAdapterPackage(options);
    await writePackage(directory, files);
    const generated = await import(`${pathToFileURL(join(directory, "index.mjs")).href}?test=${Date.now()}`);
    const wrapper = { phpVersion: "8.4", phpArgs: {} };
    const libraries = generated.getLibs(wrapper);
    const preload = generated.getFiles(wrapper);
    assert.deepEqual(libraries.map(library => library.name), [
      "liblean_bridge_runtime.so",
      "alpha.so.wasm",
      "beta.so.wasm",
      "gamma.so.wasm",
      "php8.4-lean-alpha.so",
    ]);
    assert.equal(libraries.every(library => library.url instanceof URL), true);
    assert.equal(preload.length, 5);
    assert.equal(wrapper.phpArgs.WeakerMap.name, "WeakerMap");

    const memory = new WebAssembly.Memory({ initial: 1 });
    const table = new WebAssembly.Table({ initial: 1, element: "anyfunc" });
    const module = {
      ...wrapper.phpArgs,
      HEAPU8: new Uint8Array(memory.buffer),
      wasmTable: table,
      onRefresh: new Set(),
    };
    const host = module.__leanBridgeInstallPhpWasmHostV1(module);
    assert.equal(module.__leanBridgeInstallPhpWasmHostV1(module), host);
    assert.equal(host.memory, memory.buffer);
    assert.equal(host.table, table);
    assert.equal(host.initializeRuntime(() => true), true);
    assert.equal(host.initializeRuntime(() => { throw new Error("must not run"); }), false);
    assert.throws(
      () => host.initializeComponent("poc/lean-beta@0.0.0", () => true),
      error => error.code === "component-dependency-not-ready",
    );
    assert.equal(host.initializeComponent("poc/lean-alpha@0.0.0", () => true), true);
    assert.equal(host.initializeComponent("poc/lean-beta@0.0.0", () => true), true);
    assert.equal(host.initializeComponent("poc/lean-gamma@0.0.0", () => true), true);
    assert.equal(host.initializeComponent("poc/lean-alpha@0.0.0", () => false), false);
    assert.equal(
      host.initializeComponent(`poc/lean-alpha@0.0.0#${alpha.bindingIrSha256}`, () => false),
      false,
    );
    assert.throws(
      () => host.initializeComponent(`poc/lean-alpha@0.0.0#${"0".repeat(64)}`, () => true),
      error => error.code === "component-binding-mismatch",
    );

    const value = {};
    const fromAlpha = host.targetIdentity(value);
    const fromGamma = host.targetIdentity(value);
    assert.equal(fromGamma, fromAlpha);
    assert.equal(host.target(fromAlpha), value);

    const cleanup = [];
    host.beginRequest();
    host.ownForRequest(() => cleanup.push("first"));
    host.ownForRequest(() => cleanup.push("second"));
    const callback = host.bindRequestCallback(input => input + 1);
    assert.equal(callback(41), 42);
    assert.equal(host.endRequest(), true);
    assert.deepEqual(cleanup, ["second", "first"]);
    assert.throws(() => callback(41), error => error.code === "stale-request-callback");
    assert.equal(host.releaseTarget(fromAlpha), true);
    assert.equal(host.target(fromAlpha), undefined);
    assert.deepEqual(host.snapshot(), {
      protocol: 1,
      runtimeState: "ready",
      runtimeInitRuns: 1,
      graphs: 1,
      components: [
        "poc/lean-alpha@0.0.0",
        "poc/lean-beta@0.0.0",
        "poc/lean-gamma@0.0.0",
      ],
      identities: 0,
      requestActive: false,
      requestGeneration: 2,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("PHP-Wasm generation rejects graph, asset, and component drift", async () => {
  const lazy = await readLockedGraph({
    lockPath: "poc/lean-link-spike/graph-lock.json",
    profile: "side-lazy",
  });
  const lazyFiles = generatePhpWasmAdapterPackage({ ...options, graph: lazy });
  const lazyManifest = JSON.parse(lazyFiles["php-wasm-manifest.json"]);
  assert.deepEqual(
    lazyManifest.versions["8.4"].files
      .filter(file => /^\/(?:beta|gamma)\.so\.data$/.test(file.path))
      .map(file => file.path),
    ["/beta.so.data", "/gamma.so.data"],
  );

  const staticGraph = await readLockedGraph({
    lockPath: "poc/lean-link-spike/graph-lock.json",
    profile: "final-static",
  });
  assert.throws(
    () => generatePhpWasmAdapterPackage({ ...options, graph: staticGraph }),
    error => error instanceof PhpWasmGenerationError && error.code === "invalid-php-wasm-profile",
  );

  assert.throws(
    () => generatePhpWasmAdapterPackage({
      ...options,
      runtime: { ...options.runtime, name: "alpha.so.wasm" },
    }),
    error => error instanceof PhpWasmGenerationError && error.code === "duplicate-php-wasm-library-name",
  );

  assert.throws(
    () => generatePhpWasmAdapterPackage({
      ...options,
      runtime: { ...options.runtime, file: "lib/../escape.so" },
    }),
    error => error instanceof PhpWasmGenerationError && error.code === "invalid-php-wasm-artifact",
  );

  const source = await readFile("poc/lean-link-spike/bindings/alpha.binding-ir.json", "utf8");
  const absent = JSON.parse(source);
  absent.component.id = "poc/missing@0.0.0";
  absent.component.name = "Missing";
  assert.throws(
    () => generatePhpWasmAdapterPackage({ ...options, ir: absent }),
    error => error instanceof PhpWasmGenerationError && error.code === "component-absent-from-graph",
  );
});
