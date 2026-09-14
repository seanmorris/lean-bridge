/**
 * Build one captured source API for npm and CPAN, then expose both atomically.
 *
 * @file
 */
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { readExportConfiguration, assertExportConfigurationCapabilities } from "../analyze/export-configuration.mjs";
import { sourceApiIdentity } from "../analyze/semantic-model.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { buildNativeProject } from "./native-project.mjs";
import { createNativeModel } from "./native-model.mjs";
import { verifyNativeFiles } from "./native-artifacts.mjs";
import { prepareLakeEntryIntent } from "./lake-entry-intent.mjs";
import { verifyLakeSnapshotSourceTree } from "./lake-dependency-snapshot.mjs";
import { validateComponentBuildPlan } from "./component-plan.mjs";
import { buildComponentNpmPackages } from "../release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../release/component-package-receipt.mjs";
import { resolveComponentRuntimeRoot } from "../release/component-runtime-root.mjs";
import { CanonicalBuildError } from "./build-error.mjs";

const fail = message => { throw new CanonicalBuildError("multi-profile-mismatch", message); };
const json = async path => JSON.parse(await readFile(path, "utf8"));
const absent = async path => {
	try
	{ await lstat(path); }
	catch(error)
	{ if(error.code === "ENOENT") return; throw error; }
	throw new CanonicalBuildError("output-exists", `Build output already exists: ${path}`);
};

/**
 * Compare compiler-derived APIs while retaining each profile's complete evidence.
 *
 * @param options - Independent original capture and authenticated profile models.
 * @param options.intent - Source-only intent captured before either compilation.
 * @param options.configurationSha256 - Captured export-configuration digest.
 * @param options.wasmPlan - Validated component build plan.
 * @param options.wasmIr - Compiler-derived Wasm Binding IR.
 * @param options.nativeModel - Reconstructed native model, before Perl projection.
 */
export const assertProfileApiAgreement = ({ intent, configurationSha256, wasmPlan, wasmIr, nativeModel }) => {
	validateComponentBuildPlan(wasmPlan);
	const source = intent.document.source, native = nativeModel.sourceIdentity;
	if(wasmPlan.source.treeSha256 !== source.treeSha256 || native.sourceTreeSha256 !== source.treeSha256
		|| wasmPlan.source.lakeSnapshotSha256 !== source.lakeSnapshotSha256
		|| native.lakeDependencies?.snapshotSha256 !== source.lakeSnapshotSha256
		|| native.exportConfigurationSha256 !== configurationSha256
		|| wasmPlan.source.toolchain !== source.toolchain
		|| `leanprover/lean4:v${native.leanVersion}` !== source.toolchain
		|| native.leanCommit !== wasmPlan.runtime.leanCommit)
		fail("Compiled profiles do not share the captured sources, configuration and Lean toolchain");
	if(wasmPlan.bindingIr.origin !== "lean-elaborated"
		|| wasmPlan.bindingIr.semanticSha256 !== hashBindingIr(wasmIr)
		|| nativeModel.bindingIrSha256 !== hashBindingIr(nativeModel.bindingIr)
		|| canonicalJson(wasmPlan.component) !== canonicalJson(intent.document.component)
		|| canonicalJson(wasmIr.component) !== canonicalJson(intent.document.component)
		|| canonicalJson(nativeModel.component) !== canonicalJson(intent.document.component))
		fail("Compiled profiles do not retain their checked Binding IR identities");
	const api = sourceApiIdentity(wasmIr);
	if(sourceApiIdentity(nativeModel.bindingIr).sha256 !== api.sha256)
		fail("Native and WebAssembly profiles disagree on the selected source API");
	return api.sha256;
};

/**
 * Compile once per compatible profile and commit the complete output directory.
 *
 * @param options - Canonical build options with the non-native build entry point.
 * @param options.projectRoot - Read-only ordinary Lean project.
 * @param options.engineRoot - Installed compiler engine and runtime location.
 * @param options.outputRoot - Absent final release directory.
 * @param options.environment - Explicit compiler and Perl environment.
 * @param options.runner - Wasm build's isolated command transport.
 * @param options.cache - Wasm engine cache policy.
 * @param options.signal - Optional abort signal.
 * @param options.onProgress - Build progress observer.
 * @param options.lakeSnapshot - Optional independently captured source tree.
 * @param options.buildWasm - Canonical single-profile build entry point.
 * @param options.nativeTargets - Native packages sharing the native compilation.
 */
export const buildMultiProfileProject = async ({
	projectRoot, engineRoot, outputRoot
	, environment, runner, cache, signal, onProgress, lakeSnapshot, buildWasm
	, nativeTargets = ["cpan"]
}) => {
	signal?.throwIfAborted();
	const project = resolve(projectRoot), output = resolve(outputRoot ?? join(project, "build/lean-bridge-release"));
	if(output === project || project.startsWith(`${output}/`))
		throw new CanonicalBuildError("invalid-output-root", "Build output cannot replace the source project");
	await absent(output);
	const record = await readExportConfiguration(project, { signal });
	for(const target of nativeTargets)
		assertExportConfigurationCapabilities(record.configuration, { target, fields: ["modules", "exports", "specializations", "contracts", "generators"], targetFields: target === "cpan" ? ["module", "version"] : ["name", "version"] });
	const intent = await prepareLakeEntryIntent({ projectRoot: project, lakeSnapshot, signal });
	const runtimeRoot = await resolveComponentRuntimeRoot({ engineRoot, environment });
	await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-multi-profile-"));
	try
	{
		const wasmRoot = join(staging, "profiles/wasm"), nativeRoot = join(staging, "profiles/native");
		const shared = { projectRoot: project, environment, signal, onProgress, lakeSnapshot: intent.lakeSnapshot };
		await buildWasm({ ...shared, engineRoot, runner, cache, targets: ["npm"], outputRoot: wasmRoot });
		signal?.throwIfAborted();
		const built = await buildNativeProject({ ...shared, targets: nativeTargets, outputRoot: nativeRoot });
		signal?.throwIfAborted();
		const componentRoot = join(nativeRoot, "native/component"), bundleRoot = join(wasmRoot, "bundle");
		const nativeModel = await json(join(componentRoot, "model.json"));
		const nativeReceipt = await json(join(componentRoot, "native-component.json"));
		await verifyNativeFiles(componentRoot, (await json(join(componentRoot, "artifacts.json"))).files);
		const reconstructed = createNativeModel({
			metadata: await json(join(componentRoot, "metadata.json"))
			, component: nativeModel.component, moduleName: nativeModel.moduleName
			, sourceIdentity: nativeReceipt.sourceIdentity
		});
		if(canonicalJson(reconstructed) !== canonicalJson(nativeModel)
			|| sha256(canonicalJson(nativeModel)) !== nativeReceipt.modelSha256)
			fail("Native model changed after compilation");
		const wasmPlan = await json(join(bundleRoot, "locks/component-build-plan.json"));
		const wasmIr = await json(join(bundleRoot, "binding/binding-ir.json"));
		const sourceApiSha256 = assertProfileApiAgreement({ intent
			, configurationSha256: record.sha256, wasmPlan, wasmIr, nativeModel });
		const npm = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(staging, "packages/npm") });
		await verifyComponentPackageReceipt({ receiptPath: join(npm.output, "component-package-receipt.json") });
		const identify = async path => ({ path, sha256: sha256(await readFile(join(staging, path))) });
		const archives = async (prefix, entries) => Promise.all(entries.map(async entry => {
			const file = await identify(`${prefix}/${entry.archive}`);
			if(file.sha256 !== entry.sha256) fail("Package archive changed after projection");
			return file;
		}));
		const manifest = { schemaVersion: 1, kind: "lean-bridge-multi-profile-release"
			, component: intent.document.component
			, source: { treeSha256: intent.document.source.treeSha256
				, lakeSnapshotSha256: intent.lakeSnapshot.sha256
				, configurationSha256: record.sha256
				, toolchain: intent.document.source.toolchain }
			, sourceApiSha256
			, profiles: [
				{ profile: "component-scalars-v1", target: "npm", path: "profiles/wasm"
					, bindingIrSha256: hashBindingIr(wasmIr)
					, evidence: await identify("profiles/wasm/engine-execution-report.json") }
				, { profile: "native-library-v1"
					, ...(nativeTargets.length === 1 ? { target: nativeTargets[0] } : { targets: nativeTargets })
					, path: "profiles/native"
					, bindingIrSha256: nativeModel.bindingIrSha256
					, evidence: await identify("profiles/native/native/component/native-component.json") }
			]
			, packages: [
				{ target: "npm", path: "packages/npm"
					, receipt: await identify("packages/npm/component-package-receipt.json")
					, archives: await archives("packages/npm", [npm.report.runtime, npm.report.package]) }
				, ...await Promise.all((built.projections ?? [built]).map(async projection => ({
					target: projection.ecosystem, path: "profiles/native/archives"
					, receipt: await identify("profiles/native/native-release.json")
					, archives: await archives("profiles/native/archives", projection.packages) })))
			]
			, policies: { sourceReadOnly: true, profilesCompiledOnce: true
				, componentBinariesRebuiltByProjection: false }
		};
		await verifyLakeSnapshotSourceTree({ snapshot: intent.lakeSnapshot, projectRoot: project, signal });
		if((await readExportConfiguration(project, { signal })).sha256 !== record.sha256)
			fail("Export configuration changed during the multi-profile build");
		await writeFile(join(staging, "multi-profile-release.json"), canonicalJson(manifest), { flag: "wx" });
		signal?.throwIfAborted();
		await absent(output);
		await rename(staging, output);
		return Object.freeze({ ...manifest, output, targets: ["npm", ...nativeTargets] });
	} catch(error)
	{ await rm(staging, { recursive: true, force: true }); throw error; }
};
