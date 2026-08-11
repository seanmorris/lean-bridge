import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildCanonicalProject,
  CanonicalBuildError,
  detectBuildBackend,
  processBuildRunner,
  readBuilderManifest,
} from "../src/build/canonical-build.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { rehearseRelease } from "../src/release/release-rehearsal.mjs";
import { buildUniversalReleaseBundle } from "../src/release/universal-release-bundle.mjs";

const unavailable = command => {
  const error = new Error(`${command} is unavailable`);
  error.code = "ENOENT";
  return error;
};

test("backend selection prefers Docker, falls back to Nix, and honors explicit policy", async () => {
  const both = {
    capture: async ({ command }) => ({ code: 0, stdout: command === "docker" ? "24.0.9\n" : "nix (Nix) 2.24.11\n", stderr: "" }),
  };
  assert.equal((await detectBuildBackend({ runner: both, environment: {} })).backend, "docker");
  assert.equal((await detectBuildBackend({ runner: both, environment: { LEAN_BRIDGE_BUILD_BACKEND: "nix" } })).backend, "nix");

  const nixOnly = {
    capture: async ({ command }) => {
      if (command === "docker") throw unavailable(command);
      return { code: 0, stdout: "nix (Nix) 2.24.11\n", stderr: "" };
    },
  };
  assert.equal((await detectBuildBackend({ runner: nixOnly, environment: {} })).backend, "nix");
  await assert.rejects(
    detectBuildBackend({ runner: nixOnly, environment: { LEAN_BRIDGE_BUILD_BACKEND: "docker" } }),
    error => error instanceof CanonicalBuildError && error.code === "docker-unavailable" && /set LEAN_BRIDGE_BUILD_BACKEND=nix/.test(error.hint),
  );
  await assert.rejects(
    detectBuildBackend({ runner: both, environment: { LEAN_BRIDGE_BUILD_BACKEND: "podman" } }),
    error => error.code === "invalid-build-backend",
  );
});

test("missing build tools stop before creating the requested output", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-build-missing-"));
  const output = join(scratch, "result");
  try {
    const runner = { capture: async ({ command }) => { throw unavailable(command); } };
    await assert.rejects(
      buildCanonicalProject({ projectRoot: process.cwd(), outputRoot: output, runner, environment: {} }),
      error => error.code === "build-tools-unavailable" && /Install and start Docker/.test(error.hint),
    );
    await assert.rejects(access(output, constants.F_OK), error => error.code === "ENOENT");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("a plain project runs the isolated Nix engine without copying bridge infrastructure", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-plain-build-"));
  const output = join(scratch, "result");
  const calls = [];
  const progress = [];
  const runner = {
    capture: async request => {
      if (request.command === "docker") throw unavailable("docker");
      if (request.args[0] === "--version") return { code: 0, stdout: "nix (Nix) 2.24.11\n", stderr: "" };
      calls.push(request);
      assert.equal(request.args.includes("run"), true);
      const value = flag => request.args[request.args.indexOf(flag) + 1];
      await executeComponentEngineRequest({
        requestPath: value("--request"),
        inputRoot: value("--component"),
        outputRoot: value("--output"),
        engineRoot: process.cwd(),
        backend: "native-nix-test-double",
      });
      return { code: 0, stdout: "", stderr: "" };
    },
  };
  try {
    const result = await buildCanonicalProject({
      projectRoot: "tests/fixtures/onboarding/small",
      engineRoot: process.cwd(),
      outputRoot: output,
      targets: ["npm"],
      runner,
      environment: { LEAN_BRIDGE_BUILD_BACKEND: "nix" },
      onProgress: event => progress.push(event),
    });
    assert.equal(result.backend, "nix");
    assert.equal(result.bundle.component, "onboarding-small@1.0.0");
    assert.equal(result.bundle.runtime.artifactIncluded, false);
    assert.deepEqual(result.targets, ["npm"]);
    assert.match(result.executionRequestSha256, /^[0-9a-f]{64}$/);
    assert.equal(calls.length, 1);
    assert.match(calls[0].args.find(argument => argument.includes("#component-build-engine")), /^git\+file:\/\/\/.*#component-build-engine$/);
    const requestPath = calls[0].args[calls[0].args.indexOf("--request") + 1];
    const componentPath = calls[0].args[calls[0].args.indexOf("--component") + 1];
    assert.notEqual(requestPath, componentPath);
    assert.deepEqual((await readdir(output)).sort(), ["bundle", "engine-execution-report.json", "engine-execution-request.json"]);
    assert.deepEqual(progress.map(item => `${item.phase}:${item.state}`), [
      "backend:started", "backend:completed", "prepare:started", "prepare:completed",
      "compile:started", "compile:completed", "validate:started", "validate:completed",
    ]);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("a plain project runs the same closed request through separate Docker mounts", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-plain-docker-build-"));
  const output = join(scratch, "result");
  const calls = [];
  const sourceForMount = (args, target) => {
    const mount = args.find(argument => argument.includes(`target=${target}`));
    assert.ok(mount, `missing mount ${target}`);
    return mount.match(/source=([^,]+)/)[1];
  };
  const runner = {
    capture: async request => {
      calls.push(request);
      if (request.command === "nix") {
        if (request.args[0] === "--version") return { code: 0, stdout: "nix (Nix) 2.24.11\n", stderr: "" };
        const storePath = `/nix/store/${"a".repeat(32)}-lean-bridge-component-engine`;
        if (request.args.includes("path-info")) return { code: 0, stdout: `${storePath}\n`, stderr: "" };
        if (request.args.includes("copy")) {
          const destination = request.args[request.args.indexOf("--to") + 1];
          assert.match(destination, /^local\?root=.*&require-sigs=false$/);
          const cacheRoot = destination.slice("local?root=".length).split("&")[0];
          const program = join(cacheRoot, storePath.slice(1), "bin/lean-bridge-component-engine");
          await mkdir(join(program, ".."), { recursive: true });
          await writeFile(program, "#!/bin/sh\n", { mode: 0o755 });
          return { code: 0, stdout: "", stderr: "" };
        }
      }
      if (request.args[0] === "info") return { code: 0, stdout: "24.0.9\n", stderr: "" };
      if (request.args[0] === "build") return { code: 0, stdout: "builder ready\n", stderr: "" };
      if (request.args[0] === "image") return {
        code: 0,
        stdout: "sha256:93c7df682303a033e37acf2099b7bbdae0fd9d76103b993115f271469cd46325\n",
        stderr: "",
      };
      if (request.args[0] === "run") {
        const requestRoot = sourceForMount(request.args, "/workspace/request");
        const componentRoot = sourceForMount(request.args, "/workspace/component");
        const outputRoot = sourceForMount(request.args, "/workspace/output");
        await executeComponentEngineRequest({
          requestPath: join(requestRoot, "engine-execution-request.json"),
          inputRoot: componentRoot,
          outputRoot: join(outputRoot, "execution"),
          engineRoot: process.cwd(),
          backend: "docker-nix",
        });
        return { code: 0, stdout: "", stderr: "" };
      }
      throw new Error(`unexpected command: ${request.command} ${request.args.join(" ")}`);
    },
  };
  try {
    const result = await buildCanonicalProject({
      projectRoot: "tests/fixtures/onboarding/small",
      engineRoot: process.cwd(),
      outputRoot: output,
      targets: ["npm"],
      runner,
      environment: {
        LEAN_BRIDGE_BUILD_BACKEND: "docker",
        LEAN_BRIDGE_DOCKER_NIX_CACHE_ROOT: join(scratch, "cache"),
      },
    });
    assert.equal(result.backend, "docker");
    assert.equal(result.bundle.component, "onboarding-small@1.0.0");
    const pathInfo = calls.find(call => call.command === "nix" && call.args.includes("path-info"));
    assert.match(pathInfo.args.find(argument => argument.includes("#component-build-engine")), /^git\+file:\/\/\/.*#component-build-engine$/);
    const run = calls.find(call => call.args[0] === "run");
    assert.ok(run.args.some(argument => argument.endsWith("target=/workspace/engine,readonly")));
    assert.ok(run.args.some(argument => argument.endsWith("target=/workspace/component,readonly")));
    assert.ok(run.args.some(argument => argument.endsWith("target=/workspace/request,readonly")));
    assert.ok(run.args.some(argument => argument.endsWith("target=/workspace/output")));
    assert.ok(run.args.some(argument => argument.endsWith("target=/nix/store,readonly")));
    assert.ok(run.args.some(argument => argument.startsWith("LEAN_BRIDGE_ENGINE_PROGRAM=/nix/store/")));
    assert.equal(run.args.at(-1), "component");
    const [executionRequest, executionReport] = await Promise.all([
      readFile(join(output, "engine-execution-request.json"), "utf8").then(JSON.parse),
      readFile(join(output, "engine-execution-report.json"), "utf8").then(JSON.parse),
    ]);
    assert.equal(executionReport.backend, "docker-nix");
    assert.equal(executionReport.engineIdentitySha256, executionRequest.engine.identitySha256);
    assert.equal(executionReport.inputClosureSha256, executionRequest.component.inputClosureSha256);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("the reviewed Debian builder contains Nix, not a second compiler policy", async () => {
  const { manifest } = await readBuilderManifest(process.cwd());
  const dockerfile = await readFile("containers/builder/Dockerfile", "utf8");
  const entrypoint = await readFile("containers/builder/entrypoint.sh", "utf8");
  const flake = await readFile("flake.nix", "utf8");
  assert.equal(manifest.image.publicationStatus, "local-reproducible");
  assert.equal(manifest.image.publishedReference, null);
  assert.deepEqual(manifest.bases.map(item => item.role).sort(), ["nix-store", "runtime"]);
  assert.equal((dockerfile.match(/^FROM /gm) ?? []).length, 2);
  assert.doesNotMatch(dockerfile, /Lean 4|Emscripten|libuv|npm|PyPI|Cargo/);
  assert.match(entrypoint, /#universal-release-bundle/);
  assert.match(entrypoint, /#release-rehearsal/);
  assert.match(entrypoint, /#component-build-engine/);
  assert.match(entrypoint, /\/workspace\/component/);
  assert.match(entrypoint, /\/workspace\/request/);
  assert.doesNotMatch(entrypoint, /build-lean|emcc|lake build/);
  assert.match(flake, /component-build-engine = pkgs\.writeShellApplication[\s\S]*runtimeInputs = \[ pkgs\.coreutils pkgs\.nodejs_22 pkgs\.python3 \]/);
  const schema = JSON.parse(await readFile("schema/builder-manifest.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.image.additionalProperties, false);
  assert.equal(schema.properties.execution.additionalProperties, false);
});

test("Docker orchestration returns one validated bundle and package projection closure", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-build-docker-"));
  const output = join(scratch, "result");
  const ineligibleOutput = join(scratch, "ineligible");
  const calls = [];
  const progress = [];
  const runner = {
    capture: async request => {
      calls.push({ command: request.command, args: [...request.args] });
      if (request.command === "nix") throw unavailable("nix");
      if (request.args[0] === "info") return { code: 0, stdout: "24.0.9\n", stderr: "" };
      if (request.args[0] === "build") return { code: 0, stdout: "builder ready\n", stderr: "" };
      if (request.args[0] === "image") return {
        code: 0,
        stdout: "sha256:93c7df682303a033e37acf2099b7bbdae0fd9d76103b993115f271469cd46325\n",
        stderr: "",
      };
      if (request.args[0] === "run") {
        const mount = request.args.find(item => item.includes("target=/workspace/output"));
        const staging = mount.match(/source=(.*),target=\/workspace\/output/)[1];
        await buildUniversalReleaseBundle({
          projectRoot: process.cwd(),
          coreRoot: "build/lean-link-spike",
          outputRoot: join(staging, "bundle"),
          revision: "0".repeat(40),
          sourceDateEpoch: 1786261809,
          builder: "docker-test-double",
        });
        await rehearseRelease({ bundleRoot: join(staging, "bundle"), outputRoot: join(staging, "packages") });
        await writeFile(join(staging, "build-report.json"), canonicalJson({
          schemaVersion: 1,
          backend: "docker-nix",
          builder: "test-double",
          bundleStorePath: "/nix/store/test-bundle",
          packagesStorePath: "/nix/store/test-packages",
          bundlePath: "bundle",
          packagesPath: "packages",
          flakeOutputs: ["universal-release-bundle", "release-rehearsal"],
          sourceReadOnly: true,
          componentBinariesRebuiltByProjection: false,
        }));
        return { code: 0, stdout: "", stderr: "" };
      }
      throw new Error(`unexpected command: ${request.command} ${request.args.join(" ")}`);
    },
  };
  try {
    const result = await buildCanonicalProject({
      projectRoot: process.cwd(), outputRoot: output, runner, environment: {},
      targets: ["npm"],
      cache: { policy: "refresh", directory: null },
      onProgress: event => progress.push(event),
    });
    assert.equal(result.backend, "docker");
    assert.equal(result.bundle.component, "poc/lean-alpha@0.0.0");
    assert.equal(result.packages.ready, 1);
    assert.equal(result.packages.omitted, 4);
    assert.deepEqual(result.packages.selected.map(item => item.ecosystem), ["npm"]);
    assert.deepEqual(result.cache, { policy: "refresh", directory: null });
    assert.equal(result.sourceReadOnly, true);
    assert.equal(result.componentBinariesRebuiltByProjection, false);
    assert.ok(calls.some(call => call.args.includes("--pull")));
    assert.ok(calls.some(call => call.args.includes("--no-cache")));
    assert.deepEqual(progress.map(item => `${item.phase}:${item.state}`), [
      "backend:started", "backend:completed", "compile:started", "compile:completed", "validate:started", "validate:completed",
    ]);
    const run = calls.find(call => call.args[0] === "run");
    assert.ok(run.args.some(item => item.endsWith("target=/workspace/source,readonly")));
    assert.deepEqual(JSON.parse(await readFile(join(output, "build-report.json"), "utf8")).flakeOutputs, [
      "universal-release-bundle", "release-rehearsal",
    ]);
    await assert.rejects(
      buildCanonicalProject({
        projectRoot: process.cwd(), outputRoot: ineligibleOutput, runner, environment: {}, targets: ["pypi"],
      }),
      error => error instanceof CanonicalBuildError && error.code === "package-target-ineligible" && /native component library/.test(error.hint),
    );
    await assert.rejects(access(ineligibleOutput, constants.F_OK), error => error.code === "ENOENT");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("the process runner terminates a spawned build when cancellation is requested", async () => {
  const cancellation = new AbortController();
  const running = processBuildRunner.capture({
    command: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
    cwd: process.cwd(),
    signal: cancellation.signal,
  });
  setTimeout(() => cancellation.abort(new Error("cancelled by test")), 25);
  await assert.rejects(
    running,
    error => error instanceof CanonicalBuildError && error.code === "build-cancelled" && /cancelled by test/.test(error.message),
  );
});

test("native Nix accepts only a private store beside generated build staging", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-native-store-"));
  const output = join(scratch, "result");
  const privateStore = join(scratch, "private-nix-store");
  const calls = [];
  const runner = {
    capture: async request => {
      if (request.command === "docker") throw unavailable("docker");
      if (request.args[0] === "--version") return { code: 0, stdout: "nix (Nix) 2.8.0\n", stderr: "" };
      calls.push(request);
      const error = new Error("stop after observing isolated store arguments");
      error.code = "test-stop";
      throw error;
    },
  };
  try {
    await assert.rejects(
      buildCanonicalProject({
        projectRoot: process.cwd(),
        outputRoot: output,
        runner,
        environment: {
          LEAN_BRIDGE_BUILD_BACKEND: "nix",
          LEAN_BRIDGE_NIX_STORE: privateStore,
        },
      }),
      error => error.code === "test-stop",
    );
    assert.equal(calls.length, 1);
    assert.ok(calls[0].args.includes("--store"));
    assert.ok(calls[0].args.includes(`local?root=${privateStore}`));
    await assert.rejects(access(output, constants.F_OK), error => error.code === "ENOENT");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
