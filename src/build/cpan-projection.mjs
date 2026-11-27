/**
 * Compile host XS variants and package one already-compiled native component.
 *
 * @file
 */
import { copyFile, link, mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { compileCpanXsVariant } from "./perl-xs.mjs";
import { stageCpanPackage, archiveCpanPackage, readVerifiedCpanPackage } from "../release/cpan-package.mjs";
import {processBuildRunner} from "./process-runner.mjs";
import { installCpanArchive } from "../release/cpan-install.mjs";

// XS compilation only needs the matching loader, headers and native runtime.
// Configure an isolated prebuilt-only copy (which performs the real load
// check). Only the two immutable SDK libraries share storage with the stage.
// No full runtime installation is left behind by the publisher.
const compileFromRuntimeView = async ({working,runtimePackage,componentPackage,perl,environment,signal}) => {
	const {manifest}=await readVerifiedCpanPackage(runtimePackage);
	const view=await mkdtemp(join(working,".cpan-compiler-runtime-"));
	try
	{
		for(const file of [...Object.keys(manifest.files),"lean-bridge-package.json"])
		{
			const to=join(view,file), from=join(runtimePackage,file);
			await mkdir(dirname(to),{recursive: true});
			if(["lib/LeanBridge/Runtime/native/libleanshared.so","lib/LeanBridge/Runtime/native/liblean_bridge_native.so"].includes(file)) await link(from,to);
			else await copyFile(from,to);
		}
		await processBuildRunner.capture({command: perl,args: ["Makefile.PL"],cwd: view,env: {...environment,LEAN_BRIDGE_PERL_INSTALL_MODE: "prebuilt-only"},signal});
		const PERL5LIB=[join(view,"lib"),environment.PERL5LIB].filter(Boolean).join(":");
		await compileCpanXsVariant({packageRoot: componentPackage,perl,environment: {...environment,PERL5LIB}});
	} finally
	{ await rm(view,{recursive: true,force: true}); }
};

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
 * @param options.ownedGmpRoot - Verified private GMP root for an owned component.
 * @param options.ownedModuleName - Owned package namespace, separate from Lean IR.
 * @param options.syncIO - Compiler-authenticated standalone synchronous Perl projection.
 * @param options.hostImports - Verified synchronous Perl host component.
 */
export const projectCpanPackages = async ({
	working, runtimeRoot, nativeRoot, leanPrefix
	, settings = {}, environment = process.env, signal, onProgress
	, ownedGmpRoot = null
	, ownedModuleName = null
	, syncIO = null
	, hostImports = null
}) => {
	const perls = environment.LEAN_BRIDGE_PERLS ? JSON.parse(environment.LEAN_BRIDGE_PERLS) : ["perl"];
	if(!Array.isArray(perls) || !perls.length || perls.some(perl => typeof perl !== "string" || !perl))
		throw new TypeError("LEAN_BRIDGE_PERLS must be a JSON array of interpreter paths");
	const version = settings.version ?? "0.001", floor = environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38";
	const runtimePackage = join(working, "packages/runtime"), componentPackage = join(working, "packages/component");
	await stageCpanPackage({ outputRoot: runtimePackage, runtimeRoot, leanPrefix, glibcMinimumVersion: floor });
	const archives = join(working, "archives"), installRoot = join(working, ".build-runtime");
	for(const perl of perls)
	{
		signal?.throwIfAborted();
		onProgress?.({ phase: "build", state: "info", message: `Compiling XS for ${perl}` });
		await compileCpanXsVariant({ packageRoot: runtimePackage, perl, environment });
	}
	const runtimeArchive = await archiveCpanPackage({ packageRoot: runtimePackage, outputRoot: archives });
	await stageCpanPackage({ outputRoot: componentPackage
		, componentRoot: nativeRoot
		, runtimePackageRoot: runtimePackage, runtimeRoot, leanPrefix, version
		, glibcMinimumVersion: floor
		, ownedGmpRoot
		, ownedModuleName
		, syncIO
		, hostImports });
	const useView = Boolean(ownedModuleName || hostImports || syncIO?.wire?.methods.some(m => m.delivery === "iterator"));
	for(const perl of perls)
	{
		signal?.throwIfAborted();
		if(useView)
		{
			await compileFromRuntimeView({working,runtimePackage,componentPackage,perl,environment,signal});
			continue;
		}
		const installed = await installCpanArchive({ archive: runtimeArchive.path, workingRoot: working, prefix: installRoot, perl, mode: "prebuilt-only", environment });
		await compileCpanXsVariant({ packageRoot: componentPackage, perl, environment: { ...environment, PERL5LIB: installed.perl5lib } });
	}
	const componentArchive = await archiveCpanPackage({ packageRoot: componentPackage, outputRoot: archives });
	if(!useView) await rm(installRoot, { recursive: true, force: true });
	return {
		ecosystem: "cpan", backend: "perl"
		, runtimeIdentity: runtimeArchive.receipt.runtimeIdentity
		, glibcMinimumVersion: floor
		, packages: [runtimeArchive.receipt, componentArchive.receipt]
	};
};
