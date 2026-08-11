import { readFile, readdir } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

import { analyzeLeanProject } from "../analyze/lean-project.mjs";

const fixtureCategories = new Set([
  "baseline",
  "unsupported-safe-inference",
  "unavoidable-ambiguity",
  "policy-choice",
]);
const fixtureStatuses = new Set(["ok", "blocked", "needs-input"]);

export class OnboardingAcceptanceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OnboardingAcceptanceError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new OnboardingAcceptanceError(code, message, details);
};

const exactKeys = (value, expected, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid-onboarding-manifest", `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail("invalid-onboarding-manifest", `${label} fields must be closed`, { actual, expected: wanted });
  }
};

const stringArray = (value, label) => {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || item === "")) {
    fail("invalid-onboarding-manifest", `${label} must be an array of non-empty strings`);
  }
  if (new Set(value).size !== value.length) {
    fail("invalid-onboarding-manifest", `${label} must not contain duplicates`);
  }
};

export const validateOnboardingManifest = document => {
  exactKeys(document, ["schemaVersion", "fixtures"], "onboarding manifest");
  if (document.schemaVersion !== 1) fail("invalid-onboarding-manifest", "onboarding manifest version must be 1");
  if (!Array.isArray(document.fixtures) || document.fixtures.length === 0) {
    fail("invalid-onboarding-manifest", "onboarding manifest must contain fixtures");
  }
  const ids = new Set();
  for (const fixture of document.fixtures) {
    exactKeys(fixture, [
      "id", "project", "category", "expectedStatus", "expectedExports",
      "expectedRequiredHints", "expectedWarnings",
    ], `fixture ${fixture?.id ?? "unknown"}`);
    for (const key of ["id", "project"]) {
      if (typeof fixture[key] !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(fixture[key])) {
        fail("invalid-onboarding-manifest", `${key} must use lowercase package-name syntax`);
      }
    }
    if (ids.has(fixture.id)) fail("invalid-onboarding-manifest", `duplicate fixture ${fixture.id}`);
    ids.add(fixture.id);
    if (!fixtureCategories.has(fixture.category)) fail("invalid-onboarding-manifest", `unsupported category ${fixture.category}`);
    if (!fixtureStatuses.has(fixture.expectedStatus)) fail("invalid-onboarding-manifest", `unsupported status ${fixture.expectedStatus}`);
    for (const key of ["expectedExports", "expectedWarnings"]) {
      if (!Number.isSafeInteger(fixture[key]) || fixture[key] < 0) {
        fail("invalid-onboarding-manifest", `${key} must be a non-negative integer`);
      }
    }
    stringArray(fixture.expectedRequiredHints, "expectedRequiredHints");
  }
  return true;
};

export const readOnboardingManifest = async path => {
  let document;
  try {
    document = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail("invalid-onboarding-manifest-json", `cannot read onboarding manifest ${path}`, { cause: error.message });
  }
  validateOnboardingManifest(document);
  return document;
};

const walkFiles = async root => {
  const files = [];
  const visit = async directory => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  await visit(root);
  return files;
};

const publishingAnnotationPattern = /@\[(?:lean_?bridge|export|publish|binding|wasm)[^\]]*\]/gi;
const handwrittenWrapperPattern = /(?:wrapper|binding|adapter)\.(?:c|cc|cpp|h|js|mjs|ts|py|rs)$/i;

const inspectSourceSurface = async root => {
  const files = await walkFiles(root);
  const sourceFiles = files.filter(path => path.endsWith(".lean"));
  let publishingAnnotations = 0;
  for (const path of sourceFiles) {
    const source = await readFile(path, "utf8");
    publishingAnnotations += source.match(publishingAnnotationPattern)?.length ?? 0;
  }
  return Object.freeze({
    sourceFiles: sourceFiles.length,
    publishingAnnotations,
    handwrittenWrappers: files.filter(path => handwrittenWrapperPattern.test(basename(path))).length,
  });
};

const statusOf = analysis => analysis.adapterHints.some(item => item.required)
  ? "needs-input"
  : analysis.bindingIr === null
    ? "blocked"
    : "ok";

const compareFixture = (fixture, actual) => {
  const mismatches = [];
  for (const [field, expected] of [
    ["status", fixture.expectedStatus],
    ["exports", fixture.expectedExports],
    ["warnings", fixture.expectedWarnings],
  ]) {
    if (actual[field] !== expected) mismatches.push({ field, expected, actual: actual[field] });
  }
  if (JSON.stringify(actual.requiredHints) !== JSON.stringify(fixture.expectedRequiredHints)) {
    mismatches.push({
      field: "requiredHints",
      expected: fixture.expectedRequiredHints,
      actual: actual.requiredHints,
    });
  }
  if (actual.publishingAnnotations !== 0) {
    mismatches.push({ field: "publishingAnnotations", expected: 0, actual: actual.publishingAnnotations });
  }
  if (actual.handwrittenWrappers !== 0) {
    mismatches.push({ field: "handwrittenWrappers", expected: 0, actual: actual.handwrittenWrappers });
  }
  return mismatches;
};

export const runOnboardingFixtureMatrix = async ({
  fixtureRoot,
  manifestPath = join(fixtureRoot, "manifest.json"),
  analyze = analyzeLeanProject,
} = {}) => {
  const root = resolve(fixtureRoot);
  const manifest = await readOnboardingManifest(manifestPath);
  const results = [];
  for (const fixture of manifest.fixtures) {
    const projectRoot = join(root, fixture.project);
    const [analysis, surface] = await Promise.all([
      analyze(projectRoot),
      inspectSourceSurface(projectRoot),
    ]);
    const actual = Object.freeze({
      status: statusOf(analysis),
      exports: analysis.proposedExports.length,
      requiredHints: analysis.adapterHints.filter(item => item.required).map(item => item.reason).sort(),
      warnings: analysis.diagnostics.filter(item => item.severity === "warning").length,
      sourceFiles: surface.sourceFiles,
      publishingAnnotations: surface.publishingAnnotations,
      handwrittenWrappers: surface.handwrittenWrappers,
    });
    results.push(Object.freeze({
      id: fixture.id,
      category: fixture.category,
      project: relative(process.cwd(), projectRoot).replaceAll("\\", "/"),
      expectedStatus: fixture.expectedStatus,
      actual,
      mismatches: Object.freeze(compareFixture(fixture, actual)),
    }));
  }
  const passed = results.every(item => item.mismatches.length === 0);
  return Object.freeze({
    schemaVersion: 1,
    fixtureCount: results.length,
    passed,
    summary: Object.freeze({
      baselineProjects: results.filter(item => item.category === "baseline").length,
      projectsRequiringHints: results.filter(item => item.actual.requiredHints.length > 0).length,
      publishingAnnotations: results.reduce((sum, item) => sum + item.actual.publishingAnnotations, 0),
      handwrittenWrappers: results.reduce((sum, item) => sum + item.actual.handwrittenWrappers, 0),
      mismatches: results.reduce((sum, item) => sum + item.mismatches.length, 0),
    }),
    fixtures: Object.freeze(results),
  });
};
