/**
 * Stage private GMP and compile authenticated owned XS variants for CPAN.
 *
 * @file
 */
import { join } from "node:path";
import { generateOwnedPerlXs } from "../backends/perl/owned-xs.mjs";
import { projectPerlNames } from "../backends/perl/naming.mjs";
import { readVerifiedNativeRuntime, readVerifiedNativeComponent } from "./native-artifacts.mjs";
import { buildNativeGmp } from "./native-gmp.mjs";
import { projectCpanPackages } from "./cpan-projection.mjs";

/**
 * Select the public namespace without adding host names to native Lean metadata.
 *
 * @param component - The source package's canonical component identity.
 * @param settings - Optional CPAN publishing configuration.
 */
export const ownedPerlNamespace = (component, settings = {}) => {
	const name = settings.module ?? `LeanBridge::${component.name.split(/[^A-Za-z0-9]+/u)
		.filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("")}`;
	projectPerlNames(name, []);
	return name;
};

/**
 * Reuse the compiled Lean component and the shared CPAN runtime across Perl ABIs.
 *
 * @param options - Native inputs, CPAN settings and producer toolchain choices.
 */
export const projectOwnedPerl = async options => {
	const { working, runtimeRoot, nativeRoot, settings = {}, environment = process.env, signal } = options;
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true, ownedReceiverExports: true });
	if(!model.ownedGraph) throw new TypeError("Owned Perl requires an authenticated ownership model");
	const moduleName = ownedPerlNamespace(model.component, settings);
	generateOwnedPerlXs(model.bindingIr, moduleName, { transferredInputs: Boolean(model.ownedGraph.inputTransfers), anchoredResults: Boolean(model.ownedGraph.resultAnchors), receiverExports: Boolean(model.ownedGraph.receiverExports), hostCallbacks: Boolean(model.ownedGraph.hostCallbacks) });
	const ownedGmpRoot = join(working, "native/owned-perl-gmp");
	await buildNativeGmp({ root: ownedGmpRoot, environment, signal, privateSoname: true });
	return projectCpanPackages({ ...options, ownedGmpRoot, ownedModuleName: moduleName });
};
