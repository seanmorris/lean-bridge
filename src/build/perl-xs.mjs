/**
 * Upstream XS compilation. Archive assembly remains compiler-free.
 *
 * @file
 */
import { readFile, readdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { processBuildRunner } from "./process-runner.mjs";
import { readVerifiedCpanPackage, refreshCpanInventory } from "../release/cpan-package.mjs";
import { validateNativeElf } from "./native-artifacts.mjs";

/**
 * Add an ABI-specific XS binary without recompiling native Lean artifacts.
 *
 * @param root0 - Named inputs for this native build or packaging operation.
 * @param root0.packageRoot - Prepared CPAN distribution directory.
 * @param root0.perl - Perl executable whose Config determines the XS ABI.
 * @param root0.environment - Explicit environment passed to build subprocesses.
 */
export const compileCpanXsVariant = async ({ packageRoot, perl = "perl", environment = process.env }) => {
	const directory = resolve(packageRoot);
	const { manifest } = await readVerifiedCpanPackage(directory);
	const probe = await processBuildRunner.capture({ command: perl
		, args: ["-I.", "-MLeanBridgeBuild", "-e"
			, "print JSON::PP->new->canonical->encode({key => LeanBridgeBuild::abi_key(), abi => LeanBridgeBuild::abi()})"]
		, cwd: directory, env: environment });
	const { key, abi } = JSON.parse(probe.stdout);
	if(manifest.prebuilt.some(item => item.abiKey === key)) throw new Error("duplicate Perl ABI variant");
	await processBuildRunner.capture({ command: perl
		, args: ["-I.", "-MLeanBridgeBuild", "-e"
			, `LeanBridgeBuild::verify(LeanBridgeBuild::read_json('lean-bridge-package.json')); LeanBridgeBuild::compile_xs(LeanBridgeBuild::read_json('lean-bridge-package.json'), 'prebuilt/${key}');`]
		, cwd: directory, env: environment });
	const path = `prebuilt/${key}/${manifest.module.split("::").at(-1)}.so`;
	const io = manifest.syncIO ?? manifest.taskDelivery ?? manifest.hostImports;
	if(io)
	{
		const bytes = await readFile(join(directory,path)); validateNativeElf(bytes);
		const elf = async args => (await processBuildRunner.capture({ command: "readelf", args: [...args,path], cwd: directory, env: environment })).stdout;
		const dynamic = await elf(["-d"]);
		if(io.resourceLedger && !dynamic.includes("Shared library: ["+io.resourceLedger.library+"]"))
			throw new Error("CPAN resource XS does not link its checked ledger");
		if(bytes.includes(Buffer.from(directory)) || !dynamic.includes("Shared library: [" + io.library + "]") || /\((?:RPATH|RUNPATH)\)/u.test(dynamic))
			throw new Error("CPAN IO XS depends on a staging path or does not link its compiled component");
		const maxMinor = Number(manifest.glibcMinimumVersion.split(".")[1]);
		for(const [,major,minor,patch] of (await elf(["--version-info"])).matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
			if(+major > 2 || +major === 2 && (+minor > maxMinor || +minor === maxMinor && Number(patch)>0))
				throw new Error("CPAN IO XS exceeds the declared glibc floor");
	}
	for(const name of await readdir(join(directory, "prebuilt", key))) if(/\.(?:c|o)$/.test(name)) await unlink(join(directory, "prebuilt", key, name));
	const variant = { abiKey: key, abi, path };
	manifest.prebuilt.push(variant); manifest.prebuilt.sort((a, b) => a.abiKey.localeCompare(b.abiKey));
	await refreshCpanInventory(directory, manifest);
	return variant;
};
