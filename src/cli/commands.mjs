import { diagnostic } from "./contract.mjs";
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
  analyze: async request => {
    const report = await analyze(request.project);
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
      const result = await build({ projectRoot: request.project, outputRoot: request.output });
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
          nextActions: [],
        };
      }
      const verified = await verifyAuthorization({
        authorizationRoot: request.authorization,
        candidateRoot: request.bundle,
      });
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
        nextActions: [],
      };
    }
    try {
      const result = await gate({ projectRoot: request.project, outputRoot: request.output });
      return { status: "ok", result, diagnostics: [], nextActions: [] };
    } catch (error) {
      if (!(error instanceof ReproducibilityGateError)) throw error;
      const blocked = new Set([
        "source-not-git", "source-tree-dirty", "build-tools-unavailable", "docker-unavailable", "nix-unavailable",
      ]).has(error.code);
      return {
        status: blocked ? "blocked" : "failed",
        result: error.details?.report ? {
          gateOutput: error.details.output,
          report: error.details.report,
          externalRegistryWrites: false,
        } : null,
        diagnostics: [diagnostic({ code: error.code, message: error.message, hint: error.hint })],
        nextActions: [],
      };
    }
  },
});

export const cliHandlers = createCliHandlers();
