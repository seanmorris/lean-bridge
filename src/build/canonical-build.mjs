import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { ComponentBuildPlanError, prepareComponentBuildPlan } from "./component-plan.mjs";
import { analyzeLeanProject } from "../analyze/lean-project.mjs";
import { generateCompilerAdapters } from "./compiler-adapters.mjs";
import { prepareComponentCompilationPlan, writeComponentCompilationInputs } from "./component-compilation-plan.mjs";
import { writeEngineExecutionRequest } from "./engine-execution-request.mjs";
import { canonicalJson } from "../capsule/node.mjs";
import { readVerifiedCanonicalBundle } from "../release/canonical-bundle-input.mjs";
import { validateComponentReleaseBundleManifest } from "../release/component-release-bundle.mjs";
import { parsePublicationIndex } from "../release/release-rehearsal.mjs";
import { CanonicalBuildError } from "./build-error.mjs";
import { processBuildRunner } from "./process-runner.mjs";

export { CanonicalBuildError, processBuildRunner };

const sha256 = value => createHash("sha256").update(value).digest("hex");
const backendNames = new Set(["auto", "docker", "nix"]);
const installedEngineRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const componentEngineInstallable = async engineRoot => {
  const root = resolve(engineRoot);
  let gitWorktree = false;
  try {
    const git = await stat(join(root, ".git"));
    gitWorktree = git.isDirectory() || git.isFile();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const flake = gitWorktree ? `git+${pathToFileURL(root).href}` : `path:${root}`;
  return `${flake}#component-build-engine`;
};

const fail = (code, message, options) => {
  throw new CanonicalBuildError(code, message, options);
};

const exactKeys = (value, keys, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-builder-manifest", `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("invalid-builder-manifest", `${label} fields must be closed`, { details: { actual, expected } });
  }
};

const probe = async ({ runner, command, args }) => {
  try {
    const result = await runner.capture({ command, args, timeoutMs: 15_000 });
    return { available: true, version: (result.stdout || result.stderr).trim() || "available" };
  } catch (error) {
    return { available: false, version: null, reason: error.code === "ENOENT" ? "command-not-found" : error.code ?? "probe-failed" };
  }
};

export const detectBuildBackend = async ({
  environment = process.env,
  runner = processBuildRunner,
} = {}) => {
  const requested = environment.LEAN_BRIDGE_BUILD_BACKEND ?? "auto";
  if (!backendNames.has(requested)) {
    fail("invalid-build-backend", `LEAN_BRIDGE_BUILD_BACKEND must be auto, docker, or nix; received ${requested}`);
  }
  const dockerCommand = environment.LEAN_BRIDGE_DOCKER ?? "docker";
  const nixCommand = environment.LEAN_BRIDGE_NIX ?? "nix";
  const [docker, nix] = await Promise.all([
    probe({ runner, command: dockerCommand, args: ["info", "--format", "{{.ServerVersion}}"] }),
    probe({ runner, command: nixCommand, args: ["--version"] }),
  ]);
  const available = { docker, nix };
  if (requested === "docker" && !docker.available) {
    fail("docker-unavailable", "Docker was explicitly selected but its daemon is unavailable", {
      hint: "Install and start Docker, or set LEAN_BRIDGE_BUILD_BACKEND=nix.", details: available,
    });
  }
  if (requested === "nix" && !nix.available) {
    fail("nix-unavailable", "Native Nix was explicitly selected but is unavailable", {
      hint: "Install Nix, or set LEAN_BRIDGE_BUILD_BACKEND=docker.", details: available,
    });
  }
  if (requested === "docker" || (requested === "auto" && docker.available)) {
    return Object.freeze({ backend: "docker", command: dockerCommand, version: docker.version, available });
  }
  if (requested === "nix" || (requested === "auto" && nix.available)) {
    return Object.freeze({ backend: "nix", command: nixCommand, version: nix.version, available });
  }
  fail("build-tools-unavailable", "Lean Bridge requires Docker or native Nix to run the canonical flake", {
    hint: "Install and start Docker, or install Nix and run with LEAN_BRIDGE_BUILD_BACKEND=nix.", details: available,
  });
};

export const readBuilderManifest = async projectRoot => {
  const directory = join(resolve(projectRoot), "containers", "builder");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  } catch (error) {
    fail("invalid-builder-manifest", "The pinned builder manifest is missing or invalid", { details: { cause: error.message } });
  }
  exactKeys(manifest, [
    "schemaVersion", "name", "platform", "sourceDateEpoch", "image", "bases", "files",
    "definitionSha256", "execution", "flakeOutputs",
  ], "builder manifest");
  if (manifest.schemaVersion !== 1 || manifest.platform !== "linux/amd64") fail("invalid-builder-manifest", "The builder manifest version or platform is unsupported");
  if (!Number.isSafeInteger(manifest.sourceDateEpoch) || manifest.sourceDateEpoch <= 0) fail("invalid-builder-manifest", "The builder source date epoch is invalid");
  exactKeys(manifest.image, ["localTag", "configSha256", "publishedReference", "publicationStatus"], "builder image");
  if (!/^lean-bridge-builder:[0-9a-f]{16}$/.test(manifest.image.localTag)) fail("invalid-builder-manifest", "The local builder tag is invalid");
  if (!/^[0-9a-f]{64}$/.test(manifest.image.configSha256)) fail("invalid-builder-manifest", "The builder config digest is invalid");
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) fail("invalid-builder-manifest", "The builder file inventory is empty");
  const records = [];
  for (const item of [...manifest.files].sort((left, right) => left.path.localeCompare(right.path))) {
    exactKeys(item, ["path", "sha256"], "builder file");
    if (item.path.startsWith("/") || item.path.split("/").includes("..") || !/^[0-9a-f]{64}$/.test(item.sha256)) {
      fail("invalid-builder-manifest", `Invalid builder file record ${item.path}`);
    }
    const bytes = await readFile(join(directory, item.path));
    const actual = sha256(bytes);
    if (actual !== item.sha256) fail("builder-definition-drift", `Builder file changed: ${item.path}`, { details: { expected: item.sha256, actual } });
    records.push(`${actual}  ${item.path}\n`);
  }
  const identity = sha256(records.join(""));
  if (identity !== manifest.definitionSha256 || !manifest.image.localTag.endsWith(identity.slice(0, 16))) {
    fail("builder-definition-drift", "The builder definition identity differs from its file inventory");
  }
  const dockerfile = await readFile(join(directory, "Dockerfile"), "utf8");
  for (const base of manifest.bases) {
    if (typeof base.reference !== "string" || !/@sha256:[0-9a-f]{64}$/.test(base.reference) || !dockerfile.includes(base.reference)) {
      fail("builder-base-drift", `Pinned builder base is absent from Dockerfile: ${base.reference}`);
    }
  }
  if (JSON.stringify(manifest.flakeOutputs) !== JSON.stringify(["universal-release-bundle", "release-rehearsal", "component-build-engine"])) {
    fail("builder-output-drift", "The builder must expose the canonical bundle, release rehearsal, and component engine flake outputs");
  }
  return Object.freeze({ directory, manifest: Object.freeze(manifest) });
};

const assertOutputIsAbsent = async ({ projectRoot, outputRoot }) => {
  const project = resolve(projectRoot);
  const output = resolve(outputRoot);
  if (output === project || project.startsWith(`${output}${sep}`)) fail("unsafe-build-output", "Build output cannot replace the project or one of its parents");
  try {
    await stat(output);
    fail("build-output-exists", `Build output already exists: ${output}`, { hint: "Choose a new empty output path." });
  } catch (error) {
    if (error instanceof CanonicalBuildError) throw error;
    if (error.code !== "ENOENT") throw error;
  }
  return output;
};

const runNativeNix = async ({ root, staging, selection, runner, environment }) => {
  const isolatedStore = environment.LEAN_BRIDGE_NIX_STORE ?? null;
  const stagingParent = resolve(staging, "..");
  const storeRoot = isolatedStore === null ? null : resolve(isolatedStore);
  if (storeRoot !== null && (storeRoot === stagingParent || !storeRoot.startsWith(`${stagingParent}${sep}`))) {
    fail("unsafe-nix-store", "LEAN_BRIDGE_NIX_STORE must be a child of the generated build staging parent");
  }
  const common = [
    "--extra-experimental-features", "nix-command flakes",
    ...(environment.LEAN_BRIDGE_NIX_REFRESH === "1" ? ["--refresh"] : []),
    ...(storeRoot === null ? [] : ["--store", `local?root=${storeRoot}`]),
  ];
  await runner.capture({
    command: selection.command,
    args: [...common, "build", "--no-link", "--no-write-lock-file", ".#universal-release-bundle"],
    cwd: root,
  });
  const bundle = await runner.capture({
    command: selection.command,
    args: [...common, "path-info", "--no-write-lock-file", ".#universal-release-bundle"],
    cwd: root,
  });
  await runner.capture({
    command: selection.command,
    args: [...common, "build", "--no-link", "--no-write-lock-file", ".#release-rehearsal"],
    cwd: root,
  });
  const packages = await runner.capture({
    command: selection.command,
    args: [...common, "path-info", "--no-write-lock-file", ".#release-rehearsal"],
    cwd: root,
  });
  const bundleStorePath = bundle.stdout.trim().split(/\s+/).at(-1);
  const packagesStorePath = packages.stdout.trim().split(/\s+/).at(-1);
  await cp(bundleStorePath, join(staging, "bundle"), { recursive: true, dereference: true, preserveTimestamps: true });
  await cp(packagesStorePath, join(staging, "packages"), { recursive: true, dereference: true, preserveTimestamps: true });
  await writeFile(join(staging, "build-report.json"), canonicalJson({
    schemaVersion: 1,
    backend: "native-nix",
    builder: selection.version,
    bundleStorePath,
    packagesStorePath,
    bundlePath: "bundle",
    packagesPath: "packages",
    flakeOutputs: ["universal-release-bundle", "release-rehearsal"],
    sourceReadOnly: true,
    componentBinariesRebuiltByProjection: false,
  }));
};

export const runNativeComponentEngine = async ({
  engineRoot,
  inputRoot,
  requestPath,
  outputRoot,
  selection,
  runner,
  environment,
}) => {
  const installable = await componentEngineInstallable(engineRoot);
  const isolatedStore = environment.LEAN_BRIDGE_NIX_STORE ?? null;
  const common = [
    "--extra-experimental-features", "nix-command flakes",
    ...(environment.LEAN_BRIDGE_NIX_REFRESH === "1" ? ["--refresh"] : []),
    ...(isolatedStore === null ? [] : ["--store", `local?root=${resolve(isolatedStore)}`]),
  ];
  await runner.capture({
    command: selection.command,
    args: [
      ...common,
      "run", "--no-write-lock-file", installable, "--",
      "--request", resolve(requestPath),
      "--component", resolve(inputRoot),
      "--output", resolve(outputRoot),
      "--engine", resolve(engineRoot),
      "--backend", "native-nix",
    ],
    cwd: resolve(engineRoot),
    env: environment,
    timeoutMs: 60 * 60 * 1000,
  });
};

const prepareDockerNixClosureCache = async ({ engineRoot, selection, runner, environment, cache }) => {
  if (cache.policy === "off" || selection.available.nix.available !== true) return null;
  const nixCommand = environment.LEAN_BRIDGE_NIX ?? "nix";
  const root = resolve(environment.LEAN_BRIDGE_DOCKER_NIX_CACHE_ROOT ?? join(engineRoot, ".lean-bridge-docker-nix"));
  if (root.includes(",")) fail("unsupported-docker-mount-path", "Docker Nix cache path cannot contain commas");
  await mkdir(root, { recursive: true });
  const common = [
    "--extra-experimental-features", "nix-command flakes",
    ...(cache.policy === "refresh" ? ["--refresh"] : []),
  ];
  const installable = await componentEngineInstallable(engineRoot);
  const info = await runner.capture({
    command: nixCommand,
    args: [...common, "path-info", "--no-write-lock-file", installable],
    cwd: resolve(engineRoot),
    timeoutMs: 60 * 60 * 1000,
  });
  const storePath = info.stdout.trim().split(/\s+/).at(-1);
  if (!/^\/nix\/store\/[0-9a-z]{32}-lean-bridge-component-engine$/.test(storePath)) {
    fail("component-engine-store-path-invalid", "Native Nix returned an invalid component engine store path", { details: { storePath } });
  }
  await runner.capture({
    command: nixCommand,
    args: [...common, "copy", "--to", `local?root=${root}&require-sigs=false`, storePath],
    cwd: resolve(engineRoot),
    timeoutMs: 60 * 60 * 1000,
  });
  const physicalStore = join(root, "nix", "store");
  const program = `${storePath}/bin/lean-bridge-component-engine`;
  try {
    await stat(join(root, program.replace(/^\/+/, "")));
  } catch (error) {
    fail("component-engine-cache-incomplete", "Docker Nix closure cache does not contain the component engine program", { details: { root, program, cause: error.message } });
  }
  return Object.freeze({ physicalStore, program, storePath });
};

export const runDockerComponentEngine = async ({
  engineRoot,
  inputRoot,
  requestPath,
  outputRoot,
  selection,
  runner,
  environment,
  cache,
}) => {
  if (cache.directory !== null) {
    fail("cache-directory-unsupported", "An explicit cache directory requires the native Nix backend", {
      hint: "Select native Nix or omit --cache-directory when Docker is active.",
    });
  }
  const builder = await readBuilderManifest(engineRoot);
  const imageOverride = environment.LEAN_BRIDGE_BUILDER_IMAGE ?? null;
  let image = builder.manifest.image.localTag;
  if (imageOverride !== null) {
    if (!/@sha256:[0-9a-f]{64}$/.test(imageOverride)) {
      fail("unpinned-builder-image", "LEAN_BRIDGE_BUILDER_IMAGE must use an immutable sha256 digest");
    }
    image = imageOverride;
  } else {
    image = (await buildPinnedBuilderImage({
      projectRoot: engineRoot,
      dockerCommand: selection.command,
      runner,
      builder,
      cachePolicy: cache.policy,
    })).image;
  }
  const closureCache = await prepareDockerNixClosureCache({ engineRoot, selection, runner, environment, cache });
  const paths = [engineRoot, inputRoot, dirname(requestPath), dirname(outputRoot), ...(closureCache === null ? [] : [closureCache.physicalStore])];
  if (paths.some(path => path.includes(","))) fail("unsupported-docker-mount-path", "Docker build paths cannot contain commas");
  await mkdir(dirname(outputRoot), { recursive: true });
  await runner.capture({
    command: selection.command,
    args: [
      "run", "--rm", "--platform", builder.manifest.platform, "--network", "bridge",
      "--mount", `type=bind,source=${resolve(engineRoot)},target=/workspace/engine,readonly`,
      "--mount", `type=bind,source=${resolve(inputRoot)},target=/workspace/component,readonly`,
      "--mount", `type=bind,source=${resolve(dirname(requestPath))},target=/workspace/request,readonly`,
      "--mount", `type=bind,source=${resolve(dirname(outputRoot))},target=/workspace/output`,
      ...(closureCache === null ? [] : ["--mount", `type=bind,source=${closureCache.physicalStore},target=/nix/store,readonly`]),
      "--env", `LEAN_BRIDGE_REQUEST=/workspace/request/${basename(requestPath)}`,
      "--env", `LEAN_BRIDGE_OUTPUT=/workspace/output/${basename(outputRoot)}`,
      ...(closureCache === null ? [] : ["--env", `LEAN_BRIDGE_ENGINE_PROGRAM=${closureCache.program}`]),
      "--env", `LEAN_BRIDGE_OUTPUT_UID=${typeof process.getuid === "function" ? process.getuid() : 0}`,
      "--env", `LEAN_BRIDGE_OUTPUT_GID=${typeof process.getgid === "function" ? process.getgid() : 0}`,
      image, "component",
    ],
    cwd: resolve(engineRoot),
    timeoutMs: 60 * 60 * 1000,
  });
};

const runDockerNix = async ({ root, staging, selection, builder, runner, environment, cache }) => {
  if (cache.directory !== null) {
    fail("cache-directory-unsupported", "An explicit cache directory requires the native Nix backend", {
      hint: "Select native Nix or omit --cache-directory when Docker is active.",
    });
  }
  const imageOverride = environment.LEAN_BRIDGE_BUILDER_IMAGE ?? null;
  let image = builder.manifest.image.localTag;
  if (imageOverride !== null) {
    if (!/@sha256:[0-9a-f]{64}$/.test(imageOverride)) {
      fail("unpinned-builder-image", "LEAN_BRIDGE_BUILDER_IMAGE must use an immutable sha256 digest");
    }
    image = imageOverride;
  } else image = (await buildPinnedBuilderImage({
    projectRoot: root, dockerCommand: selection.command, runner, builder, cachePolicy: cache.policy,
  })).image;
  if (root.includes(",") || staging.includes(",")) fail("unsupported-docker-mount-path", "Docker build paths cannot contain commas");
  await runner.capture({
    command: selection.command,
    args: [
      "run", "--rm", "--platform", builder.manifest.platform, "--network", "bridge",
      "--mount", `type=bind,source=${root},target=/workspace/source,readonly`,
      "--mount", `type=bind,source=${staging},target=/workspace/output`,
      "--env", `LEAN_BRIDGE_OUTPUT_UID=${typeof process.getuid === "function" ? process.getuid() : 0}`,
      "--env", `LEAN_BRIDGE_OUTPUT_GID=${typeof process.getgid === "function" ? process.getgid() : 0}`,
      image, "build",
    ],
    cwd: root,
    timeoutMs: 60 * 60 * 1000,
  });
};

export const buildPinnedBuilderImage = async ({
  projectRoot,
  dockerCommand = "docker",
  runner = processBuildRunner,
  builder = null,
  cachePolicy = "use",
} = {}) => {
  const root = resolve(projectRoot ?? process.cwd());
  const resolvedBuilder = builder ?? await readBuilderManifest(root);
  const image = resolvedBuilder.manifest.image.localTag;
  await runner.capture({
    command: dockerCommand,
    args: [
      "build", "--pull", ...(cachePolicy === "use" ? [] : ["--no-cache"]),
      "--build-arg", `SOURCE_DATE_EPOCH=${resolvedBuilder.manifest.sourceDateEpoch}`,
      "--tag", image,
      resolvedBuilder.directory,
    ],
    cwd: root,
  });
  const inspected = await runner.capture({
    command: dockerCommand,
    args: ["image", "inspect", "--format", "{{.Id}}", image],
    cwd: root,
  });
  const actual = inspected.stdout.trim().replace(/^sha256:/, "");
  if (actual !== resolvedBuilder.manifest.image.configSha256) {
    fail("builder-image-drift", "The locally built builder image differs from its reviewed config digest", {
      details: { expected: resolvedBuilder.manifest.image.configSha256, actual },
    });
  }
  return Object.freeze({
    image,
    configSha256: actual,
    definitionSha256: resolvedBuilder.manifest.definitionSha256,
  });
};

const validateBuildOutput = async staging => {
  const { manifest, manifestSha256 } = await readVerifiedCanonicalBundle(join(staging, "bundle"));
  const index = parsePublicationIndex(await readFile(join(staging, "packages", "publication-index.json"), "utf8"));
  if (index.bundle.canonicalManifestSha256 !== manifestSha256) {
    fail("build-package-identity-drift", "Package projections do not name the canonical bundle produced by this build");
  }
  const report = JSON.parse(await readFile(join(staging, "build-report.json"), "utf8"));
  if (report.componentBinariesRebuiltByProjection !== false || report.sourceReadOnly !== true) {
    fail("invalid-build-report", "The builder did not preserve the compile-once and read-only source policies");
  }
  return { manifest, manifestSha256, index, report };
};

const selectPublicationTargets = (index, requested) => {
  const selected = requested.length === 0
    ? index.packages.filter(item => item.status === "ready")
    : index.packages.filter(item => requested.includes(item.ecosystem) || requested.includes(item.target));
  for (const target of requested) {
    if (!index.packages.some(item => item.ecosystem === target || item.target === target)) {
      fail("unknown-package-target", `The canonical package manifest does not define target ${target}`, {
        hint: `Choose one of: ${index.packages.map(item => item.ecosystem).sort().join(", ")}.`,
      });
    }
  }
  const ineligible = selected.filter(item => item.status !== "ready");
  if (ineligible.length > 0) {
    fail("package-target-ineligible", `Requested package target ${ineligible[0].ecosystem} is not eligible`, {
      hint: ineligible[0].reason,
      details: { targets: ineligible.map(item => ({ ecosystem: item.ecosystem, target: item.target, reason: item.reason })) },
    });
  }
  return Object.freeze(selected
    .map(item => Object.freeze({ ecosystem: item.ecosystem, target: item.target, name: item.name, version: item.version }))
    .sort((left, right) => left.ecosystem.localeCompare(right.ecosystem)));
};

const readComponentEngineOutput = async ({ executionRoot, request }) => {
  const bundleRoot = join(executionRoot, request.document.output.bundleDirectory);
  const manifestPath = join(bundleRoot, "component-release-bundle.json");
  const reportPath = join(executionRoot, request.document.output.executionReport);
  let manifest;
  let report;
  try {
    [manifest, report] = await Promise.all([
      readFile(manifestPath, "utf8").then(JSON.parse),
      readFile(reportPath, "utf8").then(JSON.parse),
    ]);
  } catch (error) {
    fail("component-engine-output-invalid", "Component engine did not emit its bundle and execution report", { details: { cause: error.message } });
  }
  validateComponentReleaseBundleManifest(manifest);
  const manifestSha256 = sha256(canonicalJson(manifest));
  if (
    report?.schemaVersion !== 1 ||
    report.kind !== "lean-bridge-engine-execution-report" ||
    report.requestSha256 !== request.sha256 ||
    report.component !== request.document.component.id ||
    report.bundleManifestSha256 !== manifestSha256 ||
    report.sourceReadOnly !== true ||
    report.authorizedOutputsOnly !== true ||
    report.runtimeBinaryIncluded !== false
  ) fail("component-engine-output-invalid", "Component execution report does not match the requested component bundle");
  return Object.freeze({ bundleRoot, manifest: Object.freeze(manifest), manifestSha256, report: Object.freeze(report) });
};

const buildPlainComponentProject = async ({
  root,
  engine,
  output,
  componentPlan,
  selection,
  runner,
  environment,
  targets,
  cache,
  signal,
  onProgress,
}) => {
  await mkdir(dirname(output), { recursive: true });
  const workParent = selection.backend === "docker"
    ? resolve(environment.LEAN_BRIDGE_DOCKER_STAGING_ROOT ?? engine)
    : dirname(output);
  const work = await mkdtemp(join(workParent, ".lean-bridge-component-work-"));
  const finalStaging = await mkdtemp(join(dirname(output), ".lean-bridge-build-"));
  const isolatedStore = selection.backend === "nix" && cache.policy === "off" ? `${work}-nix-store` : null;
  try {
    onProgress?.({ phase: "prepare", state: "started", message: "Preparing the verified component input" });
    const analysis = await analyzeLeanProject(root, { signal, targets });
    const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
    const compilationPlan = await prepareComponentCompilationPlan({ projectRoot: root, analysis, componentPlan, compilerAdapters });
    const inputRoot = join(work, "component");
    await writeComponentCompilationInputs({ projectRoot: root, outputRoot: inputRoot, analysis, componentPlan, compilerAdapters });
    const requestPath = join(work, "request", "engine-execution-request.json");
    const request = await writeEngineExecutionRequest({
      output: requestPath,
      engineRoot: engine,
      inputRoot,
      componentPlan,
      compilationPlan,
      cachePolicy: cache.policy,
      targets,
    });
    onProgress?.({ phase: "prepare", state: "completed", message: "Verified component input prepared" });
    signal?.throwIfAborted();
    const effectiveEnvironment = {
      ...environment,
      ...(isolatedStore !== null
        ? { LEAN_BRIDGE_NIX_STORE: isolatedStore }
        : cache.directory === null ? {} : { LEAN_BRIDGE_NIX_STORE: cache.directory }),
      ...(cache.policy === "refresh" ? { LEAN_BRIDGE_NIX_REFRESH: "1" } : {}),
    };
    const executionRoot = selection.backend === "docker"
      ? join(work, "docker-output", "execution")
      : join(work, "execution");
    onProgress?.({ phase: "compile", state: "started", message: "Compiling the Lean component once" });
    if (selection.backend === "docker") {
      await runDockerComponentEngine({
        engineRoot: engine, inputRoot, requestPath, outputRoot: executionRoot,
        selection, runner, environment: effectiveEnvironment, cache,
      });
    } else {
      await runNativeComponentEngine({ engineRoot: engine, inputRoot, requestPath, outputRoot: executionRoot, selection, runner, environment: effectiveEnvironment });
    }
    signal?.throwIfAborted();
    onProgress?.({ phase: "compile", state: "completed", message: "Lean component compiled against the shared runtime contract" });
    onProgress?.({ phase: "validate", state: "started", message: "Validating component and provenance identities" });
    const checked = await readComponentEngineOutput({ executionRoot, request });
    await cp(checked.bundleRoot, join(finalStaging, "bundle"), { recursive: true, dereference: true, preserveTimestamps: true });
    await cp(join(executionRoot, request.document.output.executionReport), join(finalStaging, "engine-execution-report.json"));
    await cp(requestPath, join(finalStaging, "engine-execution-request.json"));
    onProgress?.({ phase: "validate", state: "completed", message: "Component and provenance identities validated" });
    await rename(finalStaging, output);
    return Object.freeze({
      schemaVersion: 1,
      backend: selection.backend,
      backendVersion: selection.version,
      output,
      bundle: Object.freeze({
        path: "bundle",
        component: checked.manifest.component.id,
        manifestSha256: checked.manifestSha256,
        identitySha256: checked.manifest.identitySha256,
        runtime: checked.manifest.runtime,
      }),
      targets: Object.freeze([...targets]),
      cache,
      engineIdentitySha256: request.document.engine.identitySha256,
      executionRequestSha256: request.sha256,
      componentPlanSha256: componentPlan.sha256,
      compilationPlanSha256: compilationPlan.sha256,
      sourceReadOnly: true,
      componentBinariesRebuiltByProjection: false,
    });
  } catch (error) {
    await rm(finalStaging, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(work, { recursive: true, force: true });
    if (isolatedStore !== null) await rm(isolatedStore, { recursive: true, force: true });
  }
};

export const buildCanonicalProject = async ({
  projectRoot,
  engineRoot = installedEngineRoot,
  outputRoot = null,
  environment = process.env,
  runner = processBuildRunner,
  targets = [],
  cache = { policy: "use", directory: null },
  signal = undefined,
  onProgress = undefined,
} = {}) => {
  const root = resolve(projectRoot ?? process.cwd());
  const engine = resolve(engineRoot);
  if (!Array.isArray(targets) || targets.some(target => typeof target !== "string" || target === "")) {
    fail("invalid-package-targets", "Build targets must be an array of non-empty names");
  }
  if (new Set(targets).size !== targets.length) fail("invalid-package-targets", "Build targets must be unique");
  if (cache === null || typeof cache !== "object" || !new Set(["use", "refresh", "off"]).has(cache.policy)) {
    fail("invalid-cache-policy", "Build cache policy must be use, refresh, or off");
  }
  const normalizedCache = Object.freeze({ policy: cache.policy, directory: cache.directory ?? null });
  if (normalizedCache.directory !== null && typeof normalizedCache.directory !== "string") {
    fail("invalid-cache-directory", "Build cache directory must be a path or null");
  }
  if (normalizedCache.policy === "off" && normalizedCache.directory !== null) {
    fail("invalid-cache-policy", "Build cache directory must be null when caching is off");
  }
  const selectedRunner = signal === undefined
    ? runner
    : Object.freeze({ capture: request => runner.capture({ ...request, signal }) });
  signal?.throwIfAborted();
  let componentPlan;
  try {
    componentPlan = await prepareComponentBuildPlan({ projectRoot: root, engineRoot: engine, targets, signal });
  } catch (error) {
    if (!(error instanceof ComponentBuildPlanError)) throw error;
    fail(error.code, error.message, { details: error.details });
  }
  onProgress?.({ phase: "backend", state: "started", message: "Preparing the isolated build environment" });
  const selection = await detectBuildBackend({ environment, runner: selectedRunner });
  onProgress?.({ phase: "backend", state: "completed", message: "Isolated build environment ready" });
  signal?.throwIfAborted();
  const output = await assertOutputIsAbsent({
    projectRoot: root,
    outputRoot: outputRoot ?? join(root, "build", "lean-bridge-release"),
  });
  if (root !== engine) {
    return buildPlainComponentProject({
      root, engine, output, componentPlan, selection, runner: selectedRunner,
      environment, targets, cache: normalizedCache, signal, onProgress,
    });
  }
  const builder = await readBuilderManifest(engine);
  await mkdir(dirname(output), { recursive: true });
  const staging = await mkdtemp(join(dirname(output), ".lean-bridge-build-"));
  const isolatedStore = selection.backend === "nix" && normalizedCache.policy === "off" ? `${staging}-nix-store` : null;
  try {
    const effectiveEnvironment = {
      ...environment,
      ...(isolatedStore !== null
        ? { LEAN_BRIDGE_NIX_STORE: isolatedStore }
        : normalizedCache.directory === null ? {} : { LEAN_BRIDGE_NIX_STORE: normalizedCache.directory }),
      ...(normalizedCache.policy === "refresh" ? { LEAN_BRIDGE_NIX_REFRESH: "1" } : {}),
    };
    onProgress?.({ phase: "compile", state: "started", message: "Building component and package artifacts" });
    if (selection.backend === "docker") {
      await runDockerNix({ root, staging, selection, builder, runner: selectedRunner, environment: effectiveEnvironment, cache: normalizedCache });
    } else {
      await runNativeNix({ root, staging, selection, runner: selectedRunner, environment: effectiveEnvironment });
    }
    signal?.throwIfAborted();
    onProgress?.({ phase: "compile", state: "completed", message: "Component and package artifacts built" });
    onProgress?.({ phase: "validate", state: "started", message: "Validating package identities and selected targets" });
    const checked = await validateBuildOutput(staging);
    const selectedTargets = selectPublicationTargets(checked.index, targets);
    signal?.throwIfAborted();
    onProgress?.({ phase: "validate", state: "completed", message: "Package identities and selected targets validated" });
    await rename(staging, output);
    return Object.freeze({
      schemaVersion: 1,
      backend: selection.backend,
      backendVersion: selection.version,
      output,
      bundle: {
        path: "bundle",
        component: checked.manifest.component.id,
        canonicalManifestSha256: checked.manifestSha256,
        coreArtifactSetSha256: checked.index.bundle.coreArtifactSetSha256,
      },
      packages: {
        path: "packages",
        ready: checked.index.publication.ready,
        omitted: checked.index.publication.omitted,
        selected: selectedTargets,
      },
      cache: normalizedCache,
      builderDefinitionSha256: builder.manifest.definitionSha256,
      componentPlanSha256: componentPlan.sha256,
      sourceReadOnly: true,
      componentBinariesRebuiltByProjection: false,
    });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  } finally {
    if (isolatedStore !== null) await rm(isolatedStore, { recursive: true, force: true });
  }
};

export const relativeBuildOutput = ({ projectRoot, outputRoot }) =>
  relative(resolve(projectRoot), resolve(outputRoot)).replaceAll("\\", "/");
