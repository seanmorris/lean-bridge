/**
 * Tests the release candidate state behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ReleaseCandidateState } from "../src/release/release-candidate-state.mjs";

test("one candidate advances through the required release states in order", () => {
  const state = new ReleaseCandidateState({ sourceIdentitySha256: "1".repeat(64) });
  for(const [index, name] of ["analyze", "generate", "build-a", "build-b"].entries())
{
    state.transition({ state: name, evidenceSha256: String(index + 2).repeat(64) });
}
  const candidateId = "6".repeat(64);
  state.transition({ state: "compare", evidenceSha256: "7".repeat(64), candidateId });
  for(const [evidence, name] of [["8", "report"], ["9", "authorize"], ["a", "publish"]])
{
    state.transition({ state: name, evidenceSha256: evidence.repeat(64), candidateId });
}
  const snapshot = state.snapshot();
  assert.equal(snapshot.current, "publish");
  assert.equal(snapshot.candidateId, candidateId);
  assert.deepEqual(snapshot.history.map(item => item.state), [
    "created"
    , "analyze"
    , "generate"
    , "build-a"
    , "build-b"
    , "compare"
    , "report"
    , "authorize"
    , "publish"
  ]);
});

test("skipped, stale, and cross-candidate transitions fail closed", () => {
  const state = new ReleaseCandidateState({ sourceIdentitySha256: "1".repeat(64) });
  assert.throws(
    () => state.transition({ state: "build-a", evidenceSha256: "2".repeat(64) }),
    error => error.code === "invalid-release-transition",
  );
  state.transition({ state: "analyze", evidenceSha256: "2".repeat(64) });
  assert.throws(
    () => state.transition({ state: "analyze", evidenceSha256: "3".repeat(64) }),
    error => error.code === "invalid-release-transition",
  );
  state.transition({ state: "generate", evidenceSha256: "3".repeat(64) });
  state.transition({ state: "build-a", evidenceSha256: "4".repeat(64) });
  state.transition({ state: "build-b", evidenceSha256: "5".repeat(64) });
  state.transition({ state: "compare", evidenceSha256: "6".repeat(64), candidateId: "7".repeat(64) });
  assert.throws(
    () => state.transition({ state: "report", evidenceSha256: "8".repeat(64), candidateId: "9".repeat(64) }),
    error => error.code === "cross-candidate-transition",
  );
});
