/**
 * Select captured or generated Lake sources for native and WebAssembly builds.
 *
 * @file
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyLakeDependencySnapshot, writeLakeDependencySnapshot } from "./lake-dependency-snapshot.mjs";
import { readLakeGeneratorRecipes, prepareLakeGeneratorPrerequisites } from "./lake-generator-prerequisites.mjs";
import { createLakeGeneratedSources, resolveGeneratedLakeWorkspace } from "./lake-generated-workspace.mjs";
import { resolveLockedLakeWorkspace } from "./lake-workspace.mjs";

/**
 * Resolve the selected closure and retain every source context until compilation ends.
 *
 * @param options - Complete capture, selected root modules and pinned compiler.
 * @param options.snapshot - Authenticated original source capture.
 * @param options.modules - Selected captured public modules.
 * @param options.leanPrefix - Selected Lean installation.
 * @param options.signal - Optional cancellation signal.
 */
export const resolveLakeBuildWorkspace = async ({ snapshot, modules, leanPrefix, signal }) => {
	const working = await mkdtemp(join(tmpdir(), `lean-bridge-lake-build-${process.pid}-`));
	let workspace, prerequisites;
	const dispose = async () => {
		await workspace?.dispose();
		await prerequisites?.dispose();
		await rm(working, { recursive: true, force: true });
	};
	try
	{
		const snapshotRoot = join(working, "capture");
		await writeLakeDependencySnapshot({ snapshot, outputRoot: snapshotRoot, signal });
		const catalog = await readLakeGeneratorRecipes({ snapshot, snapshotRoot, signal });
		if(!catalog.recipes.length)
		{
			workspace = await resolveLockedLakeWorkspace({ snapshot, modules, leanPrefix, signal });
			return Object.freeze({ ...workspace, snapshotRoot
				, resolution: workspace.document
				, evidence: { snapshot: snapshot.document, resolution: workspace.document, resolutionSha256: workspace.sha256 }
				, verify: () => verifyLakeDependencySnapshot({ snapshot, snapshotRoot, signal })
				, dispose });
		}
		prerequisites = await prepareLakeGeneratorPrerequisites({ snapshot, modules, leanPrefix, signal });
		workspace = await resolveGeneratedLakeWorkspace({ snapshot, modules
			, leanPrefix, signal
			, prerequisites, expectedPrerequisitesSha256: prerequisites.sha256 });
		const generatedSources = await createLakeGeneratedSources(workspace);
		// The resolved workspace owns copies; producer staging is no longer needed.
		await prerequisites.dispose();
		prerequisites = undefined;
		return Object.freeze({ sourceRoot: workspace.sourceRoot, snapshotRoot
			, document: workspace.document, sha256: workspace.sha256
			, resolution: workspace.document.result.resolution
			, generated: workspace, generatedSources
			, evidence: { snapshot: snapshot.document
				, resolution: workspace.document
				, resolutionSha256: workspace.sha256
				, generatedSourcesSha256: generatedSources.sha256 }
			, verify: workspace.verify, dispose });
	} catch(error)
	{ await dispose(); throw error; }
};
