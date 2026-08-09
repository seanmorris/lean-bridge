import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildCanonicalProject,
  CanonicalBuildError,
  detectBuildBackend,
  readBuilderManifest,
} from "../src/build/canonical-build.mjs";
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

test("the reviewed Debian builder contains Nix, not a second compiler policy", async () => {
  const { manifest } = await readBuilderManifest(process.cwd());
  const dockerfile = await readFile("containers/builder/Dockerfile", "utf8");
  const entrypoint = await readFile("containers/builder/entrypoint.sh", "utf8");
  assert.equal(manifest.image.publicationStatus, "local-reproducible");
  assert.equal(manifest.image.publishedReference, null);
  assert.deepEqual(manifest.bases.map(item => item.role).sort(), ["nix-store", "runtime"]);
  assert.equal((dockerfile.match(/^FROM /gm) ?? []).length, 2);
  assert.doesNotMatch(dockerfile, /Lean 4|Emscripten|libuv|npm|PyPI|Cargo/);
  assert.match(entrypoint, /#universal-release-bundle/);
  assert.match(entrypoint, /#release-rehearsal/);
  assert.doesNotMatch(entrypoint, /build-lean|emcc|lake build/);
  const schema = JSON.parse(await readFile("schema/builder-manifest.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.image.additionalProperties, false);
  assert.equal(schema.properties.execution.additionalProperties, false);
});

test("Docker orchestration returns one validated bundle and package projection closure", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-build-docker-"));
  const output = join(scratch, "result");
  const calls = [];
  const runner = {
    capture: async request => {
      calls.push({ command: request.command, args: [...request.args] });
      if (request.command === "nix") throw unavailable("nix");
      if (request.args[0] === "info") return { code: 0, stdout: "24.0.9\n", stderr: "" };
      if (request.args[0] === "build") return { code: 0, stdout: "builder ready\n", stderr: "" };
      if (request.args[0] === "image") return {
        code: 0,
        stdout: "sha256:c4202ef2601394eeffe06d8a988e617d9cc990f28334ee51b4feb277c262a927\n",
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
    });
    assert.equal(result.backend, "docker");
    assert.equal(result.bundle.component, "poc/lean-alpha@0.0.0");
    assert.equal(result.packages.ready, 1);
    assert.equal(result.packages.omitted, 4);
    assert.equal(result.sourceReadOnly, true);
    assert.equal(result.componentBinariesRebuiltByProjection, false);
    assert.ok(calls.some(call => call.args.includes("--pull")));
    const run = calls.find(call => call.args[0] === "run");
    assert.ok(run.args.some(item => item.endsWith("target=/workspace/source,readonly")));
    assert.deepEqual(JSON.parse(await readFile(join(output, "build-report.json"), "utf8")).flakeOutputs, [
      "universal-release-bundle", "release-rehearsal",
    ]);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
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
