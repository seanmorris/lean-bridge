import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { cliHandlers, createCliHandlers } from "../src/cli/commands.mjs";
import {
  CliContractError,
  cliExitCodes,
  diagnostic,
  parseCliArguments,
  prompt,
  validateCliConfig,
  validateCliResult,
} from "../src/cli/contract.mjs";
import { renderProgressEvent, runCli } from "../src/cli/run.mjs";

const execute = promisify(execFile);
const publicationAttestation = Object.freeze({
  audit: Object.freeze({
    schemaVersion: 1,
    status: "verified",
    providerKind: "test-signer",
    signer: Object.freeze({ identity: "test-release-signer", keyId: "d".repeat(64), algorithm: "ed25519" }),
    policySha256: "e".repeat(64),
    statementSha256: "f".repeat(64),
    envelopeSha256: "0".repeat(64),
    privateMaterialReceived: false,
  }),
});
const authorizePublish = async () => publicationAttestation;

test("CLI parsing is noninteractive by default and keeps command options closed", () => {
  assert.deepEqual(parseCliArguments(["analyze"], { cwd: "/workspace", environment: {}, stderrIsTTY: false }), {
    kind: "command",
    command: "analyze",
    mode: "execute",
    project: "/workspace",
    output: null,
    bundle: null,
    authorization: null,
    manifest: null,
    format: "human",
    interactive: false,
    configuration: {
      path: null,
      sources: {
        project: "default",
        format: "default",
        targets: "default",
        cachePolicy: "default",
        cacheDirectory: "default",
        progress: "default",
      },
    },
    selection: { allTargets: true, targets: [] },
    cache: { policy: "use", directory: null },
    analysis: { check: false, policy: null },
    progress: "none",
  });
  assert.deepEqual(parseCliArguments([
    "publish", "--dry-run", "--output", "release", "--json", "--target", "npm", "--target", "cargo",
    "--cache", "refresh", "--cache-directory", "cache", "--progress", "json",
  ], { cwd: "/workspace", environment: {}, stderrIsTTY: false }), {
    kind: "command",
    command: "publish",
    mode: "dry-run",
    project: "/workspace",
    output: "/workspace/release",
    bundle: null,
    authorization: null,
    manifest: null,
    format: "json",
    interactive: false,
    configuration: {
      path: null,
      sources: {
        project: "default",
        format: "cli",
        targets: "cli",
        cachePolicy: "cli",
        cacheDirectory: "cli",
        progress: "cli",
      },
    },
    selection: { allTargets: false, targets: ["cargo", "npm"] },
    cache: { policy: "refresh", directory: "/workspace/cache" },
    analysis: { check: false, policy: null },
    progress: "json",
  });
  assert.throws(
    () => parseCliArguments(["analyze", "--dry-run"]),
    error => error instanceof CliContractError && error.code === "unknown-option",
  );
  assert.throws(
    () => parseCliArguments(["build", "--check"]),
    error => error instanceof CliContractError && error.code === "unknown-option",
  );
  assert.throws(
    () => parseCliArguments(["build", "--output", "one", "--output", "two"]),
    error => error.code === "duplicate-option",
  );
  assert.throws(
    () => parseCliArguments(["analyze", "--json", "--format", "human"]),
    error => error.code === "duplicate-option",
  );
});

test("analyze output and policy options resolve to one agent-safe request", async () => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-cli-policy-"));
  try {
    const policyPath = join(root, "policy.json");
    await writeFile(policyPath, JSON.stringify({
      schemaVersion: 1,
      maxWarnings: 0,
      requireCompiledExports: true,
    }));
    const request = parseCliArguments([
      "analyze", "--output", "analysis", "--policy", "policy.json", "--json",
    ], { cwd: root, environment: {}, stderrIsTTY: false });
    assert.equal(request.output, join(root, "analysis"));
    assert.equal(request.analysis.check, true);
    assert.equal(request.analysis.policy.source, "file");
    assert.equal(request.analysis.policy.path, policyPath);
    assert.match(request.analysis.policy.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(request.analysis.policy.document, {
      schemaVersion: 1,
      maxWarnings: 0,
      maxUndocumentedExports: null,
      minimumExports: 1,
      requireCompiledExports: true,
      allowStaticallyInferredIr: true,
      requireSemanticVersion: false,
    });

    const builtin = parseCliArguments(["analyze", "--check"], {
      cwd: root,
      environment: {},
      stderrIsTTY: false,
    });
    assert.equal(builtin.analysis.policy.source, "builtin");
    assert.equal(builtin.analysis.policy.path, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing and malformed analysis policies are structured usage failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-cli-policy-invalid-"));
  try {
    const absent = await runCli({
      argv: ["analyze", "--policy", "absent.json", "--json"],
      cwd: root,
      environment: {},
      handlers: cliHandlers,
    });
    assert.equal(absent.exitCode, cliExitCodes.usage);
    assert.equal(absent.response.diagnostics[0].code, "analysis-policy-not-found");

    await writeFile(join(root, "invalid.json"), "{");
    const invalidJson = await runCli({
      argv: ["analyze", "--policy", "invalid.json", "--json"],
      cwd: root,
      environment: {},
      handlers: cliHandlers,
    });
    assert.equal(invalidJson.exitCode, cliExitCodes.usage);
    assert.equal(invalidJson.response.diagnostics[0].code, "invalid-analysis-policy-json");

    await writeFile(join(root, "open.json"), JSON.stringify({ schemaVersion: 1, unknown: true }));
    const open = await runCli({
      argv: ["analyze", "--policy", "open.json", "--json"],
      cwd: root,
      environment: {},
      handlers: cliHandlers,
    });
    assert.equal(open.exitCode, cliExitCodes.usage);
    assert.equal(open.response.diagnostics[0].code, "invalid-analysis-policy");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI configuration precedence is explicit and machine-readable", async () => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-cli-config-"));
  try {
    const configPath = join(root, "settings.json");
    await writeFile(configPath, JSON.stringify({
      schemaVersion: 1,
      project: "configured-project",
      targets: ["npm"],
      cache: { policy: "use", directory: "configured-cache" },
      format: "human",
      progress: "none",
    }));
    const fromEnvironment = parseCliArguments(["build", "--config", configPath], {
      cwd: root,
      environment: {
        LEAN_BRIDGE_PROJECT: "environment-project",
        LEAN_BRIDGE_TARGETS: "pypi,cargo",
        LEAN_BRIDGE_CACHE: "refresh",
        LEAN_BRIDGE_CACHE_DIRECTORY: "environment-cache",
        LEAN_BRIDGE_FORMAT: "json",
        LEAN_BRIDGE_PROGRESS: "json",
      },
      stderrIsTTY: false,
    });
    assert.equal(fromEnvironment.project, join(root, "environment-project"));
    assert.deepEqual(fromEnvironment.selection, { allTargets: false, targets: ["cargo", "pypi"] });
    assert.deepEqual(fromEnvironment.cache, { policy: "refresh", directory: join(root, "environment-cache") });
    assert.equal(fromEnvironment.format, "json");
    assert.equal(fromEnvironment.progress, "json");
    assert.deepEqual(fromEnvironment.configuration.sources, {
      project: "environment",
      format: "environment",
      targets: "environment",
      cachePolicy: "environment",
      cacheDirectory: "environment",
      progress: "environment",
    });

    const fromCli = parseCliArguments([
      "build", "--config", configPath, "--project", "cli-project", "--target", "npm", "--no-cache",
      "--format", "human", "--progress", "plain",
    ], {
      cwd: root,
      environment: { LEAN_BRIDGE_CACHE_DIRECTORY: "ignored-lower-priority-cache" },
      stderrIsTTY: false,
    });
    assert.equal(fromCli.project, join(root, "cli-project"));
    assert.deepEqual(fromCli.selection, { allTargets: false, targets: ["npm"] });
    assert.deepEqual(fromCli.cache, { policy: "off", directory: null });
    assert.equal(fromCli.progress, "plain");
    assert.equal(fromCli.configuration.sources.cachePolicy, "cli");
    assert.equal(fromCli.configuration.sources.cacheDirectory, "cli");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI configuration stays closed and cannot enable implicit prompting", () => {
  assert.equal(validateCliConfig({ schemaVersion: 1 }), true);
  assert.throws(
    () => validateCliConfig({ schemaVersion: 1, interactive: true }),
    error => error.code === "invalid-cli-config",
  );
  assert.throws(
    () => validateCliConfig({ schemaVersion: 1, cache: { policy: "off", directory: "cache" } }),
    error => error.code === "invalid-cli-config",
  );
  assert.throws(
    () => validateCliConfig({ schemaVersion: 1, targets: ["npm", "npm"] }),
    error => error.code === "invalid-cli-config",
  );
  assert.throws(
    () => parseCliArguments(["build", "--cache", "off", "--cache-directory", "cache"], { environment: {} }),
    error => error.code === "contradictory-cache-options",
  );
});

test("agent output is one closed result envelope with stable exit semantics", async () => {
  const outcome = await runCli({
    argv: ["analyze", "--json", "--interactive"],
    cwd: "/workspace",
    environment: {},
    stderrIsTTY: false,
    handlers: {
      analyze: async request => ({
        status: "needs-input",
        result: { discoveredDeclarations: 4 },
        diagnostics: [diagnostic({
          code: "ownership-hint-required",
          severity: "warning",
          message: "One foreign object needs an ownership decision",
          path: "Main.lean:12",
          hint: "Choose borrow or lease in interactive mode.",
        })],
        prompts: [prompt({
          id: "ownership-hint-required",
          message: "Choose how the foreign object crosses the boundary.",
          choices: ["borrow", "lease"],
        })],
        nextActions: ["Resolve the ownership hint."],
      }),
    },
  });
  assert.equal(outcome.exitCode, 2);
  assert.equal(outcome.stderr, "");
  assert.equal(outcome.response.interactive, true);
  assert.equal(outcome.response.schemaVersion, 2);
  assert.equal(outcome.response.exitCode, cliExitCodes.needsInput);
  assert.equal(outcome.response.prompts[0].choices[0], "borrow");
  assert.deepEqual(outcome.response.progress.events.map(event => event.state), ["started", "blocked"]);
  assert.equal(validateCliResult(JSON.parse(outcome.stdout)), true);

  const drifted = { ...outcome.response, extra: true };
  assert.throws(
    () => validateCliResult(drifted),
    error => error.code === "invalid-cli-result" && /fields must be closed/.test(error.message),
  );
});

test("invalid JSON invocations return a structured usage result", async () => {
  const outcome = await runCli({
    argv: ["build", "--unknown", "--json"],
    cwd: "/workspace",
    environment: {},
    handlers: {},
  });
  assert.equal(outcome.exitCode, cliExitCodes.usage);
  assert.equal(outcome.stderr, "");
  const result = JSON.parse(outcome.stdout);
  assert.equal(result.command, null);
  assert.equal(result.diagnostics[0].code, "unknown-option");
  assert.equal(validateCliResult(result), true);
});

test("progress is ordered, retained in the result, and streamable without prose scraping", async () => {
  const streamed = [];
  const outcome = await runCli({
    argv: ["build", "--json", "--progress", "json", "--target", "npm", "--cache", "refresh"],
    cwd: "/workspace",
    environment: {},
    handlers: {
      build: async (_request, { emitProgress }) => {
        emitProgress({ phase: "resolve", state: "started", message: "Resolving the canonical graph", current: 0, total: 1 });
        emitProgress({ phase: "resolve", state: "completed", message: "Canonical graph resolved", current: 1, total: 1 });
        return { status: "ok", result: { built: true }, diagnostics: [], prompts: [], nextActions: [] };
      },
    },
    onProgress: (event, mode) => streamed.push(renderProgressEvent(event, mode)),
  });
  assert.equal(outcome.exitCode, 0);
  assert.deepEqual(outcome.response.progress.events.map(event => event.sequence), [1, 2, 3, 4]);
  assert.deepEqual(outcome.response.progress.events.map(event => event.state), ["started", "started", "completed", "completed"]);
  assert.equal(streamed.length, 4);
  assert.equal(JSON.parse(streamed[1]).phase, "resolve");
  assert.deepEqual(outcome.response.selection, { allTargets: false, targets: ["npm"] });
  assert.deepEqual(outcome.response.cache, { policy: "refresh", directory: null });
});

test("cancellation has a stable status, diagnostic, progress state, and exit code", async () => {
  const cancellation = new AbortController();
  cancellation.abort(new Error("Stopped by test"));
  let called = false;
  const outcome = await runCli({
    argv: ["analyze", "--json"],
    cwd: "/workspace",
    environment: {},
    signal: cancellation.signal,
    handlers: { analyze: async () => { called = true; } },
  });
  assert.equal(called, false);
  assert.equal(outcome.exitCode, cliExitCodes.cancelled);
  assert.equal(outcome.response.status, "cancelled");
  assert.equal(outcome.response.diagnostics[0].code, "cli-cancelled");
  assert.deepEqual(outcome.response.progress.events.map(event => event.state), ["started", "cancelled"]);
});

test("the executable analyzes the project and reports pending commands honestly", async () => {
  const analyzed = await execute("node", ["scripts/lean-bridge.mjs", "analyze", "--json"], { cwd: process.cwd() });
  const response = JSON.parse(analyzed.stdout);
  assert.equal(response.status, "ok");
  assert.equal(response.result.bindingIr.origin, "existing-validated");
  const withProgress = await execute("node", [
    "scripts/lean-bridge.mjs", "analyze", "--json", "--progress", "json", "--target", "npm",
  ], { cwd: process.cwd() });
  const progressResponse = JSON.parse(withProgress.stdout);
  const events = withProgress.stderr.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(events.length, progressResponse.progress.events.length);
  assert.deepEqual(events, progressResponse.progress.events);
  assert.deepEqual(progressResponse.selection.targets, ["npm"]);
  await assert.rejects(
    execute("node", ["scripts/lean-bridge.mjs", "publish"], { cwd: process.cwd() }),
    error => error.code === 2 && /publish-manifest-required/.test(error.stderr),
  );
});

test("publish dry-run executes the full reproducibility gate through the CLI contract", async () => {
  const calls = [];
  const credentialCalls = [];
  const handlers = createCliHandlers({
    gate: async request => {
      calls.push(request);
      return {
        result: "passed",
        candidate: { id: "a".repeat(64) },
        report: "/workspace/gate/evidence/reproducibility.json",
        authorization: "/workspace/gate/release-authorization.json",
        externalRegistryWrites: false,
      };
    },
    createPublishPlan: async request => {
      calls.push({ createPublishPlan: request });
      return {
        path: "/workspace/gate/publish-manifest.json",
        manifestSha256: "b".repeat(64),
        manifest: {
          targets: [{
            order: 1,
            ecosystem: "npm",
            coordinate: "@lean-bridge/alpha@0.0.0",
            operation: "publish",
            idempotencyKey: "c".repeat(64),
          }],
        },
      };
    },
    credentialProvider: {
      kind: "must-not-run",
      has(name) {
        credentialCalls.push(["has", name]);
        throw new Error("dry run reached credentials");
      },
      read(name) {
        credentialCalls.push(["read", name]);
        throw new Error("dry run reached credentials");
      },
    },
  });
  const outcome = await runCli({
    argv: ["publish", "--dry-run", "--output", "gate", "--json"],
    cwd: "/workspace",
    environment: {},
    handlers,
  });
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.response.status, "ok");
  assert.equal(outcome.response.result.externalRegistryWrites, false);
  assert.equal(outcome.response.result.candidate.id, "a".repeat(64));
  assert.equal(outcome.response.result.publishManifest, "/workspace/gate/publish-manifest.json");
  assert.equal(outcome.response.result.publishManifestSha256, "b".repeat(64));
  assert.equal(calls.length, 2);
  assert.equal(calls[0].projectRoot, "/workspace");
  assert.equal(calls[0].outputRoot, "/workspace/gate");
  assert.deepEqual(calls[0].targets, []);
  assert.deepEqual(calls[0].cache, { policy: "use", directory: null });
  assert.equal(calls[1].createPublishPlan.gateRoot, "/workspace/gate");
  assert.deepEqual(calls[1].createPublishPlan.requestedTargets, []);
  assert.deepEqual(credentialCalls, []);

  const oldShape = await runCli({
    argv: ["publish", "--dry-run", "--bundle", "bundle", "--output", "gate", "--json"],
    cwd: "/workspace",
    environment: {},
    handlers,
  });
  assert.equal(oldShape.response.status, "blocked");
  assert.equal(oldShape.response.diagnostics[0].code, "dry-run-input-required");
});

test("external publish verifies one manifest before reaching the deferred registry step", async () => {
  const calls = [];
  const handlers = createCliHandlers({
    verifyPublishPlan: async request => {
      calls.push(request);
      return {
        manifestPath: "/workspace/gate/publish-manifest.json",
        manifestSha256: "a".repeat(64),
        candidateRoot: "/workspace/gate/release",
        authorization: { status: "authorized", candidate: { id: "b".repeat(64) } },
        manifest: {
          targets: [{ order: 1, ecosystem: "npm", coordinate: "@lean-bridge/alpha@0.0.0", idempotencyKey: "c".repeat(64) }],
        },
      };
    },
  });
  const outcome = await runCli({
    argv: ["publish", "--manifest", "gate/publish-manifest.json", "--json"],
    cwd: "/workspace",
    environment: {},
    handlers,
  });
  assert.equal(outcome.response.status, "blocked");
  assert.equal(outcome.response.diagnostics[0].code, "registry-publisher-unavailable");
  assert.equal(outcome.response.result.authorization.status, "authorized");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].manifestPath, "/workspace/gate/publish-manifest.json");
  assert.deepEqual(calls[0].requestedTargets, []);
});

test("publish hands the verified immutable plan to an installed registry backend", async () => {
  const calls = [];
  const verified = {
    manifestPath: "/workspace/gate/publish-manifest.json",
    manifestSha256: "a".repeat(64),
    candidateRoot: "/workspace/gate/release",
    authorization: { status: "authorized", candidate: { id: "b".repeat(64) } },
    manifest: {
      targets: [{
        order: 1,
        ecosystem: "npm",
        coordinate: "@lean-bridge/alpha@0.0.0",
        operation: "publish",
        idempotencyKey: "c".repeat(64),
        credentialEnvironment: ["NPM_TOKEN"],
      }],
    },
  };
  const handlers = createCliHandlers({
    verifyPublishPlan: async request => {
      calls.push(["verify", request]);
      return verified;
    },
    credentialProvider: {
      kind: "test-provider",
      has(name) {
        calls.push(["has", name]);
        return true;
      },
      read(name) {
        calls.push(["read", name]);
        return "registry-secret";
      },
    },
    authorizePublish: async request => {
      calls.push(["attest", request]);
      return publicationAttestation;
    },
    publisher: async request => {
      calls.push(["publish", request]);
      const preflight = await request.credentials.withTarget(request.plan.targets[0], credentials => {
        assert.deepEqual(credentials.names, ["NPM_TOKEN"]);
        assert.equal(credentials.get("NPM_TOKEN"), "registry-secret");
        return { status: "authenticated" };
      });
      assert.deepEqual(preflight, { status: "authenticated" });
      return {
        candidateId: "b".repeat(64),
        results: [{ ecosystem: "npm", status: "already-published", idempotencyKey: "c".repeat(64) }],
        externalRegistryWrites: false,
      };
    },
  });
  const outcome = await runCli({
    argv: ["publish", "--manifest", "gate/publish-manifest.json", "--json"],
    cwd: "/workspace",
    environment: {},
    handlers,
  });
  assert.equal(outcome.response.status, "ok");
  assert.equal(outcome.response.result.results[0].status, "already-published");
  assert.equal(outcome.response.result.credentialAudit.status, "complete");
  assert.equal(outcome.response.result.credentialAudit.valuesRead, true);
  assert.equal(outcome.response.result.credentialAudit.valuesRetained, false);
  assert.equal(outcome.response.result.attestationAudit.status, "verified");
  assert.equal(outcome.response.result.attestationAudit.privateMaterialReceived, false);
  assert.equal(JSON.stringify(outcome.response).includes("registry-secret"), false);
  assert.deepEqual(calls.map(item => item[0]), ["verify", "has", "attest", "publish", "read"]);
  assert.equal(calls[3][1].plan, verified.manifest);
  assert.equal(calls[3][1].manifestSha256, "a".repeat(64));
  assert.equal(calls[3][1].attestation, publicationAttestation);
});

test("publish blocks missing credentials before invoking a registry backend", async () => {
  let publisherCalled = false;
  const handlers = createCliHandlers({
    verifyPublishPlan: async () => ({
      manifestPath: "/workspace/gate/publish-manifest.json",
      manifestSha256: "a".repeat(64),
      candidateRoot: "/workspace/gate/release",
      authorization: { status: "authorized", candidate: { id: "b".repeat(64) } },
      manifest: {
        targets: [{
          order: 1,
          ecosystem: "npm",
          coordinate: "@lean-bridge/alpha@0.0.0",
          operation: "publish",
          idempotencyKey: "c".repeat(64),
          credentialEnvironment: ["NPM_TOKEN"],
        }],
      },
    }),
    credentialProvider: {
      kind: "empty-provider",
      has: () => false,
      read: () => {
        throw new Error("credential read must not run");
      },
    },
    publisher: async () => {
      publisherCalled = true;
      return {};
    },
  });
  const outcome = await runCli({
    argv: ["publish", "--manifest", "gate/publish-manifest.json", "--json"],
    cwd: "/workspace",
    environment: {},
    handlers,
  });
  assert.equal(outcome.response.status, "blocked");
  assert.equal(outcome.response.diagnostics[0].code, "publish-credentials-missing");
  assert.equal(outcome.response.result.credentialAudit.status, "blocked");
  assert.equal(outcome.response.result.credentialAudit.valuesRead, false);
  assert.equal(outcome.response.result.externalRegistryWrites, false);
  assert.equal(publisherCalled, false);
});

test("publish rejects a credential value returned by a registry backend", async () => {
  const handlers = createCliHandlers({
    verifyPublishPlan: async () => ({
      manifestPath: "/workspace/gate/publish-manifest.json",
      manifestSha256: "a".repeat(64),
      candidateRoot: "/workspace/gate/release",
      authorization: { status: "authorized", candidate: { id: "b".repeat(64) } },
      manifest: {
        targets: [{
          order: 1,
          ecosystem: "npm",
          coordinate: "@lean-bridge/alpha@0.0.0",
          operation: "publish",
          idempotencyKey: "c".repeat(64),
          credentialEnvironment: ["NPM_TOKEN"],
        }],
      },
    }),
    credentialProvider: {
      kind: "test-provider",
      has: () => true,
      read: () => "registry-secret",
    },
    authorizePublish,
    publisher: request => request.credentials.withTarget(request.plan.targets[0], credentials => ({
      externalRegistryWrites: false,
      accidentalLeak: credentials.get("NPM_TOKEN"),
    })),
  });
  const outcome = await runCli({
    argv: ["publish", "--manifest", "gate/publish-manifest.json", "--json"],
    cwd: "/workspace",
    environment: {},
    handlers,
  });
  assert.equal(outcome.response.status, "failed");
  assert.equal(outcome.response.diagnostics[0].code, "credential-value-leak");
  assert.equal(outcome.response.result.credentialAudit.status, "failed");
  assert.equal(outcome.response.result.externalRegistryWrites, "unknown");
  assert.equal(JSON.stringify(outcome.response).includes("registry-secret"), false);
});

test("publish rejects a credential value before it reaches progress output", async () => {
  const handlers = createCliHandlers({
    verifyPublishPlan: async () => ({
      manifestPath: "/workspace/gate/publish-manifest.json",
      manifestSha256: "a".repeat(64),
      candidateRoot: "/workspace/gate/release",
      authorization: { status: "authorized", candidate: { id: "b".repeat(64) } },
      manifest: {
        targets: [{
          order: 1,
          ecosystem: "npm",
          coordinate: "@lean-bridge/alpha@0.0.0",
          operation: "publish",
          idempotencyKey: "c".repeat(64),
          credentialEnvironment: ["NPM_TOKEN"],
        }],
      },
    }),
    credentialProvider: {
      kind: "test-provider",
      has: () => true,
      read: () => "registry-secret",
    },
    authorizePublish,
    publisher: request => request.credentials.withTarget(request.plan.targets[0], credentials => {
      request.onProgress({
        phase: "registry",
        state: "info",
        message: `using ${credentials.get("NPM_TOKEN")}`,
      });
      return { externalRegistryWrites: false };
    }),
  });
  const outcome = await runCli({
    argv: ["publish", "--manifest", "gate/publish-manifest.json", "--json", "--progress", "json"],
    cwd: "/workspace",
    environment: {},
    handlers,
  });
  assert.equal(outcome.response.status, "failed");
  assert.equal(outcome.response.diagnostics[0].code, "credential-value-leak");
  assert.equal(outcome.response.result.externalRegistryWrites, "unknown");
  assert.equal(JSON.stringify(outcome.response.progress.events).includes("registry-secret"), false);
  assert.equal(outcome.stderr.includes("registry-secret"), false);
});

test("publish requires signer policy after name-only credential preflight and before registry access", async () => {
  const calls = [];
  const handlers = createCliHandlers({
    verifyPublishPlan: async () => ({
      manifestPath: "/workspace/gate/publish-manifest.json",
      manifestSha256: "a".repeat(64),
      candidateRoot: "/workspace/gate/release",
      authorization: { status: "authorized", candidate: { id: "b".repeat(64) } },
      manifest: {
        targets: [{
          order: 1,
          ecosystem: "npm",
          coordinate: "@lean-bridge/alpha@0.0.0",
          operation: "publish",
          idempotencyKey: "c".repeat(64),
          credentialEnvironment: ["NPM_TOKEN"],
        }],
      },
    }),
    credentialProvider: {
      kind: "test-provider",
      has(name) {
        calls.push(["has", name]);
        return true;
      },
      read(name) {
        calls.push(["read", name]);
        return "must-not-be-read";
      },
    },
    publisher: async () => {
      calls.push(["publish"]);
      return {};
    },
  });
  const outcome = await runCli({
    argv: ["publish", "--manifest", "gate/publish-manifest.json", "--json"],
    cwd: "/workspace",
    environment: {},
    handlers,
  });
  assert.equal(outcome.response.status, "blocked");
  assert.equal(outcome.response.diagnostics[0].code, "publication-signer-policy-required");
  assert.equal(outcome.response.result.credentialAudit.valuesRead, false);
  assert.equal(outcome.response.result.attestationAudit, null);
  assert.equal(outcome.response.result.externalRegistryWrites, false);
  assert.deepEqual(calls, [["has", "NPM_TOKEN"]]);
});

test("the published CLI result schema is closed", async () => {
  const schema = JSON.parse(await readFile("schema/cli-result.schema.json", "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schemaVersion.const, 2);
  assert.equal(schema.$defs.diagnostic.additionalProperties, false);
  assert.equal(schema.$defs.prompt.additionalProperties, false);
  assert.equal(schema.$defs.progressEvent.additionalProperties, false);

  const configSchema = JSON.parse(await readFile("schema/cli-config.schema.json", "utf8"));
  assert.equal(configSchema.additionalProperties, false);
  assert.equal(configSchema.properties.schemaVersion.const, 1);
});
