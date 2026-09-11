/**
 * Upstream XS compilation. Archive assembly remains compiler-free.
 *
 * @file
 */
import { readFile, readdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { processBuildRunner } from "./process-runner.mjs";
import { refreshCpanInventory } from "../release/cpan-package.mjs";

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
	const probe = await processBuildRunner.capture({ command: perl
		, args: ["-I.", "-MLeanBridgeBuild", "-e"
			, "print JSON::PP->new->canonical->encode({key => LeanBridgeBuild::abi_key(), abi => LeanBridgeBuild::abi()})"]
		, cwd: directory, env: environment });
	const { key, abi } = JSON.parse(probe.stdout);
	const manifest = JSON.parse(await readFile(join(directory, "lean-bridge-package.json"), "utf8"));
	if(manifest.prebuilt.some(item => item.abiKey === key)) throw new Error("duplicate Perl ABI variant");
	await processBuildRunner.capture({ command: perl
		, args: ["-I.", "-MLeanBridgeBuild", "-e"
			, `LeanBridgeBuild::verify(LeanBridgeBuild::read_json('lean-bridge-package.json')); LeanBridgeBuild::compile_xs(LeanBridgeBuild::read_json('lean-bridge-package.json'), 'prebuilt/${key}');`]
		, cwd: directory, env: environment });
	const path = `prebuilt/${key}/${manifest.module.split("::").at(-1)}.so`;
	for(const name of await readdir(join(directory, "prebuilt", key))) if(/\.(?:c|o)$/.test(name)) await unlink(join(directory, "prebuilt", key, name));
	const variant = { abiKey: key, abi, path };
	manifest.prebuilt.push(variant); manifest.prebuilt.sort((a, b) => a.abiKey.localeCompare(b.abiKey));
	await refreshCpanInventory(directory, manifest);
	return variant;
};
