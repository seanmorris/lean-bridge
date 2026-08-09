import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { cliHandlers } from "../src/cli/commands.mjs";
import {
  CliContractError,
  diagnostic,
  parseCliArguments,
  validateCliResult,
} from "../src/cli/contract.mjs";
import { runCli } from "../src/cli/run.mjs";
import { buildUniversalReleaseBundle } from "../src/release/universal-release-bundle.mjs";

const execute = promisify(execFile);
const revision = "40a377af093f20b80ca883f18ae61727325fa86c";

test("CLI parsing is noninteractive by default and keeps command options closed", () => {
  assert.deepEqual(parseCliArguments(["analyze"], { cwd: "/workspace" }), {
    kind: "command",
    command: "analyze",
    mode: "execute",
    project: "/workspace",
    output: null,
    bundle: null,
    format: "human",
    interactive: false,
  });
  assert.deepEqual(parseCliArguments([
    "publish", "--dry-run", "--bundle", "bundle", "--output", "release", "--json",
  ], { cwd: "/workspace" }), {
    kind: "command",
    command: "publish",
    mode: "dry-run",
    project: "/workspace",
    output: "/workspace/release",
    bundle: "/workspace/bundle",
    format: "json",
    interactive: false,
  });
  assert.throws(
    () => parseCliArguments(["analyze", "--dry-run"]),
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

test("agent output is one closed result envelope with stable exit semantics", async () => {
  const outcome = await runCli({
    argv: ["analyze", "--json", "--interactive"],
    cwd: "/workspace",
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
        nextActions: ["Resolve the ownership hint."],
      }),
    },
  });
  assert.equal(outcome.exitCode, 2);
  assert.equal(outcome.stderr, "");
  assert.equal(outcome.response.interactive, true);
  assert.equal(validateCliResult(JSON.parse(outcome.stdout)), true);

  const drifted = { ...outcome.response, extra: true };
  assert.throws(
    () => validateCliResult(drifted),
    error => error.code === "invalid-cli-result" && /fields must be closed/.test(error.message),
  );
});

test("the executable analyzes the project and reports pending commands honestly", async () => {
  const analyzed = await execute("node", ["scripts/lean-bridge.mjs", "analyze", "--json"], { cwd: process.cwd() });
  const response = JSON.parse(analyzed.stdout);
  assert.equal(response.status, "ok");
  assert.equal(response.result.bindingIr.origin, "existing-validated");
  await assert.rejects(
    execute("node", ["scripts/lean-bridge.mjs", "publish"], { cwd: process.cwd() }),
    error => error.code === 2 && /publish-implementation-pending/.test(error.stderr),
  );
});

test("publish dry-run executes the existing no-publish rehearsal through the CLI contract", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-cli-contract-"));
  try {
    const bundle = join(scratch, "bundle");
    await buildUniversalReleaseBundle({
      projectRoot: process.cwd(),
      coreRoot: "build/lean-link-spike",
      outputRoot: bundle,
      revision,
      sourceDateEpoch: 1786261809,
    });
    const output = join(scratch, "release");
    const outcome = await runCli({
      argv: ["publish", "--dry-run", "--bundle", bundle, "--output", output, "--json"],
      handlers: cliHandlers,
    });
    assert.equal(outcome.exitCode, 0);
    assert.equal(outcome.response.status, "ok");
    assert.equal(outcome.response.result.externalRegistryWrites, false);
    assert.equal(outcome.response.result.readyPackages, 1);
    assert.equal(outcome.response.result.omittedPackages, 4);
    assert.equal(JSON.parse(await readFile(join(output, "publication-index.json"), "utf8")).mode, "no-publish");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("the published CLI result schema is closed", async () => {
  const schema = JSON.parse(await readFile("schema/cli-result.schema.json", "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.diagnostics.items.additionalProperties, false);
});
