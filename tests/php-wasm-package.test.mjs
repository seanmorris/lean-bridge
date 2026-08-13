import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
	PhpWasmPackageError,
	generatePhpWasmReleaseSources,
	readPhpWasmPackageInputs,
	validatePhpWasmPackageManifest,
} from "../src/backends/php/php-wasm-package.mjs";

const manifestPath = "poc/lean-link-spike/bindings/php-wasm.package.json";

test("PHP-Wasm package manifest closes the graph, host, identity map, and release layout", async () => {
  const schema = JSON.parse(await readFile("schema/php-wasm-package.schema.json", "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);

  const inputs = await readPhpWasmPackageInputs({ projectRoot: process.cwd(), manifestPath });
  assert.equal(validatePhpWasmPackageManifest(inputs.manifest), true);
  assert.equal(inputs.bindingIr.component.id, alpha.bindingIr.component.id);
  assert.equal(inputs.manifest.bindingIr.semanticSha256, alpha.bindingIrSha256);
  assert.equal(inputs.graph.profile, "side-lazy");
  assert.equal(inputs.manifest.graphLock.target, "php-wasm-emscripten-3.1.68");
  assert.deepEqual(inputs.graph.order, [
    "poc/lean-alpha@0.0.0"
    , "poc/lean-beta@0.0.0"
    , "poc/lean-gamma@0.0.0"
  ]);
  assert.equal(inputs.manifest.phpWasm.sourceCommit, "bd9a46bf4984bfbdfef4bb6f5b04b7dcd6264c89");
  assert.deepEqual(inputs.manifest.phpWasm.emscripten, {
    version: "3.1.68"
    , emsdkCommit: "54ef088329e5a329614b3659a579d2ccd31fd621"
    , sourceCommit: "ceee49d2ecdab36a3feb85a684f8e5a453dde910"
    , runtimeVariant: "php-wasm-3.1.68"
  });
  assert.equal(inputs.manifest.weaker.packageVersion, "0.0.10");

  const unknown = structuredClone(inputs.manifest);
  unknown.phpWasm.loaderPatch = true;
  assert.throws(
    () => validatePhpWasmPackageManifest(unknown),
    error => error instanceof PhpWasmPackageError && error.code === "invalid-php-wasm-package-manifest",
  );
  const escaped = structuredClone(inputs.manifest);
  escaped.graphLock.path = "../graph-lock.json";
  assert.throws(
    () => validatePhpWasmPackageManifest(escaped),
    error => error instanceof PhpWasmPackageError && error.code === "invalid-php-wasm-package-manifest",
  );
});

test("one PHP-Wasm manifest generates the descriptor, Composer surface, stubs, docs, and provenance", async () => {
  const inputs = await readPhpWasmPackageInputs({ projectRoot: process.cwd(), manifestPath });
  const files = generatePhpWasmReleaseSources({
    inputs
    , runtime: {
      name: "liblean_bridge_runtime.so"
      , file: "lib/liblean_bridge_runtime.so"
      , sha256: "1".repeat(64)
    }
    , extensions: {
      "8.4": {
        name: "php8.4-lean-alpha.so"
        , file: "lib/php8.4-lean-alpha.so"
        , sha256: "2".repeat(64)
      }
    }
  });
  const descriptor = JSON.parse(files["php-wasm-manifest.json"]);
  const composer = JSON.parse(files["composer/composer.json"]);
  const provenance = JSON.parse(files["metadata/release/provenance.json"]);

  assert.equal(descriptor.bindingIrSha256, alpha.bindingIrSha256);
  assert.deepEqual(descriptor.versions["8.4"].libraries.map(library => library.file), [
    "lib/liblean_bridge_runtime.so"
    , "lib/components/alpha.so.wasm"
    , "lib/components/beta.so.wasm"
    , "lib/components/gamma.so.wasm"
    , "lib/php8.4-lean-alpha.so"
  ]);
  assert.equal(composer.name, "poc/lean-alpha");
  assert.ok(files["composer/stubs/lean_alpha.php"]);
  assert.ok(files["composer/autoload.php"]);
  assert.ok(files["composer/README.md"]);
  assert.ok(files["composer/reflection.json"]);
  assert.ok(files["composer/assurance.json"]);
  assert.ok(files["metadata/release/graph-lock.json"]);
  assert.equal(provenance.graph.profile, "side-lazy");
  assert.equal(descriptor.php.bootstrap, "/vendor/autoload.php");
  assert.ok(descriptor.php.composerFiles.includes("composer/src/Box.php"));
  assert.ok(descriptor.php.composerFiles.includes("composer/src/LeanBeta/functions.php"));
  assert.ok(descriptor.php.composerFiles.includes("composer/stubs/lean_beta.php"));
  assert.match(files["composer/src/LeanBeta/functions.php"], /function read\(Box \$box\): int/);
  assert.match(files["composer/src/LeanBeta/functions.php"], /function identity\(Box \$box\): Box/);
  assert.doesNotMatch(files["composer/src/LeanBeta/functions.php"], /\bccall\b|\bcwrap\b|handle|pointer/);
  assert.ok(descriptor.php.composerFiles.includes("composer/reflection.json"));
  assert.ok(descriptor.php.composerFiles.includes("composer/assurance.json"));
  assert.ok(descriptor.php.composerFiles.includes("composer/README.md"));
  assert.match(files["README.md"], /Wasm URLs, loader handles, generic dispatch/);
  assert.match(files["README.md"], /It is not converted to JSON/);
  assert.doesNotMatch(files["composer/README.md"], /\bccall\b|\bcwrap\b/);
});
