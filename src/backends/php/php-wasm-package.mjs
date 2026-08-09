import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import { canonicalJson, readLockedGraph } from "../../capsule/node.mjs";
import { generatePhpBindingPackage } from "./generate.mjs";
import { generatePhpWasmAdapterPackage } from "./php-wasm.mjs";

export class PhpWasmPackageError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PhpWasmPackageError";
    this.code = code;
    this.details = Object.freeze(structuredClone(details));
  }
}

const fail = (code, message, details = {}) => {
  throw new PhpWasmPackageError(code, message, details);
};

const sha256 = source => createHash("sha256").update(source).digest("hex");
const hashPattern = /^[0-9a-f]{64}$/;
const commitPattern = /^[0-9a-f]{40}$/;
const integrityPattern = /^sha512-[A-Za-z0-9+/]+={0,2}$/;

const requireObject = (value, path) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid-php-wasm-package-manifest", `${path} must be an object`, { path });
  }
};

const requireKeys = (value, required, path) => {
  requireObject(value, path);
  const wanted = new Set(required);
  const missing = required.filter(key => !(key in value));
  const unknown = Object.keys(value).filter(key => !wanted.has(key));
  if (missing.length || unknown.length) {
    fail("invalid-php-wasm-package-manifest", `${path} has missing or unknown fields`, {
      path,
      missing,
      unknown,
    });
  }
};

const requireString = (value, path, pattern = null) => {
  if (typeof value !== "string" || value.length === 0 || pattern && !pattern.test(value)) {
    fail("invalid-php-wasm-package-manifest", `${path} has an invalid value`, { path, value });
  }
};

const requireRelativePath = (value, path) => {
  requireString(value, path);
  const normalized = normalize(value);
  if (isAbsolute(value) || normalized === ".." || normalized.startsWith(`..${sep}`) || normalized !== value) {
    fail("invalid-php-wasm-package-manifest", `${path} must be a normalized project-relative path`, {
      path,
      value,
    });
  }
};

export const validatePhpWasmPackageManifest = manifest => {
  requireKeys(manifest, [
    "schemaVersion",
    "packageId",
    "bindingIr",
    "graphLock",
    "phpWasm",
    "weaker",
    "artifacts",
    "sourceDateEpoch",
  ], "manifest");
  if (manifest.schemaVersion !== 1) {
    fail("unsupported-php-wasm-package-schema", "PHP-Wasm package schemaVersion must be 1");
  }
  requireString(manifest.packageId, "manifest.packageId");

  requireKeys(manifest.bindingIr, ["path", "fileSha256", "semanticSha256"], "manifest.bindingIr");
  requireRelativePath(manifest.bindingIr.path, "manifest.bindingIr.path");
  requireString(manifest.bindingIr.fileSha256, "manifest.bindingIr.fileSha256", hashPattern);
  requireString(manifest.bindingIr.semanticSha256, "manifest.bindingIr.semanticSha256", hashPattern);

  requireKeys(manifest.graphLock, ["path", "fileSha256", "profile", "target"], "manifest.graphLock");
  requireRelativePath(manifest.graphLock.path, "manifest.graphLock.path");
  requireString(manifest.graphLock.fileSha256, "manifest.graphLock.fileSha256", hashPattern);
  if (!new Set(["side-startup", "side-lazy"]).has(manifest.graphLock.profile)) {
    fail("unsupported-php-wasm-package-profile", "PHP-Wasm package requires a side-module graph");
  }
  if (manifest.graphLock.target !== "php-wasm-emscripten-3.1.68") {
    fail("unsupported-php-wasm-package-target", "PHP-Wasm package target must match the audited PHP-Wasm dynamic-link ABI");
  }

  requireKeys(manifest.phpWasm, [
    "sourceCommit",
    "packageVersion",
    "packageIntegrity",
    "emscripten",
    "phpVersions",
  ], "manifest.phpWasm");
  requireString(manifest.phpWasm.sourceCommit, "manifest.phpWasm.sourceCommit", commitPattern);
  if (manifest.phpWasm.packageVersion !== "0.1.0") {
    fail("unsupported-php-wasm-package-version", "PHP-Wasm package version must match the audited 0.1.0 release");
  }
  requireString(manifest.phpWasm.packageIntegrity, "manifest.phpWasm.packageIntegrity", integrityPattern);
  requireKeys(manifest.phpWasm.emscripten, [
    "version",
    "emsdkCommit",
    "sourceCommit",
    "runtimeVariant",
  ], "manifest.phpWasm.emscripten");
  if (
    manifest.phpWasm.emscripten.version !== "3.1.68" ||
    manifest.phpWasm.emscripten.runtimeVariant !== "php-wasm-3.1.68"
  ) {
    fail("unsupported-php-wasm-emscripten", "PHP-Wasm 0.1.0 requires the audited Emscripten 3.1.68 target");
  }
  requireString(manifest.phpWasm.emscripten.emsdkCommit, "manifest.phpWasm.emscripten.emsdkCommit", commitPattern);
  requireString(manifest.phpWasm.emscripten.sourceCommit, "manifest.phpWasm.emscripten.sourceCommit", commitPattern);
  if (
    !Array.isArray(manifest.phpWasm.phpVersions) ||
    manifest.phpWasm.phpVersions.length === 0 ||
    new Set(manifest.phpWasm.phpVersions).size !== manifest.phpWasm.phpVersions.length ||
    manifest.phpWasm.phpVersions.some(version => !/^8\.[2-9]$/.test(version))
  ) {
    fail("invalid-php-wasm-versions", "phpVersions must contain unique supported PHP versions");
  }

  requireKeys(manifest.weaker, ["sourceCommit", "packageVersion", "packageIntegrity"], "manifest.weaker");
  requireString(manifest.weaker.sourceCommit, "manifest.weaker.sourceCommit", commitPattern);
  if (manifest.weaker.packageVersion !== "0.0.10") {
    fail("unsupported-weaker-version", "PHP-Wasm package must use audited Weaker 0.0.10");
  }
  requireString(manifest.weaker.packageIntegrity, "manifest.weaker.packageIntegrity", integrityPattern);

  requireKeys(manifest.artifacts, [
    "runtimeLibrary",
    "componentDirectory",
    "extensionPattern",
    "composerPackage",
    "metadata",
  ], "manifest.artifacts");
  for (const [name, value] of Object.entries(manifest.artifacts)) {
    const example = value.replace?.("{version}", "8.4");
    requireRelativePath(example, `manifest.artifacts.${name}`);
  }
  if (
    manifest.artifacts.runtimeLibrary !== "lib/liblean_bridge_runtime.so" ||
    manifest.artifacts.componentDirectory !== "lib/components" ||
    manifest.artifacts.extensionPattern !== "lib/php{version}-lean-alpha.so" ||
    manifest.artifacts.composerPackage !== "composer" ||
    manifest.artifacts.metadata !== "metadata/release"
  ) {
    fail("unsupported-php-wasm-package-layout", "PHP-Wasm package layout does not match version 1");
  }
  if (!Number.isSafeInteger(manifest.sourceDateEpoch) || manifest.sourceDateEpoch < 1) {
    fail("invalid-php-wasm-package-manifest", "sourceDateEpoch must be a positive safe integer");
  }
  return true;
};

const checkedProjectPath = (projectRoot, path, field) => {
  const absolute = resolve(projectRoot, path);
  const inside = relative(projectRoot, absolute);
  if (inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    fail("php-wasm-package-path-escape", `${field} escapes the project root`, { field, path });
  }
  return absolute;
};

export const readPhpWasmPackageInputs = async ({ projectRoot, manifestPath }) => {
  const manifestAbsolute = checkedProjectPath(projectRoot, manifestPath, "manifestPath");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestAbsolute, "utf8"));
  } catch (error) {
    fail("invalid-php-wasm-package-manifest", `cannot read ${manifestPath}`, { cause: error.message });
  }
  validatePhpWasmPackageManifest(manifest);
  const bindingIrAbsolute = checkedProjectPath(projectRoot, manifest.bindingIr.path, "bindingIr.path");
  const graphLockAbsolute = checkedProjectPath(projectRoot, manifest.graphLock.path, "graphLock.path");
  const [bindingIrSource, graphLockSource] = await Promise.all([
    readFile(bindingIrAbsolute),
    readFile(graphLockAbsolute),
  ]);
  if (sha256(bindingIrSource) !== manifest.bindingIr.fileSha256) {
    fail("php-wasm-package-input-drift", "Binding IR file hash does not match the package manifest");
  }
  if (sha256(graphLockSource) !== manifest.graphLock.fileSha256) {
    fail("php-wasm-package-input-drift", "graph lock hash does not match the package manifest");
  }
  const bindingIr = JSON.parse(bindingIrSource.toString("utf8"));
  validateBindingIr(bindingIr);
  if (hashBindingIr(bindingIr) !== manifest.bindingIr.semanticSha256) {
    fail("php-wasm-package-input-drift", "Binding IR semantic hash does not match the package manifest");
  }
  if (bindingIr.component.id !== manifest.packageId.replace(/-php-wasm(?=@)/, "")) {
    fail("php-wasm-package-component-mismatch", "packageId does not identify the Binding IR component");
  }
  const graph = await readLockedGraph({
    lockPath: graphLockAbsolute,
    profile: manifest.graphLock.profile,
  });
  if (!graph.order.includes(bindingIr.component.id)) {
    fail("php-wasm-package-component-mismatch", "locked graph does not contain the Binding IR component");
  }
  return Object.freeze({
    manifest: Object.freeze(structuredClone(manifest)),
    bindingIr: Object.freeze(bindingIr),
    graph,
    manifestAbsolute,
    bindingIrAbsolute,
    graphLockAbsolute,
    graphLockSource,
  });
};

const releaseReadme = ({ manifest, bindingIr }) => `# ${bindingIr.component.name} for PHP-Wasm

Install this package beside \`php-wasm\`, then add its generated descriptor to the PHP-Wasm dependency list. PHP application code uses the same Composer package as native PHP.

\`\`\`php
use LeanAlpha\\Box;
use LeanAlpha\\Bytes;
use LeanAlpha\\Payload;
use function LeanAlpha\\roundTrip;

$box = new Box(41);
$payload = roundTrip(new Payload(false, 8, 'typed', Bytes::fromString("\\x00\\x7f\\xff"), [1, 5, 13]));
assert($box->read() === 41);
$box->close();
\`\`\`

The call uses PHP classes and functions. Wasm URLs, loader handles, generic dispatch, runtime identities, and ownership operations stay inside the generated package. \`Payload\` crosses as a typed value frame. It is not converted to JSON.

The descriptor loads one shared Lean runtime, then the locked component closure, then the PHP extension. Every library imports PHP-Wasm's memory and function table.

Binding IR SHA-256: \`${manifest.bindingIr.semanticSha256}\`

Graph lock SHA-256: \`${manifest.graphLock.fileSha256}\`
`;

export const generatePhpWasmReleaseSources = ({ inputs, runtime, extensions }) => {
  const { manifest, bindingIr, graph } = inputs;
  validatePhpWasmPackageManifest(manifest);
  const composer = { ...generatePhpBindingPackage(bindingIr) };
  composer["autoload.php"] = `<?php
declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $prefix = 'LeanAlpha\\\\';
    if (!str_starts_with($class, $prefix)) return;
    $path = __DIR__ . '/src/' . str_replace('\\\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($path)) require $path;
});

require_once __DIR__ . '/src/functions.php';
`;
  const phpFiles = Object.keys(composer)
    .filter(path => path === "autoload.php" || path.startsWith("src/") && path.endsWith(".php"))
    .sort()
    .map(path => `${manifest.artifacts.composerPackage}/${path}`);
  const adapter = generatePhpWasmAdapterPackage({
    ir: bindingIr,
    graph,
    target: manifest.graphLock.target,
    runtime,
    extensions,
    phpPackage: {
      bootstrap: `${manifest.artifacts.composerPackage}/autoload.php`,
      files: phpFiles,
    },
  });
  const files = { ...adapter };
  for (const [path, source] of Object.entries(composer)) {
    files[`${manifest.artifacts.composerPackage}/${path}`] = source;
  }
  files["README.md"] = releaseReadme(inputs);
  files[`${manifest.artifacts.metadata}/package-input.json`] = canonicalJson(manifest);
  files[`${manifest.artifacts.metadata}/graph-lock.json`] = inputs.graphLockSource;
  files[`${manifest.artifacts.metadata}/binding-ir.json`] = canonicalJson(bindingIr);
  files[`${manifest.artifacts.metadata}/provenance.json`] = canonicalJson({
    schemaVersion: 1,
    packageId: manifest.packageId,
    phpWasm: manifest.phpWasm,
    weaker: manifest.weaker,
    graph: {
      id: graph.graphId,
      profile: graph.profile,
      target: manifest.graphLock.target,
      sha256: sha256(canonicalJson(graph)),
    },
    sourceDateEpoch: manifest.sourceDateEpoch,
  });
  return Object.freeze(files);
};

export const createPhpWasmReleaseManifest = ({ inputs, artifacts, observedToolchain }) => {
  const records = Object.entries(artifacts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, value]) => ({ path, bytes: value.length, sha256: sha256(value) }));
  return Object.freeze({
    schemaVersion: 1,
    packageId: inputs.manifest.packageId,
    component: inputs.bindingIr.component,
    bindingIr: structuredClone(inputs.manifest.bindingIr),
    graphLock: structuredClone(inputs.manifest.graphLock),
    phpWasm: structuredClone(inputs.manifest.phpWasm),
    weaker: structuredClone(inputs.manifest.weaker),
    observedToolchain: structuredClone(observedToolchain),
    sharedRuntime: {
      abiVersion: inputs.graph.libraries[0].capsule.runtime.abiVersion,
      scope: "php-wasm-main-module",
      memory: "imported-from-php-wasm",
      table: "imported-from-php-wasm",
      heap: "one-lean-heap-per-php-wasm-instance",
      identityDomain: "one-per-php-wasm-instance",
    },
    sourceDateEpoch: inputs.manifest.sourceDateEpoch,
    artifacts: records,
    reproducibility: {
      releaseCriterion: "byte-identical",
      cleanBuildsRequired: 2,
      rebuildCommand: "npm run test:php-wasm-package:release",
      pathPolicy: "fixed source epoch, path-independent side modules, canonical metadata",
    },
  });
};
