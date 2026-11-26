/** @file Capture an IO project's checked Lake inputs before native or Wasm compilation. */
import { lstat, readFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import {parseBindingIr} from "../binding-ir/canonical.mjs";
import {hostPublicHash, parseHostPublic} from "../analyze/host-records.mjs";
import { inspectLeanProject } from "../analyze/lean-project.mjs";
import { nativeHostSelection } from "../analyze/host-export-model.mjs";
import { compiledHostTargets } from "../backends/lean/host-object.mjs";
import { captureSourceNotices } from "../release/source-notices.mjs";
import { CanonicalBuildError } from "./build-error.mjs";
import { prepareLakeDependencySnapshot, verifyLakeSnapshotSourceTree } from "./lake-dependency-snapshot.mjs";
import { selectLakeEntryModules, verifyLakeEntryModules } from "./lake-entry-modules.mjs";
import { resolveLockedLakeWorkspace } from "./lake-workspace.mjs";
import { pinnedCompiledLean as pinnedNativeLean } from "./elaborated-component.mjs";
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
const captureContracts = async (project, inventory, target) => {
	const config = inventory.configurationRecord.configuration;
	const input = inventory.inputs.find(f => f.path === config.hostImports);
	const hostImportsSource = config.hostImports ? await capturedText(project, input) : null;
	const ir = hostImportsSource === null ? null : parseBindingIr(hostImportsSource);
	const generatedHostModule = ir ? nativeHostSelection(ir, compiledHostTargets[target]).hostModule : null;
	const reviews = inventory.inputs.filter(f => f.path.endsWith(".binding-ir.json"));
	if(reviews.length > 1) fail("Expected at most one reviewed public .binding-ir.json file");
	let review, reviewedExports;
	if(reviews.length)
	{
		const source = await capturedText(project, reviews[0]), api = parseHostPublic(source, Boolean(ir && ["pypi", "rubygems", "php-native"].includes(target)));
		if(api.declarations.some(d => d.kind !== "function" || d.owner !== null || !d.source?.declaration)) fail("Expected reviewed public application functions");
		review = { ...reviews[0], source, semanticSha256: hostPublicHash(api) };
		reviewedExports = api.declarations.map(d => d.source.declaration).sort();
	}
	const taskExports = config.taskExports?.toSorted() ?? [];
	const asyncIterators = [...config.asyncIterators ?? []].sort((a, b) => a.open < b.open ? -1 : 1);
	const iterators = [...config.iterators ?? []].sort((a, b) => a.open < b.open ? -1 : 1);
	const synchronous = !ir && !taskExports.length && !asyncIterators.length;
	const selected = [...taskExports, ...asyncIterators.map(s => s.open), ...iterators.map(s => s.open)];
	if(synchronous && config.nativeEffects === undefined)
		fail("Standalone synchronous IO requires an explicit nativeEffects list; use [] for an in-memory API");
	const exports = config.exports ? [...config.exports].sort() : reviewedExports ?? selected.toSorted();
	if(!exports?.length || new Set(exports).size !== exports.length
		|| selected.some(n => !exports.includes(n))
		|| (review && canonicalJson(exports) !== canonicalJson(reviewedExports)))
		fail("Select application exports by Lean name; reviewed and configured exports must agree");
	return { ir, review, exports, taskExports, asyncIterators, generatedHostModule
		, ...(Object.hasOwn(compiledHostTargets,target) && ir ? {hostImportsSource} : {})
		, ...(synchronous ? { synchronousIO: true } : {})
		, ...(iterators.length ? {iterators} : {})
		, nativeEffects: config.nativeEffects?.toSorted() ?? []
		, ...(config.taskIOErrors ? { taskIOErrors: config.taskIOErrors.toSorted() } : {})
		, leanResources: config.resources?.toSorted() ?? []
		, hostImportsSourceSha256: input?.sha256 ?? null };
};

/**
 * The caller owns the returned workspace until dispose. Recheck its snapshot
 * and original source tree before publishing anything derived from it.
 *
 * @param options - Inspected project, selected component, pinned compiler and optional snapshot.
 */
export const openHostProjectSource = async options => {
	const { project, inventory, component, environment = process.env, signal } = options;
	const record = inventory.configurationRecord, config = record.configuration;
	const contract = await captureContracts(project, inventory, options.targets?.[0]);
	if(inventory.project.toolchain !== "leanprover/lean4:v4.32.2") fail("Host source and runtime require the same pinned Lean toolchain");
	if(!inventory.project.lakefile) fail("Host imports require a Lake package so each module has a checked owner");
	const leanPrefix = resolve(options.leanPrefix ?? environment.LEAN_BRIDGE_LEAN_PREFIX ?? (await processBuildRunner.capture({
		command: "lean", args: ["--print-prefix"], cwd: project
		, env: environment, signal })).stdout.trim());
	const roots = selectLakeEntryModules(config, inventory.inputs);
	let snapshot = options.lakeSnapshot, workspace;
	if(snapshot) await verifyLakeSnapshotSourceTree({ snapshot, projectRoot: project, signal });
	else
		snapshot = await prepareLakeDependencySnapshot({ projectRoot: project, includeProject: true, allowMissingLock: true, signal });
	try
	{
		workspace = await resolveLockedLakeWorkspace({ snapshot, modules: config.modules, leanPrefix, signal, generatedHostModule: contract.generatedHostModule });
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
		const verify = async () => {
			if((await inspectLeanProject(project, { signal })).sourceTreeSha256 !== inventory.sourceTreeSha256) fail("Host project changed during compilation");
			await verifyLakeSnapshotSourceTree({ snapshot, projectRoot: project, signal });
		};
		return { projectContract, sources, snapshot, captured, leanPrefix, verify, dispose: workspace.dispose };
	} catch(error)
	{ await workspace?.dispose(); throw error; }
};
