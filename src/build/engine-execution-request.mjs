import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateComponentBuildPlan } from "./component-plan.mjs";
import { validateComponentCompilationPlan } from "./component-compilation-plan.mjs";

export class EngineExecutionRequestError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "EngineExecutionRequestError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new EngineExecutionRequestError(code, message, details);
};

const exactKeys = (value, expected, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-engine-execution-request", `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail("invalid-engine-execution-request", `${label} fields must be closed`, { actual, expected: wanted });
};

const hash = (value, label) => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail("invalid-engine-execution-request", `${label} must be a SHA-256 identity`);
};

const safePath = path => typeof path === "string" && path !== "" && !path.startsWith("/") && !path.includes("\\") && !path.split("/").includes("..");

export const engineIdentityFiles = Object.freeze([
  "flake.lock",
  "flake.nix",
  "nix/wasm-toolchain.nix",
  "poc/lean-link-spike/graph-lock.json",
  "scripts/build-lean-runtime.sh",
  "scripts/env.sh",
  "scripts/lean-runtime-config.sh",
  "scripts/run-component-engine.mjs",
  "src/analyze/lean-project.mjs",
  "src/build/component-artifact-manifest.mjs",
  "src/build/component-engine.mjs",
  "src/build/component-compilation-plan.mjs",
  "src/build/component-plan.mjs",
  "src/build/component-side-linker.mjs",
  "src/build/compiler-adapters.mjs",
  "src/build/engine-execution-request.mjs",
  "src/build/lean-component-compiler.mjs",
  "src/build/side-module-audit.mjs",
  "src/capsule/node.mjs",
  "src/release/component-release-bundle.mjs",
].sort());

const fileRecord = async (root, path) => {
  let bytes;
  try {
    bytes = await readFile(join(root, path));
  } catch (error) {
    fail("engine-identity-input-missing", `Engine identity input is unavailable: ${path}`, { path, cause: error.message });
  }
  return Object.freeze({ path, bytes: bytes.length, sha256: sha256(bytes) });
};

export const identifyBuildEngine = async engineRoot => {
  const root = resolve(engineRoot);
  const files = Object.freeze(await Promise.all(engineIdentityFiles.map(path => fileRecord(root, path))));
  return Object.freeze({
    identitySha256: sha256(canonicalJson(files)),
    fileCount: files.length,
    files,
  });
};

const listFiles = async root => {
  const files = [];
  const visit = async relative => {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
      else fail("component-input-unsupported-entry", `Component input closure contains a non-file entry: ${path}`, { path });
    }
  };
  await visit("");
  return files.sort();
};

export const identifyComponentInputClosure = async inputRoot => {
  const root = resolve(inputRoot);
  const paths = await listFiles(root);
  const files = Object.freeze(await Promise.all(paths.map(path => fileRecord(root, path))));
  return Object.freeze({
    identitySha256: sha256(canonicalJson(files)),
    fileCount: files.length,
    files,
  });
};

const authorizedBundleFiles = ({ componentPlan, compilationPlan }) => Object.freeze([
  "README.md",
  compilationPlan.document.outputs.sideModule,
  "binding/binding-ir.json",
  "binding/private-abi.json",
  "component-release-bundle.json",
  "generated/LeanBridgeGenerated.lean",
  "locks/compiler-adapters.json",
  "locks/component-build-plan.json",
  "locks/component-compilation-plan.json",
  "locks/lean-target-c-manifest.json",
  "locks/side-module-link-manifest.json",
  "metadata/assurance.json",
  "metadata/component-artifact-manifest.json",
  "metadata/provenance.json",
  "metadata/runtime-requirement.json",
  "metadata/side-module-audit.json",
  ...componentPlan.document.source.inputs.map(input => `source/${input.path}`),
].sort());

export const validateEngineExecutionRequest = request => {
  exactKeys(request, ["schemaVersion", "kind", "engine", "component", "source", "output", "cache", "targets", "policies"], "engine execution request");
  if (request.schemaVersion !== 1 || request.kind !== "lean-bridge-engine-execution") fail("invalid-engine-execution-request", "Engine execution request version or kind is unsupported");
  exactKeys(request.engine, ["identitySha256", "fileCount"], "engine");
  hash(request.engine.identitySha256, "engine identity");
  if (!Number.isSafeInteger(request.engine.fileCount) || request.engine.fileCount < 1) fail("invalid-engine-execution-request", "Engine file count must be positive");
  exactKeys(request.component, ["id", "componentPlanSha256", "compilationPlanSha256", "sourceTreeSha256", "inputClosureSha256"], "component");
  if (typeof request.component.id !== "string" || request.component.id === "") fail("invalid-engine-execution-request", "Component id is required");
  for (const key of ["componentPlanSha256", "compilationPlanSha256", "sourceTreeSha256", "inputClosureSha256"]) hash(request.component[key], `component ${key}`);
  exactKeys(request.source, ["kind", "mount", "readOnly"], "source");
  if (request.source.kind !== "closed-component-input" || request.source.mount !== "component" || request.source.readOnly !== true) fail("invalid-engine-execution-request", "Component source must be one closed read-only input mount");
  exactKeys(request.output, ["kind", "bundleDirectory", "executionReport", "authorizedFiles"], "output");
  if (request.output.kind !== "component-neutral-release-bundle" || request.output.bundleDirectory !== "bundle" || request.output.executionReport !== "engine-execution-report.json") fail("invalid-engine-execution-request", "Output contract is unsupported");
  if (!Array.isArray(request.output.authorizedFiles) || request.output.authorizedFiles.length < 1 || new Set(request.output.authorizedFiles).size !== request.output.authorizedFiles.length || request.output.authorizedFiles.some(path => !safePath(path))) fail("invalid-engine-execution-request", "Authorized output files must be unique safe paths");
  exactKeys(request.cache, ["policy"], "cache");
  if (!new Set(["use", "refresh", "off"]).has(request.cache.policy)) fail("invalid-engine-execution-request", "Cache policy must be use, refresh, or off");
  if (!Array.isArray(request.targets) || new Set(request.targets).size !== request.targets.length || request.targets.some(target => typeof target !== "string" || target === "")) fail("invalid-engine-execution-request", "Targets must be unique non-empty strings");
  exactKeys(request.policies, ["backendNeutral", "sameRequestBytes", "sourceReadOnly", "compileOnce", "sharedRuntime", "copyAuthorizedOutputsOnly"], "policies");
  if (Object.values(request.policies).some(value => value !== true)) fail("invalid-engine-execution-request", "Execution policies must preserve backend-neutral shared-runtime compilation");
  return true;
};

export const createEngineExecutionRequest = async ({ engineRoot, inputRoot, componentPlan, compilationPlan, cachePolicy = "use", targets = [] }) => {
  validateComponentBuildPlan(componentPlan.document);
  validateComponentCompilationPlan(compilationPlan.document);
  if (componentPlan.sha256 !== compilationPlan.document.componentPlanSha256) fail("engine-request-plan-drift", "Component and compilation plans do not share one identity");
  const [engine, input] = await Promise.all([
    identifyBuildEngine(engineRoot),
    identifyComponentInputClosure(inputRoot),
  ]);
  const document = Object.freeze({
    schemaVersion: 1,
    kind: "lean-bridge-engine-execution",
    engine: Object.freeze({ identitySha256: engine.identitySha256, fileCount: engine.fileCount }),
    component: Object.freeze({
      id: componentPlan.document.component.id,
      componentPlanSha256: componentPlan.sha256,
      compilationPlanSha256: compilationPlan.sha256,
      sourceTreeSha256: componentPlan.document.source.treeSha256,
      inputClosureSha256: input.identitySha256,
    }),
    source: Object.freeze({ kind: "closed-component-input", mount: "component", readOnly: true }),
    output: Object.freeze({
      kind: "component-neutral-release-bundle",
      bundleDirectory: "bundle",
      executionReport: "engine-execution-report.json",
      authorizedFiles: authorizedBundleFiles({ componentPlan, compilationPlan }),
    }),
    cache: Object.freeze({ policy: cachePolicy }),
    targets: Object.freeze([...targets].sort()),
    policies: Object.freeze({ backendNeutral: true, sameRequestBytes: true, sourceReadOnly: true, compileOnce: true, sharedRuntime: true, copyAuthorizedOutputsOnly: true }),
  });
  validateEngineExecutionRequest(document);
  return Object.freeze({ document, sha256: sha256(canonicalJson(document)), engine, input });
};

export const writeEngineExecutionRequest = async ({ output, ...inputs }) => {
  const destination = resolve(output);
  try {
    await stat(destination);
    fail("engine-execution-request-exists", `Engine execution request already exists: ${destination}`);
  } catch (error) {
    if (error instanceof EngineExecutionRequestError) throw error;
    if (error.code !== "ENOENT") throw error;
  }
  const request = await createEngineExecutionRequest(inputs);
  await mkdir(dirname(destination), { recursive: true });
  const staging = `${destination}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(staging, canonicalJson(request.document), { mode: 0o444, flag: "wx" });
    await rename(staging, destination);
  } catch (error) {
    await rm(staging, { force: true });
    throw error;
  }
  return Object.freeze({ ...request, output: destination });
};

export const readVerifiedEngineExecutionRequest = async ({ requestPath, engineRoot, inputRoot }) => {
  const source = await readFile(resolve(requestPath), "utf8");
  let document;
  try {
    document = JSON.parse(source);
  } catch (error) {
    fail("invalid-engine-execution-request-json", "Engine execution request is not valid JSON", { cause: error.message });
  }
  validateEngineExecutionRequest(document);
  const [engine, input] = await Promise.all([
    identifyBuildEngine(engineRoot),
    identifyComponentInputClosure(inputRoot),
  ]);
  if (engine.identitySha256 !== document.engine.identitySha256 || engine.fileCount !== document.engine.fileCount) fail("engine-execution-identity-drift", "Installed build engine differs from the requested engine identity");
  if (input.identitySha256 !== document.component.inputClosureSha256) fail("component-input-identity-drift", "Mounted component input closure differs from the execution request");
  return Object.freeze({ document: Object.freeze(document), sha256: sha256(canonicalJson(document)), engine, input });
};
