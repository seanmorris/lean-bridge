import { diagnostic, prompt } from "./contract.mjs";
import { analyzeLeanProject } from "../analyze/lean-project.mjs";
import { buildCanonicalProject, CanonicalBuildError } from "../build/canonical-build.mjs";
import {
  ReproducibilityGateError,
  runReproducibilityGate,
  verifyReleaseAuthorization,
} from "../release/reproducibility-gate.mjs";

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

export const createCliHandlers = ({
  analyze = analyzeLeanProject,
  build = buildCanonicalProject,
  gate = runReproducibilityGate,
  verifyAuthorization = verifyReleaseAuthorization,
} = {}) => Object.freeze({
  analyze: async (request, { signal, emitProgress } = {}) => {
    emitProgress?.({ phase: "analyze", state: "started", message: "Inspecting Lean declarations and binding evidence" });
    signal?.throwIfAborted();
    const report = await analyze(request.project, { signal, targets: request.selection.targets });
    signal?.throwIfAborted();
    const requiredHints = report.adapterHints.filter(item => item.required);
    const status = requiredHints.length > 0
      ? "needs-input"
      : report.bindingIr === null
        ? "blocked"
        : "ok";
    emitProgress?.({
      phase: "analyze",
      state: status === "ok" ? "completed" : "blocked",
      message: status === "ok" ? "Analysis produced a binding contract" : "Analysis requires an explicit decision",
      current: report.exportCandidates.length,
      total: report.exportCandidates.length,
    });
    return {
      status,
      result: report,
      diagnostics: report.diagnostics.map(item => diagnostic(item)),
      prompts: requiredHints.map(item => prompt({
        id: item.id,
        message: item.question,
        choices: item.choices,
        required: item.required,
        declaration: item.declaration,
      })),
      nextActions: requiredHints.map(item =>
        `${item.declaration === null ? "Project" : item.declaration}: ${item.question}`
      ),
    };
  },
  build: async (request, { signal, emitProgress } = {}) => {
    try {
      emitProgress?.({ phase: "build", state: "started", message: "Building the canonical artifact and package closure" });
      signal?.throwIfAborted();
      const result = await build({
        projectRoot: request.project,
        outputRoot: request.output,
        targets: request.selection.targets,
        cache: request.cache,
        signal,
        onProgress: emitProgress,
      });
      signal?.throwIfAborted();
      emitProgress?.({ phase: "build", state: "completed", message: "Canonical build completed" });
      return { status: "ok", result, diagnostics: [], prompts: [], nextActions: [] };
    } catch (error) {
      if (!(error instanceof CanonicalBuildError) || !new Set([
        "build-tools-unavailable", "docker-unavailable", "nix-unavailable",
        "cache-directory-unsupported", "unknown-package-target", "package-target-ineligible",
      ]).has(error.code)) throw error;
      return {
        status: "blocked",
        result: null,
        diagnostics: [diagnostic({ code: error.code, message: error.message, hint: error.hint })],
        prompts: [],
        nextActions: [],
      };
    }
  },
  publish: async (request, { signal, emitProgress } = {}) => {
    if (request.mode !== "dry-run") {
      if (request.authorization === null || request.bundle === null) {
        return {
          status: "blocked",
          result: null,
          diagnostics: [diagnostic({
            code: "publish-authorization-required",
            message: "publish requires a reproducibility authorization and its exact candidate",
            hint: "Pass --authorization <gate directory> and --bundle <gate directory>/release.",
          })],
          prompts: [],
          nextActions: [],
        };
      }
      emitProgress?.({ phase: "authorize", state: "started", message: "Verifying the exact release candidate authorization" });
      signal?.throwIfAborted();
      const verified = await verifyAuthorization({
        authorizationRoot: request.authorization,
        candidateRoot: request.bundle,
        targets: request.selection.targets,
        signal,
      });
      signal?.throwIfAborted();
      emitProgress?.({ phase: "authorize", state: "completed", message: "Release candidate authorization verified" });
      const pending = deferred("publish", 879);
      return { ...pending, result: { authorization: verified, externalRegistryWrites: false } };
    }
    if (request.output === null || request.bundle !== null || request.authorization !== null) {
      return {
        status: "blocked",
        result: null,
        diagnostics: [diagnostic({
          code: "dry-run-input-required",
          message: "publish --dry-run requires --output and builds its own release candidate",
          hint: "Remove --bundle and pass one empty output path for the candidate and gate evidence.",
        })],
        prompts: [],
        nextActions: [],
      };
    }
    try {
      emitProgress?.({ phase: "reproducibility", state: "started", message: "Building and comparing two isolated release candidates" });
      signal?.throwIfAborted();
      const result = await gate({
        projectRoot: request.project,
        outputRoot: request.output,
        targets: request.selection.targets,
        cache: request.cache,
        signal,
        onProgress: emitProgress,
      });
      signal?.throwIfAborted();
      emitProgress?.({ phase: "reproducibility", state: "completed", message: "Release candidate is reproducible and authorized" });
      return { status: "ok", result, diagnostics: [], prompts: [], nextActions: [] };
    } catch (error) {
      if (!(error instanceof ReproducibilityGateError)) throw error;
      const blocked = new Set([
        "source-not-git", "source-tree-dirty", "build-tools-unavailable", "docker-unavailable", "nix-unavailable",
        "reproducibility-cache-directory-unsupported", "cache-directory-unsupported",
        "unknown-package-target", "package-target-ineligible",
      ]).has(error.code);
      return {
        status: blocked ? "blocked" : "failed",
        result: error.details?.report ? {
          gateOutput: error.details.output,
          report: error.details.report,
          externalRegistryWrites: false,
        } : null,
        diagnostics: [diagnostic({ code: error.code, message: error.message, hint: error.hint })],
        prompts: [],
        nextActions: [],
      };
    }
  },
});

export const cliHandlers = createCliHandlers();
