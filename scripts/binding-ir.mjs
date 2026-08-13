#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import {
	canonicalizeBindingIr,
	diagnoseBindingIrVersion,
	hashBindingIr,
	parseBindingIr,
} from "../src/binding-ir/canonical.mjs";

const usage = () => {
	process.stderr.write(
		"Usage: node scripts/binding-ir.mjs <validate|canonicalize|hash|diagnose> <file>\n",
	);
};

const [command, file] = process.argv.slice(2);
if(!new Set(["validate", "canonicalize", "hash", "diagnose"]).has(command) || !file)
{
	usage();
	process.exitCode = 2;
} else
{
	try
	{
		const text = await readFile(file, "utf8");
		if(command === "diagnose")
		{
			let value;
			try
			{
				value = JSON.parse(text);
			} catch(cause)
			{
				throw Object.assign(new Error("Binding IR is not valid JSON"), {
					code: "invalid-json"
					, details: { cause: cause.message }
				});
			}
			process.stdout.write(`${JSON.stringify(diagnoseBindingIrVersion(value), null, 2)}\n`);
		} else
		{
			const value = parseBindingIr(text);
			if(command === "validate")
			{
				process.stdout.write(`valid schemaVersion=${value.schemaVersion} component=${value.component.id}\n`);
			} else if(command === "canonicalize")
			{
				process.stdout.write(canonicalizeBindingIr(value));
			} else
			{
				process.stdout.write(`${hashBindingIr(value)}\n`);
			}
		}
	} catch(error)
	{
		process.stderr.write(
			`${JSON.stringify({
				ok: false
				, code: error.code ?? "binding-ir-error"
				, message: error.message
				, details: error.details ?? {}
			})}\n`,
		);
		process.exitCode = 1;
	}
}
