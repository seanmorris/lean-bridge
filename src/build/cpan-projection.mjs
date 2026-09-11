/**
 * Compile host XS variants and package one already-compiled native component.
 *
 * @file
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { compileCpanXsVariant } from "./perl-xs.mjs";
import { stageCpanPackage, archiveCpanPackage, perlRuntimeVersion } from "../release/cpan-package.mjs";
import { installCpanArchive } from "../release/cpan-install.mjs";

/**
 * Project checked native inputs into the selected Perl ABIs without rebuilding Lean.
 *
 * @param options - Compiled native inputs and host-tool settings.
 * @param options.working - Isolated output staging directory.
 * @param options.runtimeRoot - Already-compiled native runtime.
 * @param options.nativeRoot - Already-compiled component.
 * @param options.leanPrefix - Matching headers used for XS compilation.
 * @param options.settings - Validated CPAN package choices.
 * @param options.environment - Explicit toolchain environment.
 * @param options.signal - Optional abort signal.
 * @param options.onProgress - Build progress observer.
 */
export const projectCpanPackages = async ({
	working, runtimeRoot, nativeRoot, leanPrefix
	, settings = {}, environment = process.env, signal, onProgress
}) => {
	const perls = environment.LEAN_BRIDGE_PERLS ? JSON.parse(environment.LEAN_BRIDGE_PERLS) : ["perl"];
	if(!Array.isArray(perls) || !perls.length || perls.some(perl => typeof perl !== "string" || !perl))
		throw new TypeError("LEAN_BRIDGE_PERLS must be a JSON array of interpreter paths");
	const version = settings.version ?? "0.001", floor = environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38";
	const runtimePackage = join(working, "packages/runtime"), componentPackage = join(working, "packages/component");
	await stageCpanPackage({ outputRoot: runtimePackage, runtimeRoot, leanPrefix, version: perlRuntimeVersion, glibcMinimumVersion: floor });
	await stageCpanPackage({ outputRoot: componentPackage, componentRoot: nativeRoot, runtimeRoot, leanPrefix, version, glibcMinimumVersion: floor });
	const archives = join(working, "archives"), installRoot = join(working, ".build-runtime");
	for(const perl of perls)
	{
		signal?.throwIfAborted();
		onProgress?.({ phase: "build", state: "info", message: `Compiling XS for ${perl}` });
		await compileCpanXsVariant({ packageRoot: runtimePackage, perl, environment });
		const runtimeArchive = await archiveCpanPackage({ packageRoot: runtimePackage, outputRoot: archives });
		const installed = await installCpanArchive({ archive: runtimeArchive.path, workingRoot: working, prefix: installRoot, perl, mode: "prebuilt-only", environment });
		await compileCpanXsVariant({ packageRoot: componentPackage, perl, environment: { ...environment, PERL5LIB: installed.perl5lib } });
	}
	const runtimeArchive = await archiveCpanPackage({ packageRoot: runtimePackage, outputRoot: archives });
	const componentArchive = await archiveCpanPackage({ packageRoot: componentPackage, outputRoot: archives });
	await rm(installRoot, { recursive: true, force: true });
	return {
		ecosystem: "cpan", backend: "perl"
		, runtimeIdentity: runtimeArchive.receipt.runtimeIdentity
		, glibcMinimumVersion: floor
		, packages: [runtimeArchive.receipt, componentArchive.receipt]
	};
};
