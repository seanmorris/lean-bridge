/**
 * Entry point for the pinned native Perl build environment.
 *
 * @file
 */
import { buildPerlProject } from "../src/build/perl-project.mjs";
const flags = new Map();
for(let i = 2; i < process.argv.length; i += 2)
{
	if(!["--project", "--output"].includes(process.argv[i]) || !process.argv[i + 1] || flags.has(process.argv[i])) throw new Error("Usage: lean-bridge-perl-engine --project SOURCE --output NEW_DIRECTORY");
	flags.set(process.argv[i], process.argv[i + 1]);
}
if(!flags.has("--project") || !flags.has("--output")) throw new Error("project and output are required");
console.log(JSON.stringify(await buildPerlProject({ projectRoot: flags.get("--project")
	, outputRoot: flags.get("--output")
	, onProgress: event => process.stderr.write(`${event.message}\n`) })));
