#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { parseBindingIr } from "../src/binding-ir/canonical.mjs";
import {
	GeneratedPackageGateError,
	assertGeneratedPackageGate,
	compileGeneratedPackageGate,
} from "../src/binding-ir/package-gate.mjs";

const usage = () => {
	process.stderr.write("usage: binding-package-gate <report|check> <binding-ir.json> [report.json]\n");
	process.exitCode = 2;
};

const main = async () => {
	const [command, bindingPath, reportPath] = process.argv.slice(2);
	if(!new Set(["report", "check"]).has(command) || !bindingPath) return usage();
	const ir = parseBindingIr(await readFile(bindingPath, "utf8"));
	if(command === "report")
	{
		process.stdout.write(`${JSON.stringify(compileGeneratedPackageGate(ir), null, 2)}\n`);
		return;
	}
	if(!reportPath) return usage();
	const expected = JSON.parse(await readFile(reportPath, "utf8"));
	const report = assertGeneratedPackageGate(ir, expected);
	process.stdout.write(`${JSON.stringify({
		component: report.component
		, bindingIrSha256: report.bindingIrSha256
		, packages: report.packages.map(item => ({ backend: item.backend, fileSetSha256: item.fileSetSha256 }))
	}, null, 2)}\n`);
};

main().catch(error => {
  if(error instanceof GeneratedPackageGateError)
{
    process.stderr.write(`${JSON.stringify({ code: error.code, message: error.message, details: error.details }, null, 2)}\n`);
} else
{
    process.stderr.write(`${error.stack ?? error.message}\n`);
}
  process.exitCode = 1;
});
