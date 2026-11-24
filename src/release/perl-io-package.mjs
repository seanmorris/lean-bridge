/**
 * Package compiled synchronous IO, tasks or cursors with the shared CPAN runtime.
 *
 * @file
 */
import { projectCpanPackages } from "../build/cpan-projection.mjs";
import { writeNativePackageSet } from "./package-set-assembly.mjs";
import {compilePerlHostComponent} from "../build/perl-host-component.mjs";

/**
 * Compile only the Perl XS per ABI. Both the Lean code and shared runtime were built once.
 *
 * @param o - Checked IO wire, native artifacts, component identity and CPAN settings.
 */
export const writePerlIORelease = async o => {
	const { workRoot, projectContract, leanPrefix, runtimeRoot, runtimeIdentity, bindingIrSha256, api, evidence, environment, signal } = o;
	const projection = await projectCpanPackages({ working: workRoot
		, leanPrefix, runtimeRoot, environment, signal
		, settings: { module: o.name, version: o.version }
		, ...(o.ir ? {hostImports: o} : {syncIO: o}) });
	const model = { component: projectContract.component, bindingIrSha256, sourceIdentity: { sourceTreeSha256: projectContract.sourceTreeSha256 } };
	const receipt = await writeNativePackageSet({ root: workRoot, model, runtimeIdentity, projections: [projection], perlProfile: o.ir ? "native-perl-host-v1" : o.wire.wait ? "native-perl-task-v1" : "native-perl-io-v1", signal });
	return { receipt, api, evidence, runtimeIdentity, bindingIrSha256 };
};

/**
 * Compile the Lean library once and publish local, pinned CPAN distributions.
 *
 * @param options - Compiler-captured host project, runtime and package coordinates.
 */
export const buildPerlHostPackage = async options => writePerlIORelease({...options,...await compilePerlHostComponent(options)});
