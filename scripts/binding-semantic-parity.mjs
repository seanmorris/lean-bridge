#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { parseBindingIr } from "../src/binding-ir/canonical.mjs";
import {
  BindingSemanticParityError,
  compileCrossLanguageSemanticParity,
  supportedSemanticParityBackends,
} from "../src/binding-ir/semantic-parity.mjs";

const usage = () => {
  process.stderr.write("usage: binding-semantic-parity <binding-ir.json> [javascript,python,c,rust]\n");
  process.exitCode = 2;
};

const main = async () => {
  const [bindingPath, backendList] = process.argv.slice(2);
  if (!bindingPath) return usage();
  const backends = backendList ? backendList.split(",").filter(Boolean) : supportedSemanticParityBackends;
  const ir = parseBindingIr(await readFile(bindingPath, "utf8"));
  const report = compileCrossLanguageSemanticParity(ir, { backends });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

main().catch(error => {
  if (error instanceof BindingSemanticParityError) {
    process.stderr.write(`${JSON.stringify({ code: error.code, message: error.message, details: error.details }, null, 2)}\n`);
  } else {
    process.stderr.write(`${error.stack ?? error.message}\n`);
  }
  process.exitCode = 1;
});
