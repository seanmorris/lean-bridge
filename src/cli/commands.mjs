import { diagnostic } from "./contract.mjs";
import { analyzeLeanProject } from "../analyze/lean-project.mjs";
import { buildCanonicalProject, CanonicalBuildError } from "../build/canonical-build.mjs";
import { rehearseRelease } from "../release/release-rehearsal.mjs";

const deferred = (command, node) => ({
  status: "blocked",
  result: null,
  diagnostics: [diagnostic({
    code: `${command}-implementation-pending`,
    message: `${command} has a stable CLI contract, but its implementation is not complete`,
    hint: `Complete plan node ${node} before using this command.`,
  })],
  nextActions: [],
});

export const cliHandlers = Object.freeze({
  analyze: async request => {
    const report = await analyzeLeanProject(request.project);
    const requiredHints = report.adapterHints.filter(item => item.required);
    const status = requiredHints.length > 0
      ? "needs-input"
      : report.bindingIr === null
        ? "blocked"
        : "ok";
    return {
      status,
      result: report,
      diagnostics: report.diagnostics.map(item => diagnostic(item)),
      nextActions: requiredHints.map(item =>
        `${item.declaration === null ? "Project" : item.declaration}: ${item.question}`
      ),
    };
  },
  build: async request => {
    try {
      const result = await buildCanonicalProject({ projectRoot: request.project, outputRoot: request.output });
      return { status: "ok", result, diagnostics: [], nextActions: [] };
    } catch (error) {
      if (!(error instanceof CanonicalBuildError) || !new Set([
        "build-tools-unavailable", "docker-unavailable", "nix-unavailable",
      ]).has(error.code)) throw error;
      return {
        status: "blocked",
        result: null,
        diagnostics: [diagnostic({ code: error.code, message: error.message, hint: error.hint })],
        nextActions: [],
      };
    }
  },
  publish: async request => {
    if (request.mode !== "dry-run") return deferred("publish", 879);
    if (request.bundle === null || request.output === null) {
      return {
        status: "blocked",
        result: null,
        diagnostics: [diagnostic({
          code: "dry-run-input-required",
          message: "publish --dry-run requires --bundle and --output",
          hint: "Build a canonical bundle, then pass its path and an empty local output path.",
        })],
        nextActions: [],
      };
    }
    const rehearsal = await rehearseRelease({ bundleRoot: request.bundle, outputRoot: request.output });
    return {
      status: "ok",
      result: {
        canonicalPublicationIndex: rehearsal.index,
        canonicalPublicationIndexSha256: rehearsal.indexSha256,
        attestation: rehearsal.attestation,
        readyPackages: rehearsal.ready,
        omittedPackages: rehearsal.omitted,
        externalRegistryWrites: false,
      },
      diagnostics: [],
      nextActions: [],
    };
  },
});
