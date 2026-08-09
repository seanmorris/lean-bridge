import { spawn } from "node:child_process";
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
import { dirname, join, relative, resolve, sep } from "node:path";

import { canonicalJson } from "../capsule/node.mjs";
import { readVerifiedCanonicalBundle } from "../release/canonical-bundle-input.mjs";
import { parsePublicationIndex } from "../release/release-rehearsal.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const backendNames = new Set(["auto", "docker", "nix"]);

export class CanonicalBuildError extends Error {
  constructor(code, message, { hint = null, details = {} } = {}) {
    super(message);
    this.name = "CanonicalBuildError";
    this.code = code;
    this.hint = hint;
    this.details = details;
  }
}

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

const capture = ({ command, args, cwd, env = process.env, timeoutMs = 30 * 60 * 1000 }) => new Promise((accept, reject) => {
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  const stdout = [];
  const stderr = [];
  let bytes = 0;
  const maximum = 32 * 1024 * 1024;
  const collect = target => chunk => {
    bytes += chunk.length;
    if (bytes > maximum) {
      child.kill("SIGKILL");
      reject(new CanonicalBuildError("build-output-limit", `${command} exceeded the 32 MiB diagnostic limit`));
      return;
    }
    target.push(chunk);
  };
  child.stdout.on("data", collect(stdout));
  child.stderr.on("data", collect(stderr));
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
    reject(new CanonicalBuildError("build-timeout", `${command} exceeded its execution deadline`));
  }, timeoutMs);
  child.once("error", error => {
    clearTimeout(timer);
    reject(error);
  });
  child.once("close", code => {
    clearTimeout(timer);
    const result = {
      code,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    };
    if (code === 0) accept(result);
    else reject(new CanonicalBuildError("build-command-failed", `${command} exited with status ${code}`, {
      details: { command, args, stderr: result.stderr.slice(-8000), stdout: result.stdout.slice(-8000) },
    }));
  });
});

export const processBuildRunner = Object.freeze({ capture });

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
  if (JSON.stringify(manifest.flakeOutputs) !== JSON.stringify(["universal-release-bundle", "release-rehearsal"])) {
    fail("builder-output-drift", "The builder must invoke the canonical bundle and release rehearsal flake outputs");
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

const runDockerNix = async ({ root, staging, selection, builder, runner, environment }) => {
  const imageOverride = environment.LEAN_BRIDGE_BUILDER_IMAGE ?? null;
  let image = builder.manifest.image.localTag;
  if (imageOverride !== null) {
    if (!/@sha256:[0-9a-f]{64}$/.test(imageOverride)) {
      fail("unpinned-builder-image", "LEAN_BRIDGE_BUILDER_IMAGE must use an immutable sha256 digest");
    }
    image = imageOverride;
  } else image = (await buildPinnedBuilderImage({
    projectRoot: root, dockerCommand: selection.command, runner, builder,
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
} = {}) => {
  const root = resolve(projectRoot ?? process.cwd());
  const resolvedBuilder = builder ?? await readBuilderManifest(root);
  const image = resolvedBuilder.manifest.image.localTag;
  await runner.capture({
    command: dockerCommand,
    args: [
      "build", "--pull",
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

export const buildCanonicalProject = async ({
  projectRoot,
  outputRoot = null,
  environment = process.env,
  runner = processBuildRunner,
} = {}) => {
  const root = resolve(projectRoot ?? process.cwd());
  const selection = await detectBuildBackend({ environment, runner });
  const builder = await readBuilderManifest(root);
  const output = await assertOutputIsAbsent({
    projectRoot: root,
    outputRoot: outputRoot ?? join(root, "build", "lean-bridge-release"),
  });
  await mkdir(dirname(output), { recursive: true });
  const staging = await mkdtemp(join(dirname(output), ".lean-bridge-build-"));
  try {
    if (selection.backend === "docker") {
      await runDockerNix({ root, staging, selection, builder, runner, environment });
    } else {
      await runNativeNix({ root, staging, selection, runner, environment });
    }
    const checked = await validateBuildOutput(staging);
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
      },
      builderDefinitionSha256: builder.manifest.definitionSha256,
      sourceReadOnly: true,
      componentBinariesRebuiltByProjection: false,
    });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
};

export const relativeBuildOutput = ({ projectRoot, outputRoot }) =>
  relative(resolve(projectRoot), resolve(outputRoot)).replaceAll("\\", "/");
