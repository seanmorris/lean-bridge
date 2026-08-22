#!/usr/bin/env node
/**
 * Runs the complete Lean Bridge toolchain capability preflight.
 *
 * @file
 */

import { collectToolchainPreflight, renderToolchainPreflight, toolchainPreflightProfiles } from "../src/adoption/toolchain-preflight.mjs";

const args = process.argv.slice(2);
let profile = "full";
let json = false;
for(let index = 0; index < args.length; index += 1)
{
	const argument = args[index];
	if(argument === "--json") json = true;
	else if(argument === "--profile")
	{
		profile = args[index + 1] ?? "";
		index += 1;
	} else if(argument === "--help")
	{
		process.stdout.write(`toolchain-preflight [--profile <${toolchainPreflightProfiles.join("|")}>] [--json]\n`);
		process.exit(0);
	} else
	{
		process.stderr.write(`Unknown argument ${argument}\n`);
		process.exit(64);
	}
}

if(!toolchainPreflightProfiles.includes(profile))
{
	process.stderr.write(`Unknown profile ${profile}; expected ${toolchainPreflightProfiles.join(", ")}\n`);
	process.exit(64);
}

const report = await collectToolchainPreflight({ profile });
process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : renderToolchainPreflight(report));
if(!report.accepted) process.exitCode = 127;
