/**
 * Stage private GMP and compile authenticated owned XS variants for CPAN.
 *
 * @file
 */
import { join } from "node:path";
import { generateOwnedPerlXs } from "../backends/perl/owned-xs.mjs";
import { readVerifiedNativeRuntime, readVerifiedNativeComponent } from "./native-artifacts.mjs";
import { buildNativeGmp } from "./native-gmp.mjs";
import { projectCpanPackages } from "./cpan-projection.mjs";

/**
 * Reuse the compiled Lean component and the shared CPAN runtime across Perl ABIs.
 *
 * @param options - Native inputs, CPAN settings and producer toolchain choices.
 */
export const projectOwnedPerl = async options => {
	const { working, runtimeRoot, nativeRoot, settings = {}, environment = process.env, signal } = options;
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true });
	if(!model.ownedGraph?.hostCallbacks) throw new TypeError("Owned Perl requires authenticated callback/copy support");
	const moduleName = settings.module ?? `LeanBridge::${model.component.name.split(/[^A-Za-z0-9]+/u)
		.filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("")}`;
	generateOwnedPerlXs(model.bindingIr, moduleName);
	const ownedGmpRoot = join(working, "native/owned-perl-gmp");
	await buildNativeGmp({ root: ownedGmpRoot, environment, signal, privateSoname: true });
	return projectCpanPackages({ ...options, ownedGmpRoot, ownedModuleName: moduleName });
};
