import { canonicalJson } from "../capsule/node.mjs";
import { CliContractError, cliUsage, diagnostic, parseCliArguments, validateCliResult } from "./contract.mjs";

const exitCodeFor = status => status === "ok" ? 0 : status === "failed" ? 1 : 2;

const humanResult = response => {
  const lines = [`Lean Bridge ${response.command}: ${response.status}`];
  for (const item of response.diagnostics) {
    lines.push(`${item.severity}: ${item.code}: ${item.message}`);
    if (item.path !== null) lines.push(`  path: ${item.path}`);
    if (item.hint !== null) lines.push(`  hint: ${item.hint}`);
  }
  for (const action of response.nextActions) lines.push(`next: ${action}`);
  return `${lines.join("\n")}\n`;
};

const normalizeHandlerResult = (request, outcome) => {
  const response = {
    schemaVersion: 1,
    command: request.command,
    mode: request.mode,
    status: outcome.status,
    project: request.project,
    interactive: request.interactive,
    result: outcome.result ?? null,
    diagnostics: outcome.diagnostics ?? [],
    nextActions: outcome.nextActions ?? [],
  };
  validateCliResult(response);
  return response;
};

export const runCli = async ({ argv, handlers, cwd = process.cwd(), version = "0.0.0-poc" }) => {
  let request;
  try {
    request = parseCliArguments(argv, { cwd });
  } catch (error) {
    if (!(error instanceof CliContractError)) throw error;
    return Object.freeze({
      exitCode: 64,
      stdout: "",
      stderr: `error: ${error.code}: ${error.message}\n\n${cliUsage}`,
      response: null,
    });
  }
  if (request.kind === "help") return Object.freeze({ exitCode: 0, stdout: cliUsage, stderr: "", response: null });
  if (request.kind === "version") return Object.freeze({ exitCode: 0, stdout: `${version}\n`, stderr: "", response: null });

  let response;
  try {
    const handler = handlers?.[request.command];
    if (typeof handler !== "function") {
      response = normalizeHandlerResult(request, {
        status: "blocked",
        diagnostics: [diagnostic({
          code: "command-unavailable",
          message: `${request.command} is not available in this build`,
        })],
        nextActions: ["Install a CLI build that provides this command."],
      });
    } else {
      response = normalizeHandlerResult(request, await handler(request));
    }
  } catch (error) {
    response = normalizeHandlerResult(request, {
      status: "failed",
      diagnostics: [diagnostic({
        code: error.code ?? "unexpected-cli-failure",
        message: error.message ?? String(error),
      })],
      nextActions: [],
    });
  }
  const rendered = request.format === "json" ? canonicalJson(response) : humanResult(response);
  const failed = response.status !== "ok";
  return Object.freeze({
    exitCode: exitCodeFor(response.status),
    stdout: failed && request.format === "human" ? "" : rendered,
    stderr: failed && request.format === "human" ? rendered : "",
    response,
  });
};
