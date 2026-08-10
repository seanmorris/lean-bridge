import { mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { canonicalJson } from "../capsule/node.mjs";

export class AnalysisOutputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AnalysisOutputError";
    this.code = code;
    this.details = details;
  }
}

const exists = async path => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
};

export const writeAnalysisOutput = async ({ outputRoot, analysis, policyReport = null, signal = undefined }) => {
  const output = resolve(outputRoot);
  signal?.throwIfAborted();
  if (await exists(output)) {
    throw new AnalysisOutputError(
      "analysis-output-exists",
      `analysis output path already exists: ${output}`,
      { output },
    );
  }
  const parent = dirname(output);
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(join(parent, `.${basename(output)}.tmp-`));
  const files = [];
  try {
    signal?.throwIfAborted();
    await writeFile(join(staging, "project-analysis.json"), canonicalJson(analysis), { flag: "wx" });
    files.push("project-analysis.json");
    if (analysis.bindingIr !== null) {
      signal?.throwIfAborted();
      await writeFile(join(staging, "binding-ir.json"), canonicalJson(analysis.bindingIr.document), { flag: "wx" });
      files.push("binding-ir.json");
    }
    if (policyReport !== null) {
      signal?.throwIfAborted();
      await writeFile(join(staging, "policy-report.json"), canonicalJson(policyReport), { flag: "wx" });
      files.push("policy-report.json");
    }
    signal?.throwIfAborted();
    try {
      await rename(staging, output);
    } catch (error) {
      if (new Set(["EEXIST", "ENOTEMPTY"]).has(error.code)) {
        throw new AnalysisOutputError(
          "analysis-output-exists",
          `analysis output path already exists: ${output}`,
          { output },
        );
      }
      throw error;
    }
    return Object.freeze({ directory: output, files: Object.freeze(files.sort()) });
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};
