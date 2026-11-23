/**
 * Build an installed host-object or async projection without accepting hand-written entry signatures.
 *
 * @file
 */
import { lstat, mkdir, mkdtemp, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson } from "../capsule/node.mjs";
import { assertExportConfigurationCapabilities } from "../analyze/export-configuration.mjs";
import { elaboratedComponent } from "../analyze/semantic-model.mjs";
import { validateOrdinaryPythonSettings } from "../backends/python/copied-model.mjs";
import { validateOrdinaryCargoSettings } from "../backends/rust/copied-model.mjs";
import { dotnetComponentAssembly, validateOrdinaryNugetSettings } from "../backends/dotnet/copied-model.mjs";
import { defaultRubyVersion, validateOrdinaryRubySettings } from "../backends/ruby/copied-model.mjs";
import { buildPythonHostWheel, packagePythonHostRuntime, writePythonHostPackageSet } from "../release/host-pypi.mjs";
import { buildCTaskPackage } from "../release/c-task-package.mjs";
import { validateNativeCSettings } from "../release/native-c-family.mjs";
import { validateOrdinaryMavenSettings } from "../backends/jvm/copied-model.mjs";
import { validateOrdinaryPhpSettings } from "../backends/php/copied-model.mjs";
import { validatePerlIOSettings } from "../backends/perl/sync-io.mjs";
import { ownedPerlNamespace } from "./owned-perl-projection.mjs";
import { CanonicalBuildError } from "./build-error.mjs";
import { buildNativeSharedRuntime } from "./native-component.mjs";
import { openHostProjectSource } from "./host-project-source.mjs";

const fail = message => { throw new CanonicalBuildError("invalid-host-project", message); };
const absent = async path => {
	try
	{ await lstat(path); }
	catch(error)
	{ if(error.code === "ENOENT") return; throw error; }
	fail(`Output already exists: ${path}`);
};

/**
 * Assemble and validate both archives in private staging, then expose the finished handoff.
 *
 * @param options - Inspected application, selected targets, pinned tools and optional cancellation.
 */
export const buildHostProject = async options => {
	const { inventory, environment, signal, onProgress, targets } = options;
	const record = inventory.configurationRecord, config = record.configuration, target = targets[0];
	if(config.hostImports && (targets.length !== 1 || target !== "pypi")) fail("Python host imports require a pypi-only build");
	if(targets.length !== 1 || !["c", "cpp", "cargo", "pypi", "rubygems", "nuget", "maven", "cpan", "php-native"].includes(target)) fail("Select one native IO target: c, cpp, cargo, pypi, rubygems, nuget, maven, cpan, or php-native");
	const project = await realpath(options.projectRoot);
	const output = resolve(options.outputRoot ?? join(project, "build/lean-bridge-native"));
	if(output === project || project.startsWith(`${output}/`)) fail("Output cannot replace the source package");
	await absent(output);
	assertExportConfigurationCapabilities(config, { target
		, fields: ["modules", "exports", "hostImports", "taskExports", "taskIOErrors", "asyncIterators", "nativeEffects", "package", "resources"]
		, targetFields: target === "cpan" ? ["module", "version"] : ["name", "version"] });
	const component = elaboratedComponent(inventory.project);
	const settings = config.targets?.[target] ?? {}, slug = component.name.toLowerCase().replaceAll("_", "-");
	const name = target === "cpan" ? ownedPerlNamespace(component, settings) : settings.name ?? (target === "php-native" ? "lean-bridge/" + slug : target === "nuget" ? dotnetComponentAssembly(component) : target === "maven" ? "org.leanbridge:" + slug : "lean-" + slug);
	const version = settings.version ?? (target === "cpan" ? "0.001" : target === "rubygems" ? defaultRubyVersion(component.version)
		: target === "pypi" && component.version === "0.0.0-local" ? "0.0.0+local" : component.version);
	(target === "php-native" ? validateOrdinaryPhpSettings : target === "cpan" ? validatePerlIOSettings : target === "pypi" ? validateOrdinaryPythonSettings : target === "cargo" ? validateOrdinaryCargoSettings : target === "rubygems" ? validateOrdinaryRubySettings : target === "nuget" ? validateOrdinaryNugetSettings : target === "maven" ? validateOrdinaryMavenSettings : validateNativeCSettings)({ name, version });
	const source = await openHostProjectSource({ ...options, project, component });
	let stage;
	try
	{
		await mkdir(dirname(output), { recursive: true });
		stage = await mkdtemp(join(dirname(output), ".lean-bridge-host-project-"));
		const { projectContract: contract, sources, leanPrefix } = source;
		const runtimeRoot = join(stage, "runtime"), archives = join(stage, "archives");
		await mkdir(archives);
		onProgress?.({ phase: "build", state: "info", message: `Compiling source and checking ${target} export signatures` });
		await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
		const common = { runtimeRoot
			, leanPrefix
			, workRoot: stage
			, output: archives
			, environment
			, signal
			, projectContract: contract
			, sources
			, ir: contract.ir
			, module: config.modules[0]
			, name
			, version };
		let artifact, receipt;
		if(target !== "pypi")
		{
			artifact = await buildCTaskPackage({ ...common, target }); receipt = artifact.receipt;
		}
		else
		{
			artifact = await buildPythonHostWheel({ ...common, python: environment.LEAN_BRIDGE_PYTHON ?? environment.LEAN_BRIDGE_HOST_PYTHON ?? "python3" });
			const runtime = await packagePythonHostRuntime(common);
			receipt = await writePythonHostPackageSet({ root: stage, runtime, component: artifact, archivePrefix: "archives/" });
		}
		const manifest = { schemaVersion: 1
			, profile: receipt.profiles[0].id
			, component
			, packages: receipt.packages, configurationSha256: record.sha256
			, nativeRuntimeIdentity: artifact.runtimeIdentity
			, bindingIrSha256: artifact.bindingIrSha256
			, ...(contract.review ? { reviewedBindingIrSha256: contract.review.semanticSha256 } : {}) };
		await writeFile(join(stage, "native-release.json"), canonicalJson(manifest));
		await writeFile(join(stage, "binding-ir.json"), canonicalJson(artifact.api));
		await writeFile(join(stage, "host-export-evidence.json"), canonicalJson(artifact.evidence));
		await rm(runtimeRoot, { recursive: true });
		await source.verify();
		signal?.throwIfAborted();
		await absent(output); await rename(stage, output);
		return { ...manifest, project, output, targets };
	} finally
	{
		try
		{ await source.dispose(); }
		finally
		{ if(stage) await rm(stage, { recursive: true, force: true }); }
	}
};
