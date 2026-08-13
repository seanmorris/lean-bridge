import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
	OnboardingAcceptanceError,
	runOnboardingFixtureMatrix,
	validateOnboardingManifest,
} from "../src/adoption/onboarding.mjs";
import {
	evaluateZeroConfigAudit,
	readZeroConfigAudit,
	validateZeroConfigAudit,
	ZeroConfigAuditError,
} from "../src/adoption/zero-config-audit.mjs";

const fixtureRoot = resolve("tests/fixtures/onboarding");
const auditPath = resolve("acceptance/zero-config-audit.v1.json");

test("plain Lean onboarding matrix covers the required project categories without publishing annotations", async () => {
  const report = await runOnboardingFixtureMatrix({ fixtureRoot });
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.fixtureCount, 8);
  assert.equal(report.passed, true);
  assert.deepEqual(report.summary, {
    baselineProjects: 3
    , projectsRequiringHints: 4
    , publishingAnnotations: 0
    , handwrittenWrappers: 0
    , mismatches: 0
  });
  assert.deepEqual(report.fixtures.map(item => item.id), [
    "small"
    , "medium"
    , "generic"
    , "async"
    , "identity-bearing"
    , "custom-marshaling"
    , "incomplete-docs", "ambiguous-lifetime"
  ]);
  assert.deepEqual(
    report.fixtures.filter(item => item.actual.status === "ok").map(item => item.id),
    ["small", "medium", "async", "incomplete-docs"],
  );
  assert.equal(report.fixtures.find(item => item.id === "incomplete-docs").actual.warnings, 1);
  assert.deepEqual(
    report.fixtures.find(item => item.id === "ambiguous-lifetime").actual.requiredHints,
    ["unsupported-parameter-type"],
  );
});

test("fixture expectations fail closed on drift", async () => {
  const document = JSON.parse(await readFile("tests/fixtures/onboarding/manifest.json", "utf8"));
  document.fixtures[0].unexpected = true;
  assert.throws(
    () => validateOnboardingManifest(document),
    error => error instanceof OnboardingAcceptanceError && error.code === "invalid-onboarding-manifest",
  );
});

test("zero-configuration audit reports current blockers without treating reviewed ambiguity as a defect", async () => {
  const audit = await readZeroConfigAudit(auditPath);
  const report = evaluateZeroConfigAudit(audit);
  assert.equal(report.passed, false);
  assert.deepEqual(report.summary, {
    exceptions: 8
    , unavoidableAmbiguities: 2
    , policyChoices: 3
    , defects: 3
    , defaults: 3
    , violations: 3
  });
  assert.deepEqual(report.violations.map(item => [item.id, item.code]), [
    ["generic-projection", "blocking-zero-config-defect"]
    , ["identity-projection", "blocking-zero-config-defect"]
    , ["inactive-runtime-targets", "blocking-zero-config-defect"]
  ]);
  assert.equal(report.violations.some(item => item.id === "callback-lifetime-policy"), false);
  assert.equal(report.violations.some(item => item.id === "custom-marshaling-policy"), false);
});

test("mandatory annotations, target rebuilds, and silent defaults always fail the audit", async () => {
  const source = await readZeroConfigAudit(auditPath);
  const document = structuredClone(source);
  document.exceptions.push({
    id: "bad-annotation"
    , stage: "analyze"
    , fixture: "small"
    , kind: "annotation"
    , classification: "policy-choice"
    , mandatory: true
    , blocking: false
    , targetSpecificRebuild: true
    , description: "A convenience annotation was made mandatory."
    , evidence: ["tests/fixtures/onboarding/small"]
    , remediation: "Infer the safe case."
  });
  document.defaults[0].visible = false;
  const report = evaluateZeroConfigAudit(document);
  const codes = report.violations.filter(item => item.id === "bad-annotation").map(item => item.code).sort();
  assert.deepEqual(codes, ["mandatory-publishing-annotation", "target-specific-rebuild"]);
  assert.ok(report.violations.some(item => item.id === "project-version-default" && item.code === "silent-default"));
});

test("audit evidence paths and published schemas remain present and closed", async () => {
  const audit = await readZeroConfigAudit(auditPath);
  for(const item of [...audit.exceptions, ...audit.defaults])
{
    for(const path of item.evidence) await stat(path);
}
  const fixturesSchema = JSON.parse(await readFile("schema/onboarding-fixtures.schema.json", "utf8"));
  const auditSchema = JSON.parse(await readFile("schema/zero-config-audit.schema.json", "utf8"));
  assert.equal(fixturesSchema.additionalProperties, false);
  assert.equal(fixturesSchema.$defs.fixture.additionalProperties, false);
  assert.equal(auditSchema.additionalProperties, false);
  assert.equal(auditSchema.$defs.exception.additionalProperties, false);
  assert.equal(auditSchema.$defs.default.additionalProperties, false);
});

test("zero-configuration audit documents are closed", async () => {
  const document = await readZeroConfigAudit(auditPath);
  document.defaults[0].unknown = true;
  assert.throws(
    () => validateZeroConfigAudit(document),
    error => error instanceof ZeroConfigAuditError && error.code === "invalid-zero-config-audit",
  );
});
