/**
 * Build an installed host-object or async projection without accepting hand-written entry signatures.
 *
 * @file
 */
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { hashBindingIr, parseBindingIr } from "../binding-ir/canonical.mjs";
import { assertExportConfigurationCapabilities } from "../analyze/export-configuration.mjs";
import { inspectLeanProject } from "../analyze/lean-project.mjs";
import { elaboratedComponent } from "../analyze/semantic-model.mjs";
import { validateOrdinaryPythonSettings } from "../backends/python/copied-model.mjs";
import { validateOrdinaryCargoSettings } from "../backends/rust/copied-model.mjs";
import { dotnetComponentAssembly, validateOrdinaryNugetSettings } from "../backends/dotnet/copied-model.mjs";
import { defaultRubyVersion, validateOrdinaryRubySettings } from "../backends/ruby/copied-model.mjs";
import { captureSourceNotices } from "../release/source-notices.mjs";
import { buildPythonHostWheel, packagePythonHostRuntime, writePythonHostPackageSet } from "../release/host-pypi.mjs";
import { buildCTaskPackage } from "../release/c-task-package.mjs";
import { validateNativeCSettings } from "../release/native-c-family.mjs";
import { validateOrdinaryMavenSettings } from "../backends/jvm/copied-model.mjs";
import { CanonicalBuildError } from "./build-error.mjs";
import { prepareLakeDependencySnapshot, verifyLakeSnapshotSourceTree } from "./lake-dependency-snapshot.mjs";
import { selectLakeEntryModules, verifyLakeEntryModules } from "./lake-entry-modules.mjs";
import { resolveLockedLakeWorkspace } from "./lake-workspace.mjs";
import { buildNativeSharedRuntime, pinnedNativeLean } from "./native-component.mjs";
import { processBuildRunner } from "./process-runner.mjs";

const fail = message => { throw new CanonicalBuildError("invalid-host-project", message); };
const capturedText = async (root, record, path = record?.path) => {
	if(!record || !path) fail("Host project is missing a captured source input");
	const file = join(root, path);
	if(!(await lstat(file)).isFile() || await realpath(file) !== file) fail(`Expected regular source: ${path}`);
	const bytes = await readFile(file);
	if(bytes.length !== record.bytes || sha256(bytes) !== record.sha256) fail(`Host project input changed: ${path}`);
	return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
};
const absent = async path => {
	try
	{ await lstat(path); }
	catch(error)
	{ if(error.code === "ENOENT") return; throw error; }
	fail(`Output already exists: ${path}`);
};
const captureContracts = async (project, inventory) => {
	const config = inventory.configurationRecord.configuration;
	const input = inventory.inputs.find(f => f.path === config.hostImports);
	const ir = config.hostImports ? parseBindingIr(await capturedText(project, input)) : null;
	const ids = new Set(ir?.types.filter(t => t.kind === "resource" && t.host?.targets.includes("python")).map(t => t.id));
	if(ir && (!ids.size || ids.size !== ir.types.length || ir.declarations.some(d => !ids.has(d.owner))))
		fail("The host import contract must contain only Python host resources and their members; application exports belong in the public API");
	const reviews = inventory.inputs.filter(f => f.path.endsWith(".binding-ir.json"));
	if(reviews.length > 1) fail("Expected at most one reviewed public .binding-ir.json file");
	let review, reviewedExports;
	if(reviews.length)
	{
		const source = await capturedText(project, reviews[0]), api = parseBindingIr(source);
		if(api.declarations.some(d => d.kind !== "function" || d.owner !== null || !d.source?.declaration)) fail("Expected reviewed public application functions");
		review = { ...reviews[0], source, semanticSha256: hashBindingIr(api) };
		reviewedExports = api.declarations.map(d => d.source.declaration).sort();
	}
	const taskExports = config.taskExports?.toSorted() ?? [];
	const asyncIterators = [...config.asyncIterators ?? []].sort((a, b) => a.open < b.open ? -1 : 1);
	const selected = [...taskExports, ...asyncIterators.map(s => s.open)];
	if(!ir && !selected.length && config.nativeEffects === undefined)
		fail("Standalone synchronous IO requires an explicit nativeEffects list; use [] for an in-memory API");
	const exports = config.exports ? [...config.exports].sort() : reviewedExports ?? selected.toSorted();
	if(!exports?.length || new Set(exports).size !== exports.length
		|| selected.some(n => !exports.includes(n))
		|| (review && canonicalJson(exports) !== canonicalJson(reviewedExports)))
		fail("Select application exports by Lean name; reviewed and configured exports must agree");
	return { ir, review, exports, taskExports, asyncIterators
		, ...(!ir && !selected.length ? { synchronousIO: true } : {})
		, nativeEffects: config.nativeEffects?.toSorted() ?? []
		, ...(config.taskIOErrors ? { taskIOErrors: config.taskIOErrors.toSorted() } : {})
		, leanResources: config.resources?.toSorted() ?? []
		, hostImportsSourceSha256: input?.sha256 ?? null };
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
	if(targets.length !== 1 || !["c", "cpp", "cargo", "pypi", "rubygems", "nuget", "maven"].includes(target)) fail("Select one native IO target: c, cpp, cargo, pypi, rubygems, nuget, or maven");
	if(target === "maven" && (config.hostImports || config.resources))
		fail("JVM IO and task delivery require copied values; resources and host imports need their own delivery profiles");
	const project = await realpath(options.projectRoot);
	const output = resolve(options.outputRoot ?? join(project, "build/lean-bridge-native"));
	if(output === project || project.startsWith(`${output}/`)) fail("Output cannot replace the source package");
	await absent(output);
	assertExportConfigurationCapabilities(config, { target
		, fields: ["modules", "exports", "hostImports", "taskExports", "taskIOErrors", "asyncIterators", "nativeEffects", "package", "resources"]
		, targetFields: ["name", "version"] });
	const component = elaboratedComponent(inventory.project);
	const settings = config.targets?.[target] ?? {}, slug = component.name.toLowerCase().replaceAll("_", "-");
	const name = settings.name ?? (target === "nuget" ? dotnetComponentAssembly(component) : target === "maven" ? "org.leanbridge:" + slug : "lean-" + slug);
	const version = settings.version ?? (target === "rubygems" ? defaultRubyVersion(component.version)
		: target === "pypi" && component.version === "0.0.0-local" ? "0.0.0+local" : component.version);
	(target === "pypi" ? validateOrdinaryPythonSettings : target === "cargo" ? validateOrdinaryCargoSettings : target === "rubygems" ? validateOrdinaryRubySettings : target === "nuget" ? validateOrdinaryNugetSettings : target === "maven" ? validateOrdinaryMavenSettings : validateNativeCSettings)({ name, version });
	const contract = await captureContracts(project, inventory);
	if(inventory.project.toolchain !== "leanprover/lean4:v4.32.2") fail("Host source and runtime require the same pinned Lean toolchain");
	if(!inventory.project.lakefile) fail("Host imports require a Lake package so each module has a checked owner");
	const leanPrefix = resolve(environment.LEAN_BRIDGE_LEAN_PREFIX ?? (await processBuildRunner.capture({
		command: "lean"
		, args: ["--print-prefix"]
		, cwd: project
		, env: environment
		, signal })).stdout.trim());
	const roots = selectLakeEntryModules(config, inventory.inputs);
	let snapshot = options.lakeSnapshot, workspace;
	if(snapshot) await verifyLakeSnapshotSourceTree({ snapshot, projectRoot: project, signal });
	else
		snapshot = await prepareLakeDependencySnapshot({ projectRoot: project, includeProject: true, allowMissingLock: true, signal });
	await mkdir(dirname(output), { recursive: true });
	const stage = await mkdtemp(join(dirname(output), ".lean-bridge-host-project-"));
	try
	{
		workspace = await resolveLockedLakeWorkspace({ snapshot, modules: config.modules, leanPrefix, signal, generatedPythonHost: Boolean(contract.ir) });
		if(workspace.document.leanCommit !== pinnedNativeLean || workspace.document.modules.some(m => m.nativeInputs?.length))
			fail("Host modules require the pinned Lean compiler and cannot import additional native objects");
		verifyLakeEntryModules(roots, workspace.document);
		const sources = [];
		for(const m of workspace.document.modules)
		{
			const source = await capturedText(workspace.sourceRoot, m.source, `${m.module.replaceAll(".", "/")}.lean`);
			sources.push({ module: m.module, source });
		}
		const captured = await captureSourceNotices({ projectRoot: project
			, projectName: component.name
			, inputs: inventory.inputs
			, sourceTreeSha256: inventory.sourceTreeSha256
			, snapshot
			, snapshotRoot: workspace.snapshotRoot });
		const notices = {};
		for(const [index, pkg] of captured.document.packages.entries())
			for(const n of pkg.notices) notices[`source/${index}/${n.path}`] = captured.files.get(n.payload);
		const projectContract = { ...contract, component
			, modules: config.modules
			, metadata: config.package
			, notices
			, sourceTreeSha256: inventory.sourceTreeSha256
			, configurationSha256: record.sha256
			, lake: { snapshotSha256: snapshot.sha256, resolutionSha256: workspace.sha256, resolution: workspace.document } };
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
			, projectContract
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
		if((await inspectLeanProject(project, { signal })).sourceTreeSha256 !== inventory.sourceTreeSha256) fail("Host project changed during compilation");
		await verifyLakeSnapshotSourceTree({ snapshot, projectRoot: project, signal });
		signal?.throwIfAborted();
		await absent(output); await rename(stage, output);
		return { ...manifest, project, output, targets };
	} finally
	{
		await workspace?.dispose();
		await rm(stage, { recursive: true, force: true });
	}
};
