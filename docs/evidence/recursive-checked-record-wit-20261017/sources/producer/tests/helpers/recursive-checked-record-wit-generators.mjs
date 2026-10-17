/**
 * Reconstruct the WIT graph package and host generators from the immutable producer revision.
 * Historical tool and installation paths are provenance, never current inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { pathToFileURL } from "node:url";
import { moduleSpecifiers } from "./module-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nominalSubtypeWitOriginal } from "./nominal-subtype-wit-generators.mjs";

const generators = new Map();
const entries = Object.freeze([
	"src/backends/wit/copied-graph-package.mjs"
	, "src/backends/wit/copied-graph-host.mjs"
	, "src/backends/wit/host-evidence.mjs"
	, "src/build/native-graph-sources.mjs"
]);

/**
 * Load the complete static closure that generated the graph projection, host and adapter headers.
 *
 * @param revision - Full producer revision, independent of recorded tool paths.
 */
export const recursiveCheckedRecordWitGenerator = revision => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	if(!generators.has(revision)) generators.set(revision, (async () => {
		const closure = new Map();
		const visit = path => {
			assert.ok(path.startsWith("src/") && /\.(?:mjs|json)$/u.test(path) && posix.normalize(path) === path, path);
			if(closure.has(path)) return;
			const bytes = nominalSubtypeWitOriginal(revision, path), source = bytes.toString();
			if(path.endsWith(".json"))
			{ JSON.parse(source); closure.set(path, bytes); return; }
			assert.doesNotMatch(source, /\bimport\s*\(/u, path);
			// The receipt module's direct-run guard is inert when imported.
			const guard = "if(process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)";
			assert.doesNotMatch(path === "src/release/component-package-receipt.mjs" ? source.replace(guard, "") : source, /\bimport\.meta/u, path);
			closure.set(path, bytes);
			for(const specifier of moduleSpecifiers(source, path)) visit(posix.normalize(posix.join(posix.dirname(path), specifier)));
		};
		for(const entry of entries) visit(entry);
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-wit-generator-"));
		try
		{
			for(const [path, bytes] of closure) await saveLakeFile(directory, path, bytes);
			const modules = [];
			for(const entry of entries) modules.push(await import(pathToFileURL(join(directory, entry)).href));
			return Object.freeze({ compileCopiedWitGraphPackageModel: modules[0].compileCopiedWitGraphPackageModel
				, renderWitGraphHostSource: modules[1].renderWitGraphHostSource
				, guardWitHostSource: modules[2].guardWitHostSource
				, witHostDependencies: modules[2].witHostDependencies
				, nativeGraphProjectionSources: modules[3].nativeGraphProjectionSources
				, nativeGraphRefinementDiagnostics: modules[3].nativeGraphRefinementDiagnostics
				, paths: Object.freeze([...closure.keys()].sort()) });
		}
		finally
		{ await rm(directory, { recursive: true }); }
	})());
	return generators.get(revision);
};
