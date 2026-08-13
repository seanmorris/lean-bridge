import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
	preparePublishedRelease,
	validateArchiveEntries,
	verifyIndependentRelease,
} from "../src/release/independent-verifier.mjs";

const execute = promisify(execFile);

const candidate = Object.freeze({
	id: "1".repeat(64)
	, sourceRevision: "2".repeat(40)
	, sourceTree: "3".repeat(40)
	, artifactInventorySha256: "4".repeat(64)
});

test("archive validation rejects traversal and link entries before extraction", () => {
  assert.deepEqual(validateArchiveEntries("gate/\ngate/release-authorization.json\n", "drwxr-xr-x gate/\n-rw-r--r-- gate/release-authorization.json\n"), [
    "gate/", "gate/release-authorization.json"
  ]);
  assert.throws(() => validateArchiveEntries("../escape\n", "-rw-r--r-- ../escape\n"), error => error.code === "unsafe-release-archive");
  assert.throws(() => validateArchiveEntries("gate/link\n", "lrwxrwxrwx gate/link -> /tmp\n"), error => error.code === "unsafe-release-archive-entry");
});

test("a local tar archive resolves to exactly one authorization root", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-published-archive-"));
  try
{
    const source = join(scratch, "source", "reproducibility-gate");
    const extraction = join(scratch, "extraction");
    const archive = join(scratch, "gate.tar");
    await mkdir(source, { recursive: true });
    await mkdir(extraction);
    await writeFile(join(source, "release-authorization.json"), "{}\n");
    await execute("tar", ["-cf", archive, "-C", join(scratch, "source"), "reproducibility-gate"]);
    const root = await preparePublishedRelease({ published: archive, scratchRoot: extraction });
    assert.equal(root, join(extraction, "published-release", "reproducibility-gate"));
    assert.equal(await readFile(join(root, "release-authorization.json"), "utf8"), "{}\n");
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("published archives enforce size and HTTPS after redirects", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-published-limits-"));
  try
{
    const oversized = join(scratch, "oversized.tar");
    await writeFile(oversized, "");
    await truncate(oversized, 1024 * 1024 * 1024 + 1);
    await assert.rejects(
      preparePublishedRelease({ published: oversized, scratchRoot: scratch }),
      error => error.code === "release-archive-too-large",
    );
    await assert.rejects(
      preparePublishedRelease({
        published: "https://example.invalid/release.tar"
        , scratchRoot: scratch
        , fetchImpl: async () => ({
          ok: true
          , status: 200
          , url: "http://example.invalid/release.tar"
          , body: {}
          , headers: new Headers()
        })
      }),
      error => error.code === "unsupported-release-redirect",
    );
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("one independent command rebuilds the declared revision and writes a confirmation", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-independent-command-"));
  const output = join(scratch, "confirmation");
  const calls = [];
  try
{
    const result = await verifyIndependentRelease({
      repository: "https://example.invalid/lean-bridge.git"
      , published: "/published"
      , outputRoot: output
      , verifierIdentity: "agent-7"
      , reportUrl: "https://example.invalid/report.json"
      , preparePublished: async request => {
        calls.push(["published", request.published]);
        return "/published";
      }
      , checkoutSource: async request => {
        calls.push(["checkout", request.repository, request.revision]);
        return "/clean/source";
      }
      , gate: async request => {
        calls.push(["gate", request.projectRoot]);
        await mkdir(join(request.outputRoot, "evidence"), { recursive: true });
        const report = join(request.outputRoot, "evidence", "reproducibility.json");
        await writeFile(report, `${JSON.stringify({
          source: { revision: candidate.sourceRevision }
          , builds: [{
            backend: "docker"
            , backendVersion: "24.0.9"
            , builderDefinitionSha256: "5".repeat(64)
            , platform: "linux/x64"
            , runtimeProfile: "browser"
          }]
        })}\n`);
        return { candidate, report, reportSha256: "6".repeat(64) };
      }
      , verifyAuthorization: async request => {
        const rebuilt = request.authorizationRoot.includes("rebuilt-gate");
        return {
          status: "authorized"
          , candidate
          , authorizationSha256: (rebuilt ? "8" : "7").repeat(64)
        };
      }
      , now: () => "2026-08-09T00:00:00.000Z"
    });
    assert.equal(result.status, "confirmed");
    assert.equal(result.candidate.id, candidate.id);
    assert.deepEqual(calls, [
      ["published", "/published"]
      , ["checkout", "https://example.invalid/lean-bridge.git", candidate.sourceRevision]
      , ["gate", "/clean/source"]
    ]);
    const confirmation = JSON.parse(await readFile(result.confirmation, "utf8"));
    assert.equal(confirmation.verifier.identity, "agent-7");
    assert.equal(confirmation.evidence.publishedAuthorizationSha256, "7".repeat(64));
    assert.equal(confirmation.evidence.rebuiltAuthorizationSha256, "8".repeat(64));
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});
