import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { processBuildRunner } from "../build/canonical-build.mjs";
import {
  createIndependentConfirmation,
  writeIndependentConfirmation,
} from "./independent-confirmation.mjs";
import {
  runReproducibilityGate,
  verifyReleaseAuthorization,
} from "./reproducibility-gate.mjs";

export class IndependentVerifierError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "IndependentVerifierError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details) => {
  throw new IndependentVerifierError(code, message, details);
};

const capture = (runner, request) => runner.capture({ timeoutMs: 30 * 60 * 1000, ...request });
const maximumArchiveBytes = 1024 * 1024 * 1024;

export const validateArchiveEntries = (source, verboseSource = null) => {
  const entries = source.split("\n").filter(Boolean);
  if (entries.length === 0) fail("empty-release-archive", "Published release archive is empty");
  for (const entry of entries) {
    if (entry.includes("\\") || isAbsolute(entry) || entry.split("/").includes("..")) {
      fail("unsafe-release-archive", `Published release archive contains an unsafe path: ${entry}`);
    }
  }
  if (verboseSource !== null) {
    const verbose = verboseSource.split("\n").filter(Boolean);
    if (verbose.length !== entries.length || verbose.some(line => !new Set(["-", "d"]).has(line[0]))) {
      fail("unsafe-release-archive-entry", "Published release archive may contain only regular files and directories");
    }
  }
  return Object.freeze(entries);
};

const downloadArchive = async ({ url, path, fetchImpl }) => {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") fail("unsupported-release-url", "Published release archives must use HTTPS");
  const response = await fetchImpl(url, { redirect: "follow" });
  if (!response.ok || response.body === null) {
    fail("release-download-failed", `Published release download returned HTTP ${response.status}`);
  }
  if (new URL(response.url).protocol !== "https:") {
    fail("unsupported-release-redirect", "Published release redirects must remain on HTTPS");
  }
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximumArchiveBytes) fail("release-download-too-large", "Published release archive exceeds 1 GiB");
  let bytes = 0;
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      if (bytes > maximumArchiveBytes) callback(new IndependentVerifierError("release-download-too-large", "Published release archive exceeds 1 GiB"));
      else callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(path, { flags: "wx", mode: 0o600 }));
};

const locateAuthorizationRoot = async extracted => {
  const direct = join(extracted, "release-authorization.json");
  try {
    await readFile(direct);
    return extracted;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const entries = await readdir(extracted, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await readFile(join(extracted, entry.name, "release-authorization.json"));
      candidates.push(join(extracted, entry.name));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (candidates.length !== 1) fail("release-authorization-root-ambiguous", "Archive must contain one release authorization root");
  return candidates[0];
};

export const preparePublishedRelease = async ({ published, scratchRoot, runner = processBuildRunner, fetchImpl = fetch }) => {
  if (typeof published !== "string" || published === "") fail("published-release-required", "Published release path or HTTPS URL is required");
  let archive;
  if (!/^https?:\/\//.test(published)) {
    const local = resolve(published);
    const facts = await stat(local);
    if (facts.isDirectory()) return local;
    if (!facts.isFile()) fail("unsupported-published-release", "Published release must be a directory or tar archive");
    if (facts.size > maximumArchiveBytes) fail("release-archive-too-large", "Published release archive exceeds 1 GiB");
    archive = local;
  } else {
    archive = join(scratchRoot, "published-release.tar");
    await downloadArchive({ url: published, path: archive, fetchImpl });
  }
  const extracted = join(scratchRoot, "published-release");
  const [listing, verbose] = await Promise.all([
    capture(runner, { command: "tar", args: ["-tf", archive], cwd: scratchRoot }),
    capture(runner, { command: "tar", args: ["-tvf", archive], cwd: scratchRoot }),
  ]);
  validateArchiveEntries(listing.stdout, verbose.stdout);
  await mkdir(extracted);
  await capture(runner, {
    command: "tar",
    args: ["--no-same-owner", "--same-permissions", "-xf", archive, "-C", extracted],
    cwd: scratchRoot,
  });
  return locateAuthorizationRoot(extracted);
};

export const checkoutIndependentSource = async ({ repository, revision, scratchRoot, runner = processBuildRunner }) => {
  if (typeof repository !== "string" || repository === "") fail("repository-required", "Source repository is required");
  if (typeof revision !== "string" || !/^[0-9a-f]{40}$/.test(revision)) fail("revision-required", "Source revision must be a 40-character Git commit");
  const source = join(scratchRoot, "source");
  await capture(runner, {
    command: "git",
    args: ["clone", "--quiet", "--no-checkout", repository, source],
    cwd: scratchRoot,
  });
  await capture(runner, {
    command: "git",
    args: ["-C", source, "checkout", "--quiet", "--detach", revision],
    cwd: scratchRoot,
  });
  return source;
};

export const verifyIndependentRelease = async ({
  repository,
  revision = null,
  published,
  outputRoot,
  verifierIdentity = null,
  reportUrl = null,
  environment = process.env,
  runner = processBuildRunner,
  fetchImpl = fetch,
  preparePublished = preparePublishedRelease,
  checkoutSource = checkoutIndependentSource,
  gate = runReproducibilityGate,
  verifyAuthorization = verifyReleaseAuthorization,
  now = () => new Date().toISOString(),
} = {}) => {
  const output = resolve(outputRoot ?? join(process.cwd(), "build", "independent-confirmation"));
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-independent-verifier-"));
  try {
    const publishedRoot = await preparePublished({ published, scratchRoot: scratch, runner, fetchImpl });
    const publishedVerification = await verifyAuthorization({
      authorizationRoot: publishedRoot,
      candidateRoot: join(publishedRoot, "release"),
    });
    const selectedRevision = revision ?? publishedVerification.candidate.sourceRevision;
    if (selectedRevision !== publishedVerification.candidate.sourceRevision) {
      fail("published-revision-drift", "Requested source revision differs from the published authorization", {
        requested: selectedRevision,
        published: publishedVerification.candidate.sourceRevision,
      });
    }
    const source = await checkoutSource({ repository, revision: selectedRevision, scratchRoot: scratch, runner });
    const rebuiltRoot = join(scratch, "rebuilt-gate");
    const rebuiltGate = await gate({ projectRoot: source, outputRoot: rebuiltRoot, environment });
    const rebuiltVerification = await verifyAuthorization({
      authorizationRoot: rebuiltRoot,
      candidateRoot: join(rebuiltRoot, "release"),
    });
    const rebuiltReport = JSON.parse(await readFile(rebuiltGate.report, "utf8"));
    const confirmation = createIndependentConfirmation({
      published: publishedVerification,
      rebuilt: {
        candidate: rebuiltVerification.candidate,
        authorizationSha256: rebuiltVerification.authorizationSha256,
        reportSha256: rebuiltGate.reportSha256,
      },
      verifierIdentity,
      reportUrl,
      environment: {
        source: rebuiltReport.source,
        builds: rebuiltReport.builds.map(item => ({
          backend: item.backend,
          backendVersion: item.backendVersion,
          builderDefinitionSha256: item.builderDefinitionSha256,
          platform: item.platform,
          runtimeProfile: item.runtimeProfile,
        })),
      },
      confirmedAt: now(),
    });
    const written = await writeIndependentConfirmation({ outputRoot: output, confirmation });
    return Object.freeze({
      status: "confirmed",
      candidate: publishedVerification.candidate,
      publishedAuthorizationSha256: publishedVerification.authorizationSha256,
      rebuiltAuthorizationSha256: rebuiltVerification.authorizationSha256,
      ...written,
    });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
};
