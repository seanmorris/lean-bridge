/**
 * Verify the narrow generated-XS exception without allowing native Lean rebuilds.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../capsule/node.mjs";

/**
 * Trace installed payload and XS to an exact prepared distribution.
 *
 * @param options - Prepared and installed package locations.
 * @param options.packageRoot - Original verified distribution directory.
 * @param options.installRoot - Architecture-specific installed Perl library root.
 */
export async function traceCpanInstall({ packageRoot, installRoot })
{
	const manifest = JSON.parse(await readFile(join(packageRoot, "lean-bridge-package.json"), "utf8"));
	if(!/^LeanBridge(?:::[A-Za-z][A-Za-z0-9_]*)+$/.test(manifest.module)) throw new Error("invalid installed CPAN module");
	const relative = manifest.module.replaceAll("::", "/"), stem = manifest.module.split("::").at(-1);
	const receipt = JSON.parse(await readFile(join(installRoot, relative, "install-receipt.json"), "utf8"));
	const sources = [];
	for(const [path, hash] of Object.entries(manifest.files))
	{
		if(!path.startsWith("lib/")) continue;
		if(path.split("/").some(part => !part || part === "." || part === "..")) throw new Error("invalid installed CPAN path");
		const installed = path.slice(4);
		if(sha256(await readFile(join(installRoot, installed))) !== hash) throw new Error(`untraceable installed native payload: ${installed}`);
		sources.push({ path: installed, sha256: hash, origin: "prepared-payload" });
	}
	const xs = `auto/${relative}/${stem}.so`;
	if(sha256(await readFile(join(installRoot, xs))) !== receipt.outputSha256) throw new Error("installed XS differs from its receipt");
	if(receipt.operation === "prebuilt-xs")
	{
		if(!manifest.prebuilt.some(item => manifest.files[item.path] === receipt.outputSha256)) throw new Error("installed prebuilt XS has no canonical source");
	} else if(receipt.operation === "generated-xs-only")
	{
		if(receipt.sourceSha256 !== manifest.files[manifest.xs] || receipt.runtimeIdentity !== manifest.runtimeIdentity
      || !/^[a-f0-9]{64}$/.test(receipt.generatedCSha256) || !Array.isArray(receipt.commands) || receipt.commands.length !== 2) throw new Error("invalid derived XS receipt");
		const [compile, link] = receipt.commands;
		if(![compile, link].every(command => Array.isArray(command) && command.every(argument => typeof argument === "string"))) throw new Error("invalid XS command receipt");
		const compiled = compile.filter(argument => /\.c$/.test(argument));
		if(compiled.length !== 1 || compiled[0] !== `_xs-build/${stem}.c` || !compile.includes("-c")
      || !link.includes(`_xs-build/${stem}.o`) || !link.includes(`_xs-build/${stem}.so`)
      || [compile[0], link[0]].some(command => /(?:^|\/)(?:lean|lake|node|emcc)$/.test(command))) throw new Error("receipt exceeds the generated XS derivation policy");
	} else throw new Error("unsupported installed XS derivation");
	return { schemaVersion: 1
		, ecosystem: "cpan"
		, operation: receipt.operation
		, runtimeIdentity: manifest.runtimeIdentity
		, nativePayloadUnchanged: true
		, files: [...sources, { path: xs, sha256: receipt.outputSha256, origin: receipt.operation }] };
}
