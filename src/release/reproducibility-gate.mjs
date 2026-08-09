import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { arch, platform } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

import { buildCanonicalProject, processBuildRunner } from "../build/canonical-build.mjs";
import { canonicalJson } from "../capsule/node.mjs";
import { analyzeLeanProject } from "../analyze/lean-project.mjs";
import { readVerifiedCanonicalBundle } from "./canonical-bundle-input.mjs";
import { ReleaseCandidateState } from "./release-candidate-state.mjs";
import { parsePublicationIndex } from "./release-rehearsal.mjs";
import {
  collectReleaseInventory,
  compareReleaseInventories,
  hashReleaseInventory,
} from "./reproducibility.mjs";

const reportPredicate = "https://lean-bridge.dev/attestations/reproducibility/v1";
const authorizationPredicate = "https://lean-bridge.dev/attestations/release-authorization/v1";
const sha256 = value => createHash("sha256").update(value).digest("hex");
const portable = path => path.replaceAll("\\", "/");

export class ReproducibilityGateError extends Error {
  constructor(code, message, { hint = null, details = {} } = {}) {
    super(message);
    this.name = "ReproducibilityGateError";
    this.code = code;
    this.hint = hint;
    this.details = details;
  }
}

const fail = (code, message, options) => {
  throw new ReproducibilityGateError(code, message, options);
};

const exactKeys = (value, keys, label, code = "invalid-release-authorization") => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code, `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} fields must be closed`, { details: { actual, expected } });
  }
};

const digest = (value, label, code = "invalid-release-authorization") => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail(code, `${label} must be a SHA-256 identity`);
};

const requiredSequence = Object.freeze([
  "analyze",
  "generate",
  "build-a",
  "isolated-build-b",
  "compare",
  "report",
  "authorize",
  "publish",
]);

const globalEntropyCategories = Object.freeze([
  "absolute-paths",
  "archive-or-compression-metadata",
  "compiler-build-ids",
  "environment-derived-values",
  "locale-or-timezone",
  "nondeterministic-ordering",
  "random-identifiers",
  "timestamps",
  "unpinned-inputs",
]);

const reproduction = Object.freeze({
  command: "npm run release:reproducibility -- --project . --output build/reproducibility-gate",
  verificationCommand: "npm run verify:release-authorization -- --authorization build/reproducibility-gate --candidate build/reproducibility-gate/release",
});

const capture = (runner, request) => runner.capture({ timeoutMs: 30 * 60 * 1000, ...request });

export const prepareCleanGitSources = async ({ projectRoot, scratchRoot, runner = processBuildRunner }) => {
  const project = resolve(projectRoot);
  let repository;
  try {
    repository = (await capture(runner, {
      command: "git",
      args: ["-C", project, "rev-parse", "--show-toplevel"],
      cwd: project,
    })).stdout.trim();
  } catch (error) {
    fail("source-not-git", "The reproducibility gate requires a committed Git source tree", {
      hint: "Initialize the project repository and commit the exact release candidate.",
      details: { cause: error.code ?? error.message },
    });
  }
  const repositoryRoot = resolve(repository);
  const projectRelative = relative(repositoryRoot, project);
  if (projectRelative === ".." || projectRelative.startsWith(`..${sep}`)) {
    fail("invalid-project-root", "The project root is outside its Git repository");
  }
  const status = (await capture(runner, {
    command: "git",
    args: ["-C", project, "status", "--porcelain=v1", "--untracked-files=all", "--", "."],
    cwd: project,
  })).stdout.trim();
  if (status !== "") {
    fail("source-tree-dirty", "The reproducibility gate only authorizes committed source", {
      hint: "Commit or remove every Git-visible project change, then run the gate again.",
      details: { changedPaths: status.split("\n").slice(0, 100) },
    });
  }
  const [revisionResult, treeResult, lockBytes] = await Promise.all([
    capture(runner, { command: "git", args: ["-C", project, "rev-parse", "HEAD"], cwd: project }),
    capture(runner, { command: "git", args: ["-C", project, "rev-parse", "HEAD^{tree}"], cwd: project }),
    readFile(join(project, "flake.lock")),
  ]);
  const revision = revisionResult.stdout.trim();
  const tree = treeResult.stdout.trim();
  let repositoryIdentity = portable(repositoryRoot);
  try {
    repositoryIdentity = (await capture(runner, {
      command: "git",
      args: ["-C", project, "remote", "get-url", "origin"],
      cwd: project,
    })).stdout.trim() || repositoryIdentity;
  } catch {}
  const roots = [];
  for (const name of ["a", "b"]) {
    const cloneRoot = join(scratchRoot, `source-${name}`);
    await capture(runner, {
      command: "git",
      args: ["clone", "--quiet", "--no-local", "--no-hardlinks", "--no-checkout", repositoryRoot, cloneRoot],
      cwd: scratchRoot,
    });
    await capture(runner, {
      command: "git",
      args: ["-C", cloneRoot, "checkout", "--quiet", "--detach", revision],
      cwd: scratchRoot,
    });
    const cloneProject = resolve(cloneRoot, projectRelative);
    const cloneStatus = (await capture(runner, {
      command: "git",
      args: ["-C", cloneProject, "status", "--porcelain=v1", "--untracked-files=all", "--", "."],
      cwd: cloneProject,
    })).stdout.trim();
    if (cloneStatus !== "") fail("unclean-source-clone", `Independent source clone ${name.toUpperCase()} is not clean`);
    roots.push(cloneProject);
  }
  return Object.freeze({
    roots: Object.freeze(roots),
    source: Object.freeze({
      repository: repositoryIdentity,
      projectPath: projectRelative === "" ? "." : portable(projectRelative),
      revision,
      tree,
      flakeLockSha256: sha256(lockBytes),
    }),
  });
};

const collectCandidateInventory = async buildRoot => {
  const [bundle, packages] = await Promise.all([
    collectReleaseInventory(join(buildRoot, "bundle"), { prefix: "bundle" }),
    collectReleaseInventory(join(buildRoot, "packages"), { prefix: "packages" }),
  ]);
  return new Map([...bundle, ...packages]);
};

const mediaTypeFor = path => {
  if (path.endsWith(".wasm")) return "application/wasm";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".md") || path.endsWith(".txt")) return "text/plain";
  if (path.endsWith(".js") || path.endsWith(".mjs") || path.endsWith(".ts")) return "text/javascript";
  if (path.endsWith(".tgz") || path.endsWith(".tar.gz")) return "application/gzip";
  if (path.endsWith(".whl") || path.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
};

const artifactMetadata = ({ path, candidate }) => {
  const profile = candidate.manifest.runtime.profile;
  if (path.startsWith("bundle/")) {
    const bundlePath = path.slice("bundle/".length);
    const artifact = candidate.manifest.artifacts.find(item => item.path === bundlePath);
    return {
      mediaType: artifact?.mediaType ?? mediaTypeFor(path),
      target: artifact?.target ?? "host-neutral",
      profile,
    };
  }
  const segments = path.split("/");
  const ecosystem = segments[0] === "packages" && segments[1] === "packages" ? segments[2] : null;
  const mapping = ecosystem === null ? null : candidate.publication.packages.find(item => item.ecosystem === ecosystem);
  return {
    mediaType: mediaTypeFor(path),
    target: mapping?.target ?? "release-metadata",
    profile,
  };
};

const inventoryRecords = (inventory, { candidate = null } = {}) => [...inventory.entries()].map(([path, value]) => Object.freeze({
  path,
  ...(candidate === null ? {} : artifactMetadata({ path, candidate })),
  bytes: value.bytes.length,
  mode: value.mode,
  sha256: sha256(value.bytes),
})).sort((left, right) => left.path.localeCompare(right.path));

const readCandidate = async buildRoot => {
  const [{ manifest, manifestSha256 }, publication, buildReport, inventory] = await Promise.all([
    readVerifiedCanonicalBundle(join(buildRoot, "bundle")),
    readFile(join(buildRoot, "packages", "publication-index.json"), "utf8").then(parsePublicationIndex),
    readFile(join(buildRoot, "build-report.json"), "utf8").then(JSON.parse),
    collectCandidateInventory(buildRoot),
  ]);
  if (publication.bundle.canonicalManifestSha256 !== manifestSha256) {
    fail("candidate-package-drift", "The publication projection does not name its canonical bundle");
  }
  return Object.freeze({ manifest, manifestSha256, publication, buildReport, inventory });
};

const buildRecord = ({ name, result, candidate, durationMs }) => Object.freeze({
  name,
  backend: result.backend,
  backendVersion: result.backendVersion,
  builderDefinitionSha256: result.builderDefinitionSha256,
  platform: `${platform()}/${arch()}`,
  runtimeProfile: candidate.manifest.runtime.profile,
  sourceRevision: candidate.manifest.source.revision,
  canonicalManifestSha256: candidate.manifestSha256,
  coreArtifactSetSha256: result.bundle.coreArtifactSetSha256,
  artifactCount: candidate.inventory.size,
  durationMs,
  isolation: result.backend === "docker"
    ? "independent-container-overlay-and-nix-store"
    : "independent-source-clone-and-private-local-nix-store",
});

const candidateRecord = ({ source, candidate, artifacts }) => {
  const record = {
    sourceRevision: source.revision,
    sourceTree: source.tree,
    flakeLockSha256: source.flakeLockSha256,
    component: candidate.manifest.component.id,
    version: candidate.manifest.component.version,
    canonicalManifestSha256: candidate.manifestSha256,
    coreArtifactSetSha256: candidate.publication.bundle.coreArtifactSetSha256,
    artifactInventorySha256: hashReleaseInventory(artifacts),
  };
  return Object.freeze({ id: sha256(canonicalJson(record)), ...record });
};

const candidateIdentity = candidate => sha256(canonicalJson({
  sourceRevision: candidate.sourceRevision,
  sourceTree: candidate.sourceTree,
  flakeLockSha256: candidate.flakeLockSha256,
  component: candidate.component,
  version: candidate.version,
  canonicalManifestSha256: candidate.canonicalManifestSha256,
  coreArtifactSetSha256: candidate.coreArtifactSetSha256,
  artifactInventorySha256: candidate.artifactInventorySha256,
}));

const reportPolicy = Object.freeze({
  releaseCriterion: "byte-identical",
  requiredSequence,
  comparedRoots: Object.freeze(["bundle", "packages"]),
  exclusions: Object.freeze([Object.freeze({
    path: "build-report.json",
    reason: "Execution diagnostics contain backend store paths. They are retained as gate evidence and cannot reach a registry package.",
  })]),
  cleanCommittedSource: true,
  independentWritableState: true,
  externalRegistryWrites: false,
});

const emptyReport = ({ createdAt }) => ({
  schemaVersion: 1,
  predicateType: reportPredicate,
  result: "failed",
  createdAt,
  candidate: null,
  source: null,
  state: null,
  policy: reportPolicy,
  builds: [],
  artifacts: [],
  differences: [],
  likelyEntropyCategories: globalEntropyCategories,
  reproduction,
  failure: null,
});

const markdownFor = report => {
  const candidate = report.candidate === null
    ? "No release candidate was authorized."
    : `Candidate \`${report.candidate.id}\` contains ${report.artifacts.length} compared files.`;
  const differences = report.differences.length === 0
    ? "No byte or mode differences were found."
    : report.differences.slice(0, 50).map(item =>
      `- \`${item.path}\`: ${item.kind}. Build A \`${item.buildA?.sha256 ?? "missing"}\`; build B \`${item.buildB?.sha256 ?? "missing"}\`.`
    ).join("\n");
  const remainder = report.differences.length > 50
    ? `\n${report.differences.length - 50} additional paths appear in the machine-readable report.`
    : "";
  const builds = report.builds.map(item =>
    `| ${item.name} | ${item.backend} | ${item.builderDefinitionSha256} | ${item.durationMs} | ${item.artifactCount} |`
  ).join("\n");
  return `# Reproducibility gate

Result: **${report.result}**

${candidate}

${differences}${remainder}

| Build | Backend | Builder definition | Duration, ms | Files |
|---|---|---|---:|---:|
${builds}

The gate compared every file under \`bundle\` and \`packages\`. It excluded \`build-report.json\` because that file records execution paths and does not enter a registry package. The machine-readable report retains both build identities and the exclusion reason.

Reproduce the gate with:

\`\`\`sh
${report.reproduction.command}
\`\`\`
`;
};

const assertOutputAbsent = async ({ projectRoot, outputRoot }) => {
  const project = resolve(projectRoot);
  const output = resolve(outputRoot);
  if (output === project || project.startsWith(`${output}${sep}`)) fail("unsafe-gate-output", "Gate output cannot replace the project or one of its parents");
  try {
    await stat(output);
    fail("gate-output-exists", `Gate output already exists: ${output}`, { hint: "Choose a new empty output path." });
  } catch (error) {
    if (error instanceof ReproducibilityGateError) throw error;
    if (error.code !== "ENOENT") throw error;
  }
  return output;
};

const writeEvidence = async ({ staging, report, candidateRoot }) => {
  const evidence = join(staging, "evidence");
  await mkdir(evidence, { recursive: true });
  const reportSource = canonicalJson(report);
  const markdown = markdownFor(report);
  await Promise.all([
    writeFile(join(evidence, "reproducibility.json"), reportSource),
    writeFile(join(evidence, "reproducibility.md"), markdown),
  ]);
  const reportSha256 = sha256(reportSource);
  const humanReportSha256 = sha256(markdown);
  if (report.result !== "passed" || report.candidate === null || candidateRoot === null) {
    return Object.freeze({ reportSha256, humanReportSha256, authorization: null });
  }
  await mkdir(join(staging, "release"));
  await Promise.all([
    cp(join(candidateRoot, "bundle"), join(staging, "release", "bundle"), { recursive: true, dereference: true, preserveTimestamps: true }),
    cp(join(candidateRoot, "packages"), join(staging, "release", "packages"), { recursive: true, dereference: true, preserveTimestamps: true }),
  ]);
  const statement = {
    _type: "https://in-toto.io/Statement/v1",
    subject: report.artifacts.map(item => ({ name: `release/${item.path}`, digest: { sha256: item.sha256 } })),
    predicateType: reportPredicate,
    predicate: {
      result: report.result,
      candidate: report.candidate,
      report: { path: "evidence/reproducibility.json", sha256: reportSha256 },
      humanReport: { path: "evidence/reproducibility.md", sha256: humanReportSha256 },
    },
  };
  const statementSource = canonicalJson(statement);
  await writeFile(join(evidence, "reproducibility.intoto.json"), statementSource);
  const authorization = {
    schemaVersion: 1,
    predicateType: authorizationPredicate,
    status: "authorized",
    candidate: report.candidate,
    evidence: {
      reportPath: "evidence/reproducibility.json",
      reportSha256,
      humanReportPath: "evidence/reproducibility.md",
      humanReportSha256,
      attestationPath: "evidence/reproducibility.intoto.json",
      attestationSha256: sha256(statementSource),
    },
    authorizedArtifacts: report.artifacts,
    publication: {
      externalRegistryWritesPerformed: false,
      packagesPath: "release/packages/publication-index.json",
      packagesSha256: report.artifacts.find(item => item.path === "packages/publication-index.json").sha256,
    },
  };
  validateReleaseAuthorization(authorization);
  const authorizationSource = canonicalJson(authorization);
  await writeFile(join(staging, "release-authorization.json"), authorizationSource);
  await writeFile(
    join(staging, "release-authorization.sha256"),
    `${sha256(authorizationSource)}  release-authorization.json\n`,
  );
  return Object.freeze({ reportSha256, humanReportSha256, authorization });
};

const failureRecord = error => ({
  code: error.code ?? "reproducibility-gate-failed",
  message: error.message ?? String(error),
  hint: error.hint ?? null,
});

export const runReproducibilityGate = async ({
  projectRoot,
  outputRoot,
  environment = process.env,
  runner = processBuildRunner,
  build = buildCanonicalProject,
  analyze = analyzeLeanProject,
  sourcePreparer = prepareCleanGitSources,
  now = () => Date.now(),
} = {}) => {
  const project = resolve(projectRoot ?? process.cwd());
  const output = await assertOutputAbsent({
    projectRoot: project,
    outputRoot: outputRoot ?? join(project, "build", "reproducibility-gate"),
  });
  await mkdir(dirname(output), { recursive: true });
  const scratch = await mkdtemp(join(dirname(output), ".lean-bridge-repro-"));
  const staging = join(scratch, "result");
  await mkdir(staging);
  const report = emptyReport({ createdAt: new Date(now()).toISOString() });
  let source = null;
  let leftRoot = null;
  let state = null;
  try {
    const prepared = await sourcePreparer({ projectRoot: project, scratchRoot: scratch, runner });
    source = prepared.source;
    report.source = source;
    state = new ReleaseCandidateState({ sourceIdentitySha256: sha256(canonicalJson(source)) });
    const analysis = await analyze(prepared.roots[0]);
    const requiredHints = analysis.adapterHints.filter(item => item.required);
    if (analysis.bindingIr === null || requiredHints.length > 0) {
      fail("release-analysis-incomplete", "Release analysis did not produce a complete binding contract", {
        hint: "Resolve required adapter hints before running the reproducibility gate.",
      });
    }
    state.transition({ state: "analyze", evidenceSha256: sha256(canonicalJson(analysis)) });
    state.transition({ state: "generate", evidenceSha256: analysis.bindingIr.semanticSha256 });
    report.state = state.snapshot();
    const built = [];
    for (const [index, name] of ["A", "B"].entries()) {
      const buildRoot = join(scratch, `build-${name.toLowerCase()}`);
      const started = now();
      const result = await build({
        projectRoot: prepared.roots[index],
        outputRoot: buildRoot,
        environment: {
          ...environment,
          LEAN_BRIDGE_NIX_STORE: join(scratch, `nix-store-${name.toLowerCase()}`),
        },
      });
      const candidate = await readCandidate(buildRoot);
      built.push({ name, buildRoot, result, candidate, durationMs: Math.max(0, now() - started) });
      state.transition({ state: `build-${name.toLowerCase()}`, evidenceSha256: candidate.manifestSha256 });
      report.state = state.snapshot();
    }
    const [left, right] = built;
    leftRoot = left.buildRoot;
    report.builds = built.map(buildItem => buildRecord(buildItem));
    if (
      left.result.backend !== right.result.backend ||
      left.result.builderDefinitionSha256 !== right.result.builderDefinitionSha256
    ) {
      fail("build-environment-drift", "Clean builds selected different backend or builder identities");
    }
    if (left.candidate.manifest.source.revision !== source.revision || right.candidate.manifest.source.revision !== source.revision) {
      fail("source-revision-drift", "A build did not attest the committed source revision", {
        details: {
          expected: source.revision,
          buildA: left.candidate.manifest.source.revision,
          buildB: right.candidate.manifest.source.revision,
        },
      });
    }
    if (
      left.candidate.manifest.locks.flake.sha256 !== source.flakeLockSha256 ||
      right.candidate.manifest.locks.flake.sha256 !== source.flakeLockSha256
    ) {
      fail("flake-lock-drift", "A build did not retain the committed flake lock bytes");
    }
    const comparison = compareReleaseInventories(left.candidate.inventory, right.candidate.inventory);
    report.artifacts = inventoryRecords(left.candidate.inventory, { candidate: left.candidate });
    report.differences = comparison.differences;
    report.candidate = candidateRecord({ source, candidate: left.candidate, artifacts: report.artifacts });
    state.transition({
      state: "compare",
      evidenceSha256: sha256(canonicalJson({ artifacts: report.artifacts, differences: report.differences })),
      candidateId: report.candidate.id,
    });
    state.transition({
      state: "report",
      evidenceSha256: sha256(canonicalJson({ candidate: report.candidate, result: comparison.differences.length === 0 ? "passed" : "failed" })),
      candidateId: report.candidate.id,
    });
    report.state = state.snapshot();
    if (comparison.differences.length > 0) {
      fail("release-not-reproducible", `${comparison.differences.length} release artifact paths differ between clean builds`, {
        hint: `Inspect ${portable(join(output, "evidence", "reproducibility.json"))} for hashes and bounded diffs.`,
      });
    }
    state.transition({ state: "authorize", evidenceSha256: report.candidate.id, candidateId: report.candidate.id });
    report.state = state.snapshot();
    report.result = "passed";
    report.failure = null;
    const evidence = await writeEvidence({ staging, report, candidateRoot: leftRoot });
    await verifyReleaseAuthorization({ authorizationRoot: staging, candidateRoot: join(staging, "release") });
    await rename(staging, output);
    return Object.freeze({
      output,
      result: report.result,
      candidate: report.candidate,
      report: join(output, "evidence", "reproducibility.json"),
      reportSha256: evidence.reportSha256,
      authorization: join(output, "release-authorization.json"),
      externalRegistryWrites: false,
    });
  } catch (error) {
    report.failure = failureRecord(error);
    if (report.source === null && source !== null) report.source = source;
    if (state !== null) report.state = state.snapshot();
    const evidence = await writeEvidence({ staging, report, candidateRoot: null });
    await rename(staging, output);
    throw new ReproducibilityGateError(error.code ?? "reproducibility-gate-failed", error.message ?? String(error), {
      hint: error.hint ?? null,
      details: { output, report: join(output, "evidence", "reproducibility.json"), reportSha256: evidence.reportSha256 },
    });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
};

export const validateReleaseAuthorization = authorization => {
  exactKeys(authorization, [
    "schemaVersion", "predicateType", "status", "candidate", "evidence", "authorizedArtifacts", "publication",
  ], "release authorization");
  if (authorization.schemaVersion !== 1 || authorization.predicateType !== authorizationPredicate || authorization.status !== "authorized") {
    fail("invalid-release-authorization", "Release authorization version, predicate, or status is invalid");
  }
  exactKeys(authorization.candidate, [
    "id", "sourceRevision", "sourceTree", "flakeLockSha256", "component", "version",
    "canonicalManifestSha256", "coreArtifactSetSha256", "artifactInventorySha256",
  ], "authorization candidate");
  for (const field of ["id", "flakeLockSha256", "canonicalManifestSha256", "coreArtifactSetSha256", "artifactInventorySha256"]) {
    digest(authorization.candidate[field], `candidate.${field}`);
  }
  if (candidateIdentity(authorization.candidate) !== authorization.candidate.id) {
    fail("authorization-candidate-drift", "Release candidate identity differs from its recorded properties");
  }
  exactKeys(authorization.evidence, [
    "reportPath", "reportSha256", "humanReportPath", "humanReportSha256", "attestationPath", "attestationSha256",
  ], "authorization evidence");
  for (const field of ["reportSha256", "humanReportSha256", "attestationSha256"]) digest(authorization.evidence[field], `evidence.${field}`);
  if (!Array.isArray(authorization.authorizedArtifacts) || authorization.authorizedArtifacts.length === 0) {
    fail("invalid-release-authorization", "Release authorization requires an artifact inventory");
  }
  let previousPath = null;
  for (const artifact of authorization.authorizedArtifacts) {
    exactKeys(artifact, ["path", "mediaType", "target", "profile", "bytes", "mode", "sha256"], "authorized artifact");
    if (
      typeof artifact.path !== "string" || artifact.path === "" || artifact.path.startsWith("/") ||
      artifact.path.includes("\\") || artifact.path.split("/").includes("..") ||
      typeof artifact.mediaType !== "string" || artifact.mediaType === "" ||
      typeof artifact.target !== "string" || artifact.target === "" ||
      typeof artifact.profile !== "string" || artifact.profile === "" ||
      !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0 ||
      !Number.isSafeInteger(artifact.mode) || artifact.mode < 0 || artifact.mode > 0o777
    ) fail("invalid-release-authorization", "Authorized artifact path, byte count, or mode is invalid");
    if (previousPath !== null && artifact.path.localeCompare(previousPath) <= 0) {
      fail("invalid-release-authorization", "Authorized artifacts must use unique canonical path order");
    }
    previousPath = artifact.path;
    digest(artifact.sha256, `artifact ${artifact.path}`);
  }
  exactKeys(authorization.publication, [
    "externalRegistryWritesPerformed", "packagesPath", "packagesSha256",
  ], "authorization publication");
  if (authorization.publication.externalRegistryWritesPerformed !== false) {
    fail("invalid-release-authorization", "Gate evidence cannot claim an external registry write");
  }
  if (authorization.publication.packagesPath !== "release/packages/publication-index.json") {
    fail("invalid-release-authorization", "Release authorization names an unsupported publication index path");
  }
  digest(authorization.publication.packagesSha256, "publication.packagesSha256");
  const publicationIndex = authorization.authorizedArtifacts.find(item => item.path === "packages/publication-index.json");
  if (publicationIndex?.sha256 !== authorization.publication.packagesSha256) {
    fail("authorization-publication-drift", "Publication index identity differs from the authorized artifact inventory");
  }
  if (hashReleaseInventory(authorization.authorizedArtifacts) !== authorization.candidate.artifactInventorySha256) {
    fail("authorization-inventory-drift", "Authorized artifact inventory differs from the candidate identity");
  }
  return true;
};

const readEvidenceFile = async (root, path, expected) => {
  if (typeof path !== "string" || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) {
    fail("invalid-release-authorization", `Evidence path is not relative: ${path}`);
  }
  const bytes = await readFile(join(root, path));
  const actual = sha256(bytes);
  if (actual !== expected) fail("authorization-evidence-drift", `Release evidence changed: ${path}`, { details: { expected, actual } });
  return bytes;
};

export const verifyReleaseAuthorization = async ({ authorizationRoot, candidateRoot }) => {
  const root = resolve(authorizationRoot);
  const authorizationSource = await readFile(join(root, "release-authorization.json"), "utf8");
  const authorizationDigest = sha256(authorizationSource);
  const digestLine = (await readFile(join(root, "release-authorization.sha256"), "utf8")).trim();
  if (digestLine !== `${authorizationDigest}  release-authorization.json`) {
    fail("authorization-hash-drift", "Release authorization hash record differs from its bytes");
  }
  const authorization = JSON.parse(authorizationSource);
  validateReleaseAuthorization(authorization);
  const inventory = await collectCandidateInventory(resolve(candidateRoot));
  const actualArtifacts = inventoryRecords(inventory);
  const authorizedByPath = new Map(authorization.authorizedArtifacts.map(item => [item.path, item]));
  const actualByPath = new Map(actualArtifacts.map(item => [item.path, item]));
  const drift = [...new Set([...authorizedByPath.keys(), ...actualByPath.keys()])].sort().filter(path => {
    const expected = authorizedByPath.get(path);
    const actual = actualByPath.get(path);
    return expected === undefined || actual === undefined ||
      expected.bytes !== actual.bytes || expected.mode !== actual.mode || expected.sha256 !== actual.sha256;
  });
  if (drift.length > 0) {
    fail("authorized-candidate-drift", "Release candidate files differ from the authorized inventory", {
      details: { paths: drift },
    });
  }
  await Promise.all([
    readEvidenceFile(root, authorization.evidence.reportPath, authorization.evidence.reportSha256),
    readEvidenceFile(root, authorization.evidence.humanReportPath, authorization.evidence.humanReportSha256),
    readEvidenceFile(root, authorization.evidence.attestationPath, authorization.evidence.attestationSha256),
  ]);
  const report = JSON.parse(await readFile(join(root, authorization.evidence.reportPath), "utf8"));
  const expectedStates = ["created", "analyze", "generate", "build-a", "build-b", "compare", "report", "authorize"];
  if (
    report.result !== "passed" || report.candidate?.id !== authorization.candidate.id ||
    report.state?.current !== "authorize" || report.state.candidateId !== authorization.candidate.id ||
    JSON.stringify(report.state.history.map(item => item.state)) !== JSON.stringify(expectedStates)
  ) {
    fail("authorization-report-drift", "Reproducibility report does not authorize this candidate");
  }
  const { manifestSha256 } = await readVerifiedCanonicalBundle(join(resolve(candidateRoot), "bundle"));
  if (manifestSha256 !== authorization.candidate.canonicalManifestSha256) {
    fail("authorized-manifest-drift", "Canonical manifest differs from the release authorization");
  }
  return Object.freeze({
    status: "authorized",
    candidate: authorization.candidate,
    authorizationSha256: authorizationDigest,
    artifactCount: authorization.authorizedArtifacts.length,
  });
};
