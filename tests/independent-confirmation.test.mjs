/**
 * Tests the independent confirmation behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	createIndependentConfirmation,
	writeIndependentConfirmation,
} from "../src/release/independent-confirmation.mjs";

const candidate = Object.freeze({
	id: "1".repeat(64)
	, sourceRevision: "2".repeat(40)
	, sourceTree: "3".repeat(40)
	, artifactInventorySha256: "4".repeat(64)
});

test("an independent rebuild produces one content-addressed confirmation record", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-confirmation-"));
  const output = join(scratch, "record");
  try
{
    const confirmation = createIndependentConfirmation({
      published: { candidate, authorizationSha256: "5".repeat(64) }
      , rebuilt: {
        candidate
        , authorizationSha256: "6".repeat(64)
        , reportSha256: "7".repeat(64)
      }
      , verifierIdentity: "example-auditor"
      , reportUrl: "https://example.invalid/reports/1"
      , environment: { builderDefinitionSha256: "8".repeat(64), backend: "docker" }
      , confirmedAt: "2026-08-09T00:00:00.000Z"
    });
    const written = await writeIndependentConfirmation({ outputRoot: output, confirmation });
    assert.match(written.confirmationSha256, /^[0-9a-f]{64}$/);
    const record = JSON.parse(await readFile(written.confirmation, "utf8"));
    assert.equal(record.status, "confirmed");
    assert.equal(record.candidate.id, candidate.id);
    assert.equal(record.verifier.identity, "example-auditor");
    await assert.rejects(
      writeIndependentConfirmation({ outputRoot: output, confirmation }),
      error => error.code === "confirmation-output-exists",
    );
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("a different independent candidate cannot become a confirmation", async () => {
  assert.throws(
    () => createIndependentConfirmation({
      published: { candidate, authorizationSha256: "5".repeat(64) }
      , rebuilt: {
        candidate: { ...candidate, id: "9".repeat(64) }
        , authorizationSha256: "6".repeat(64)
        , reportSha256: "7".repeat(64)
      }
      , environment: {}
    }),
    error => error.code === "independent-candidate-drift",
  );
  const schema = JSON.parse(await readFile("schema/independent-confirmation.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.verifier.additionalProperties, false);
});
