import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateUsabilityGate,
  readUsabilitySessions,
  UsabilityGateError,
  validateUsabilitySessions,
} from "../src/adoption/usability-gate.mjs";

const sessionsPath = "acceptance/clean-room-sessions.v1.json";

test("a passing agent retires historical agent failures while human sessions remain pending", async () => {
  const sessions = await readUsabilitySessions(sessionsPath);
  const report = evaluateUsabilityGate(sessions);
  assert.equal(report.passed, false);
  assert.deepEqual(report.summary, {
    requiredRoles: 4,
    sessions: 6,
    passedSessions: 1,
    pendingSessions: 3,
    blockedSessions: 1,
    failedSessions: 1,
    passedRoles: 1,
    violations: 3,
  });
  assert.deepEqual(report.violations.filter(item => item.role === "automated-agent"), []);
  assert.equal(report.violations.filter(item => item.code === "session-pending").length, 3);
});

test("four evidenced ordinary sessions pass without bridge-specific work", async () => {
  const sessions = await readUsabilitySessions(sessionsPath);
  const revision = "1".repeat(40);
  for (const [index, session] of sessions.sessions.entries()) {
    session.id = `${session.role}-passed-${index}`;
    session.status = "passed";
    session.cleanCheckout = true;
    session.revision = revision;
    session.commands = ["install", "import", "call", "verify"];
    session.actionableDiagnostics = true;
    session.familiarInstall = true;
    session.reproducibleVerified = true;
    session.unfamiliarConcepts = [];
    session.evidence = ["docs/evidence/clean-room-usability-protocol.md"];
  }
  const report = evaluateUsabilityGate(sessions);
  assert.equal(report.passed, true);
  assert.equal(report.summary.passedSessions, 6);
  assert.equal(report.summary.passedRoles, 4);
  assert.deepEqual(report.violations, []);
});

test("the gate rejects wrapper work, implementation concepts, and unverified receipts", async () => {
  const sessions = await readUsabilitySessions(sessionsPath);
  const agent = sessions.sessions.find(item => item.role === "automated-agent" && item.status === "passed");
  agent.status = "passed";
  agent.cleanCheckout = true;
  agent.revision = "2".repeat(40);
  agent.commands = ["lean-bridge build"];
  agent.handwrittenWrappers = 1;
  agent.unfamiliarConcepts = ["flake", "builder-image"];
  agent.actionableDiagnostics = false;
  agent.familiarInstall = false;
  agent.reproducibleVerified = false;
  agent.evidence = ["docs/evidence/time-to-package-20260811.json"];
  const codes = evaluateUsabilityGate(sessions).violations
    .filter(item => item.role === "automated-agent")
    .map(item => item.code)
    .sort();
  assert.deepEqual(codes, [
    "diagnostics-not-actionable",
    "handwritten-wrapper-required",
    "install-not-familiar",
    "reproducibility-not-verified",
    "unfamiliar-concepts-exposed",
  ]);
});

test("participant types and session documents fail closed", async () => {
  const sessions = await readUsabilitySessions(sessionsPath);
  sessions.sessions[0].participantType = "agent";
  assert.throws(
    () => validateUsabilitySessions(sessions),
    error => error instanceof UsabilityGateError && error.code === "invalid-usability-sessions",
  );
});

test("the published protocol and closed session schema are present", async () => {
  const protocol = await readFile("docs/evidence/clean-room-usability-protocol.md", "utf8");
  const schema = JSON.parse(await readFile("schema/clean-room-sessions.schema.json", "utf8"));
  assert.match(protocol, /human sessions require real participants/i);
  assert.match(protocol, /zero publishing annotations/i);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.session.additionalProperties, false);
});
