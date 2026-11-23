/** @file Produce and verify source-locked synchronous IO components for PHP-Wasm packaging. */
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { hashBindingIr, parseBindingIr } from "../binding-ir/canonical.mjs";
import { assertExportConfigurationCapabilities } from "../analyze/export-configuration.mjs";
import { inspectLeanProject } from "../analyze/lean-project.mjs";
import { elaboratedComponent } from "../analyze/semantic-model.mjs";
import { verifyPackageMetadataSource } from "../analyze/package-metadata.mjs";
import { readVerifiedSourceNotices } from "../release/source-notices.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { selectLakeEntryModules, verifyLakeEntryModules } from "./lake-entry-modules.mjs";
import { validateLockedLakeResolution } from "./lake-workspace.mjs";
import { openHostProjectSource } from "./host-project-source.mjs";
import { phpWasmCopiedPins } from "./php-wasm-copied-artifacts.mjs";
import { compilePhpWasmIOCore } from "./php-wasm-io-core.mjs";
import { readPhpWasmIOPayload, writePhpWasmIOPayload } from "./php-wasm-io-replay.mjs";

const profile = "php-wasm-sync-io-v1";
const same = (a,b) => canonicalJson(a) === canonicalJson(b);
const fail = message => { throw new Error("PHP-Wasm IO: " + message); };
const coordinates = (component, config) => ({
	name: config.targets?.["php-wasm"]?.composer?.name ?? `lean-bridge/${component.name.replaceAll("_","-")}-php-wasm`
	, version: config.targets?.["php-wasm"]?.composer?.version ?? (component.version === "0.0.0-local" ? "0.0.0" : component.version)
});

/**
 * Refuse unavailable capabilities before opening a toolchain or staging a package.
 *
 * @param config - Actual selected project configuration.
 */
export const assertPhpWasmIOConfiguration = config => {
	assertExportConfigurationCapabilities(config, { target: "php-wasm"
		, fields: ["package", "modules", "exports", "nativeEffects"]
		, targetFields: ["npm", "composer"] });
	if(!Array.isArray(config.nativeEffects) || config.nativeEffects.length)
		fail("this profile supports only in-memory synchronous IO (nativeEffects: [])");
};

/**
 * Reconcile the binding, source dependencies, package declaration and notices
 * from the archived component. Do not infer a source identity from filenames.
 *
 * @param root - Component root inside the producer or installed package.
 * @param runtimeIdentity - Independently checked runtime digest.
 */
export const readPhpWasmIOProjectComponent = async (root, runtimeIdentity) => {
	const artifacts = JSON.parse(await readFile(join(root,"artifacts.json"),"utf8"));
	if(!same(Object.keys(artifacts).sort(),["io","profile","review","schemaVersion","snapshot","sourceNoticesSha256"])
		|| artifacts.profile !== profile || artifacts.schemaVersion !== 1 || artifacts.io?.runtimeIdentity !== runtimeIdentity)
		fail("invalid project receipt or runtime mismatch");
	const payload = await readPhpWasmIOPayload(join(root,"io"), artifacts.io);
	const { evidence, api } = payload, { lake, selection } = evidence;
	const snapshot = { sha256: lake?.snapshotSha256, document: artifacts.snapshot };
	const resolution = lake?.resolution;
	if(!resolution || resolution.leanCommit !== phpWasmCopiedPins.leanCommit || resolution.leanCompilerSha256 !== evidence.compilerSha256
		|| sha256(canonicalJson(resolution)) !== lake.resolutionSha256) fail("compiler or resolved source identity differs");
	validateLockedLakeResolution({ snapshot, resolution, modules: selection.exportModules });
	const modules = resolution.modules;
	if(!same(modules.map(m => m.module).sort(), evidence.interfaces.map(i => i.module).sort())
		|| modules.some(m => m.nativeInputs?.length || evidence.interfaces.find(i => i.module === m.module)?.sourceSha256 !== m.source.sha256)) fail("compiled modules differ from Lake sources");
	const sourceIdentity = { sourceTreeSha256: evidence.sourceTreeSha256
		, sourceNoticesSha256: artifacts.sourceNoticesSha256
		, exportConfigurationSha256: evidence.configurationSha256
		, lakeDependencies: { snapshot: snapshot.document, snapshotSha256: snapshot.sha256 }
		, leanVersion: resolution.leanVersion, leanCommit: resolution.leanCommit
		, leanCompilerSha256: evidence.compilerSha256 };
	const notices = await readVerifiedSourceNotices(root, sourceIdentity);
	const pkg = notices.document.packages[0], inputs = pkg.source.inputs;
	const byPath = new Map(snapshot.document.rootInputs.map(f => [f.path,f]));
	if(pkg.name !== api.component.name || inputs.some(f => byPath.get(f.path)?.sha256 !== f.sha256 || byPath.get(f.path).bytes !== f.bytes))
		fail("source notice inputs differ from the project");
	sourceIdentity.exportConfigurationSource = pkg.configurationSource;
	verifyPackageMetadataSource(sourceIdentity, inputs);
	const config = JSON.parse(pkg.configurationSource);
	assertPhpWasmIOConfiguration(config);
	verifyLakeEntryModules(selectLakeEntryModules(config, inputs), resolution);
	if(!same(config.modules,selection.exportModules)) fail("configured modules differ from the checked selection");
	const reviewed = inputs.filter(f => f.path.endsWith(".binding-ir.json"));
	if(reviewed.length)
	{
		const r = reviewed[0], source = artifacts.review;
		if(reviewed.length !== 1 || typeof source !== "string" || Buffer.byteLength(source) !== r.bytes || sha256(source) !== r.sha256
			|| evidence.reviewedSourceSha256 !== r.sha256 || hashBindingIr(parseBindingIr(source)) !== artifacts.io.bindingIrSha256) fail("reviewed API differs from the source capture");
		sourceIdentity.reviewedBindingIr = { schemaVersion: 1, path: r.path, source, sourceSha256: r.sha256, semanticSha256: artifacts.io.bindingIrSha256 };
	} else if(artifacts.review !== null || evidence.reviewedSourceSha256 !== null) fail("unrecorded reviewed API");
	const selected = config.exports ?? (reviewed.length && api.declarations.map(d => d.source.declaration));
	if(!Array.isArray(selected) || !same(selected.toSorted(),selection.exports)) fail("configured exports differ from the checked selection");
	const expected = coordinates(api.component,config);
	if(expected.name !== artifacts.io.name || expected.version !== artifacts.io.version) fail("Composer coordinates differ from captured configuration");
	const actual = await nativeArtifactPaths(root), io = await nativeArtifactPaths(join(root,"io"));
	if(!same(actual, ["artifacts.json",...notices.files.keys(),...io.map(p => "io/"+p)].sort())) fail("unexpected project payload");
	const receipt = { ...artifacts.io, library: "io/"+artifacts.io.library, sourceIdentity };
	const model = { component: api.component, bindingIr: api
		, bindingIrSha256: receipt.bindingIrSha256, sourceIdentity
		, io: payload.model };
	return { receipt, model };
};

/**
 * Compile an actual source project in private staging; no caller supplies declarations.
 *
 * @param options - Source project, pinned tools/runtime, output root and optional snapshot.
 */
export const buildPhpWasmIOProjectComponent = async options => {
	const { outputRoot: root, leanPrefix, signal } = options;
	const project = await realpath(options.projectRoot);
	const inventory = await inspectLeanProject(project,{signal}), record = inventory.configurationRecord;
	if(record.sha256 !== options.configurationSha256) fail("configuration changed before compilation");
	assertPhpWasmIOConfiguration(record.configuration);
	const component = elaboratedComponent(inventory.project);
	const source = await openHostProjectSource({ ...options, project, inventory, component });
	let app;
	try
	{
		await mkdir(dirname(root),{recursive: true});
		app = await mkdtemp(join(dirname(root),".io-objects-"));
		const core = await compilePhpWasmIOCore({ ...options, app, leanPrefix
			, sources: source.sources, projectContract: source.projectContract
			, zend: { ...coordinates(component,record.configuration), phpSource: options.phpSource } });
		await mkdir(root);
		await writePhpWasmIOPayload(join(root,"io"),core);
		for(const [path,bytes] of source.captured.files)
		{
			await mkdir(dirname(join(root,path)),{ recursive: true });
			await writeFile(join(root,path), bytes, { flag: "wx" });
		}
		const manifest = { schemaVersion: 1, profile, io: core.zend.receipt
			, sourceNoticesSha256: source.captured.sha256
			, snapshot: source.snapshot.document
			, review: source.projectContract.review?.source ?? null };
		await writeFile(join(root,"artifacts.json"),canonicalJson(manifest),{ flag: "wx" });
		const verified = await readPhpWasmIOProjectComponent(root,core.runtimeIdentity);
		await source.verify();
		return { ...verified, snapshot: source.snapshot };
	} finally
	{
		await source.dispose();
		if(app) await rm(app,{recursive: true,force: true});
	}
};
