/**
 * Build shared native inputs once before invoking host-package projections.
 *
 * @file
 */
import { mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { buildNativeComponent, buildNativeSharedRuntime } from "./native-component.mjs";
import { projectCpanPackages } from "./cpan-projection.mjs";
import { canonicalJson } from "../capsule/node.mjs";
import { assertExportConfigurationCapabilities, readExportConfiguration } from "../analyze/export-configuration.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { CanonicalBuildError } from "./build-error.mjs";
import { inspectLeanProject } from "../analyze/lean-project.mjs";
import { readReviewedSource } from "../analyze/reviewed-source.mjs";
import { compilePrimitiveCSurface } from "../backends/c/primitive-surface.mjs";
import { compilePrimitiveCppModel } from "../backends/cpp/primitives.mjs";
import { validateGmpSurface } from "../backends/c/gmp-projection.mjs";
import { projectNativeCFamily } from "./native-c-projection.mjs";
import { validateNativeCSettings } from "../release/native-c-family.mjs";
import { compileCopiedDotnetModel, validateOrdinaryNugetSettings } from "../backends/dotnet/copied-model.mjs";
import { compileCopiedJvmModel, validateOrdinaryMavenSettings } from "../backends/jvm/copied-model.mjs";
import { compileCopiedRubyModel, validateOrdinaryRubySettings } from "../backends/ruby/copied-model.mjs";
import { compileCopiedWitModel, validateOrdinaryWasiSettings } from "../backends/wit/copied-model.mjs";
import { compileCopiedPythonModel, validateOrdinaryPythonSettings } from "../backends/python/copied-model.mjs";
import { compileCopiedRustModel, validateOrdinaryCargoSettings } from "../backends/rust/copied-model.mjs";
import { compileCopiedPhpModel, validateOrdinaryPhpSettings } from "../backends/php/copied-model.mjs";
import { validatePerlModel } from "../backends/perl/generate.mjs";
import { writeNativePackageSet } from "../release/package-set-assembly.mjs";

/**
 * Build Lean once, compile XS per Perl ABI, then archive the checked inputs.
 *
 * @param root0 - Named inputs for this native build or packaging operation.
 * @param root0.projectRoot - Ordinary Lean project root to compile without modifying source.
 * @param root0.outputRoot - New output directory; existing output must not be overwritten.
 * @param root0.environment - Explicit environment passed to build subprocesses.
 * @param root0.targets - Native package targets supported by the installed projections.
 * @param root0.signal - Optional cancellation signal for child build processes.
 * @param root0.onProgress - Optional callback receiving build progress messages.
 * @param root0.lakeSnapshot - Shared immutable capture for a multi-profile build.
 */
export async function buildNativeProject({ projectRoot, outputRoot, environment = process.env, targets = ["cpan"], signal, onProgress, lakeSnapshot })
{
	if(!Array.isArray(targets) || !targets.length || new Set(targets).size !== targets.length || targets.some(target => !["cpan", "c", "cpp", "nuget", "maven", "rubygems", "wit-wasi", "pypi", "cargo", "php-native"].includes(target)))
		throw new CanonicalBuildError("unsupported-native-targets", "Ordinary native builds support c, cpp, nuget, maven, rubygems, wit-wasi, pypi, cargo, php-native, and cpan targets");
	try
	{ await readReviewedSource(projectRoot, await inspectLeanProject(projectRoot, { signal }), signal); }
	catch(error)
	{ throw new CanonicalBuildError(error.code ?? "native-project-build-failed", error.message, { details: error.details }); }
	const record = await readExportConfiguration(projectRoot, { signal });
	const config = record.configuration;
	for(const target of targets)
	{
		assertExportConfigurationCapabilities(config, { target, fields: ["package", "modules", "exports", "resources", "arities", "specializations", "contracts", "generators"], targetFields: target === "cpan" ? ["module", "version"] : ["name", "version"] });
		if(target === "nuget") validateOrdinaryNugetSettings(config.targets?.[target]);
		else if(target === "maven") validateOrdinaryMavenSettings(config.targets?.[target]);
		else if(target === "rubygems") validateOrdinaryRubySettings(config.targets?.[target]);
		else if(target === "wit-wasi") validateOrdinaryWasiSettings(config.targets?.[target]);
		else if(target === "pypi") validateOrdinaryPythonSettings(config.targets?.[target]);
		else if(target === "cargo") validateOrdinaryCargoSettings(config.targets?.[target]);
		else if(target === "php-native") validateOrdinaryPhpSettings(config.targets?.[target]);
		else if(target !== "cpan") validateNativeCSettings(config.targets?.[target]);
	}
	const cTargets = targets.filter(target => target !== "cpan");
	const project = resolve(projectRoot), output = resolve(outputRoot ?? join(project, targets.length === 1 && targets[0] === "cpan" ? "build/lean-bridge-perl" : "build/lean-bridge-native"));
	if(output === project || project.startsWith(`${output}/`)) throw new CanonicalBuildError("invalid-output-root", "Native output cannot replace the source project");
	try
	{ await readdir(output); throw new Error(`output already exists: ${output}`); }
	catch(error)
	{ if(error.code !== "ENOENT") throw error; }
	await mkdir(dirname(output), { recursive: true });
	const working = await mkdtemp(join(dirname(output), ".lean-bridge-native-project-"));
	try
	{
		const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX ?? (await processBuildRunner.capture({ command: "lean", args: ["--print-prefix"], cwd: project, env: environment, signal })).stdout.trim();
		const runtimeRoot = join(working, "native/runtime"), nativeRoot = join(working, "native/component");
		onProgress?.({ phase: "build", state: "info", message: "Compiling checked native Lean exports" });
		await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
		const built = await buildNativeComponent({ projectRoot: project
			, outputRoot: nativeRoot
			, runtimeRoot
			, leanPrefix
			, configurationSha256: record.sha256
			, lakeSnapshot
			, targets
			, validateModel: model => {
				if(targets.includes("cpan")) validatePerlModel(model);
				if(!cTargets.length) return;
				const cSurface = compilePrimitiveCSurface(model.bindingIr, { variants: cTargets.every(target => ["c", "cpp", "pypi", "cargo", "nuget"].includes(target)), lists: cTargets.every(target => ["c", "cpp", "pypi", "cargo", "nuget", "maven", "rubygems", "php-native", "wit-wasi"].includes(target)), compounds: cTargets.every(target => ["c", "cpp", "pypi", "cargo", "nuget", "maven", "rubygems", "php-native", "wit-wasi"].includes(target)), callables: cTargets.every(target => ["c", "cpp", "pypi", "rubygems", "cargo", "nuget", "maven", "php-native", "wit-wasi"].includes(target)) });
				if(targets.includes("c")) validateGmpSurface(cSurface);
				if(targets.includes("cpp")) compilePrimitiveCppModel(model.bindingIr);
				if(targets.includes("nuget")) compileCopiedDotnetModel(model.bindingIr);
				if(targets.includes("maven")) compileCopiedJvmModel(model.bindingIr);
				if(targets.includes("rubygems")) compileCopiedRubyModel(model.bindingIr);
				if(targets.includes("wit-wasi")) compileCopiedWitModel(model.bindingIr, config.targets?.["wit-wasi"], { callables: true });
				if(targets.includes("pypi")) compileCopiedPythonModel(model.bindingIr);
				if(targets.includes("cargo")) compileCopiedRustModel(model.bindingIr);
				if(targets.includes("php-native")) compileCopiedPhpModel(model.bindingIr, { lists: true });
			}
			, signal });
		const projections = cTargets.length ? await projectNativeCFamily({
			working, nativeRoot, runtimeRoot, leanPrefix
			, targets: cTargets, settings: config.targets
			, environment, signal }) : [];
		if(targets.includes("cpan")) projections.push(await projectCpanPackages({
			working, runtimeRoot, nativeRoot, leanPrefix
			, settings: config.targets?.cpan
			, environment, signal, onProgress }));
		const manifest = { schemaVersion: 1
			, profile: "native-library-v1"
			, ...(projections.length === 1 ? projections[0] : { projections, packages: projections.flatMap(projection => projection.packages) })
			, component: built.model.component
			, nativeRuntimeIdentity: built.receipt.runtimeIdentity
			, bindingIrSha256: built.model.bindingIrSha256
			, ...(built.model.sourceIdentity.reviewedBindingIr ? { reviewedBindingIrSha256: built.model.sourceIdentity.reviewedBindingIr.semanticSha256 } : {})
			, configurationSha256: record.sha256 };
		await writeFile(join(working, "native-release.json"), canonicalJson(manifest));
		await writeNativePackageSet({ root: working, model: built.model, runtimeIdentity: built.receipt.runtimeIdentity, projections, signal });
		signal?.throwIfAborted();
		await rename(working, output);
		return { schemaVersion: 1, project, output, targets, ...manifest };
	} catch(error)
	{
		await rm(working, { recursive: true, force: true });
		if(error instanceof CanonicalBuildError) throw error;
		throw new CanonicalBuildError(error.code ?? "native-project-build-failed", error.message, { details: error.details });
	}
}
