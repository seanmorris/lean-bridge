#!/usr/bin/env node

import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  consumerSummaryMarkdown,
  evaluateConsumerResults,
  readConsumerSupport,
  validateConsumerResult,
} from "../src/adoption/consumer-support.mjs";

const [command, ...argv] = process.argv.slice(2);
const options = new Map();
for (let index = 0; index < argv.length; index += 2) {
  const flag = argv[index];
  const value = argv[index + 1];
  if (!flag?.startsWith("--") || value === undefined) throw new Error(`invalid option ${flag ?? ""}`);
  options.set(flag, value);
}
const contract = await readConsumerSupport(options.get("--matrix"));

const bool = (name, fallback = null) => {
  const value = options.get(name);
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
};

const writeJson = async (path, value) => {
  const destination = resolve(path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(value, null, 2)}\n`);
};

if (command === "validate") {
  process.stdout.write(`Consumer support contract ${contract.contractVersion} covers ${contract.consumers.length} targets.\n`);
} else if (command === "record") {
  const id = options.get("--consumer");
  const output = options.get("--output");
  if (!id || !output) throw new Error("record requires --consumer and --output");
  const declared = contract.consumers.find(item => item.id === id);
  if (!declared) throw new Error(`unknown consumer ${id}`);
  const result = {
    schemaVersion: 1,
    consumer: id,
    declaredState: declared.state,
    testResult: options.get("--test-result") ?? "passed",
    packageInstallation: bool("--package-installation", declared.packageInstallation),
    realLeanExecution: bool("--real-lean-execution", declared.realLeanExecution),
    blocker: declared.blocker,
    command: options.get("--command") ?? declared.testCommand,
  };
  validateConsumerResult(result, contract, { allowFailed: true });
  await writeJson(output, result);
  process.stdout.write(`${id}: ${result.testResult}\n`);
} else if (command === "summary") {
  const root = resolve(options.get("--results") ?? "build/consumer-ci/results");
  const paths = [];
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".json")) paths.push(path);
    }
  };
  await visit(root);
  const results = await Promise.all(paths.sort().map(path => readFile(path, "utf8").then(JSON.parse)));
  const report = evaluateConsumerResults({ contract, results });
  const output = options.get("--output") ?? "build/consumer-ci/report.json";
  await writeJson(output, report);
  const markdown = consumerSummaryMarkdown(report);
  const summary = options.get("--summary") ?? process.env.GITHUB_STEP_SUMMARY;
  if (summary) await appendFile(resolve(summary), markdown);
  process.stdout.write(markdown);
  if (report.result !== "passed") process.exitCode = 1;
} else {
  throw new Error("Usage: consumer-ci.mjs validate|record|summary [options]");
}
