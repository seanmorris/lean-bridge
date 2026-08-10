import { relative } from "node:path";

import { diagnostic, prompt } from "./contract.mjs";
import { analyzeLeanProject } from "../analyze/lean-project.mjs";
import { AnalysisOutputError, writeAnalysisOutput } from "../analyze/output.mjs";
import { evaluateAnalysisPolicy } from "../analyze/policy.mjs";
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

const portablePolicyPath = (project, path) => path === null
  ? null
  : relative(project, path).replaceAll("\\", "/") || ".";

const policyDiagnostics = report => {
  if (report === null) return [];
  const source = report.policy.source === "builtin"
    ? "built-in policy"
    : `policy ${report.policy.path}`;
  const summary = diagnostic({
    code: report.passed ? "analysis-policy-passed" : "analysis-policy-failed",
    severity: report.passed ? "info" : "error",
    message: `${source} ${report.policy.sha256} ${report.passed ? "passed" : "failed"}`,
    path: report.policy.path,
    hint: report.passed ? null : "Resolve the listed policy violations or select a reviewed policy.",
  });
  return [
    summary,
    ...report.violations.map(item => diagnostic({
      code: item.code,
      severity: "error",
      message: `${item.message}; expected ${item.expected}, actual ${item.actual}`,
      path: report.policy.path,
      hint: null,
    })),
  ];
};

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
    let policyReport = null;
    if (request.analysis.check) {
      emitProgress?.({ phase: "policy", state: "started", message: "Evaluating the analysis policy" });
      policyReport = evaluateAnalysisPolicy({
        analysis: report,
        policyRecord: request.analysis.policy,
        policyPath: portablePolicyPath(request.project, request.analysis.policy.path),
      });
      emitProgress?.({
        phase: "policy",
        state: policyReport.passed ? "completed" : "failed",
        message: policyReport.passed ? "Analysis policy passed" : "Analysis policy failed",
        current: policyReport.violations.length,
        total: policyReport.violations.length,
      });
    }
    let status = requiredHints.length > 0
      ? "needs-input"
      : report.bindingIr === null
        ? "blocked"
        : "ok";
    if (status === "ok" && policyReport !== null && !policyReport.passed) status = "failed";
    const diagnostics = [
      ...report.diagnostics.map(item => diagnostic(item)),
      ...policyDiagnostics(policyReport),
    ];
    if (request.output !== null) {
      emitProgress?.({ phase: "output", state: "started", message: "Writing the requested analysis output" });
      try {
        const output = await writeAnalysisOutput({
          outputRoot: request.output,
          analysis: report,
          policyReport,
          signal,
        });
        diagnostics.push(diagnostic({
          code: "analysis-output-written",
          severity: "info",
          message: `Wrote ${output.files.join(", ")}`,
          path: output.directory,
        }));
        emitProgress?.({
          phase: "output",
          state: "completed",
          message: "Analysis output written atomically",
          current: output.files.length,
          total: output.files.length,
        });
      } catch (error) {
        if (!(error instanceof AnalysisOutputError)) throw error;
        diagnostics.push(diagnostic({
          code: error.code,
          message: error.message,
          path: error.details.output ?? request.output,
          hint: "Choose a path that does not exist.",
        }));
        emitProgress?.({ phase: "output", state: "blocked", message: "Analysis output was not written" });
        status = error.code === "analysis-output-exists" ? "blocked" : "failed";
      }
    }
    const analyzeState = status === "ok" ? "completed" : status === "failed" ? "failed" : "blocked";
    const analyzeMessage = status === "ok"
      ? "Analysis produced a binding contract"
      : status === "failed"
        ? "Analysis did not satisfy the selected policy"
        : "Analysis requires an explicit decision";
    emitProgress?.({
      phase: "analyze",
      state: analyzeState,
      message: analyzeMessage,
      current: report.exportCandidates.length,
      total: report.exportCandidates.length,
    });
    return {
      status,
      result: report,
      diagnostics,
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
