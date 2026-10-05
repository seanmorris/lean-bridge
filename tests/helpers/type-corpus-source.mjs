/**
 * Shared source fixtures and fresh Lean oracles for native and WASM consumers.
 *
 * @file
 */
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { lakeWorkspaceFixture, saveLakeFile } from "./lake-workspace.mjs";

const fixtures = resolve(import.meta.dirname, "../fixtures/type-corpus");
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });

/**
 * Prepare unchanged library sources with an explicit target export selection.
 *
 * @param t - Test context owning the scratch directory.
 * @param library - Catalog library.
 * @param exports - Fully qualified selected declarations.
 * @param targets - Reviewed target settings.
 */
export const prepareCorpusSources = async (t, library, exports, targets) => {
	const context = await lakeWorkspaceFixture(t, library.id);
	for(const module of [library.module, library.pendingModule])
	{
		const path = `${module.replaceAll(".", "/")}.lean`;
		await saveLakeFile(context.root, path, await readFile(join(fixtures, path)));
	}
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
		, modules: [library.module], exports, targets }));
	return context;
};

/**
 * Compile dependencies and proofs afresh, then execute the independent oracle.
 *
 * @param context - Source fixture with its pinned offline dependency.
 * @param library - Catalog library and oracle.
 * @param leanPrefix - Selected Lean compiler installation.
 */
export const leanCorpusOracle = async (context, library, leanPrefix) => {
	const root = join(context.directory, "oracle");
	const sources = [
		[context.names.remote, join(context.cached, `lib/${context.names.remote}.lean`)]
		, [context.names.local, join(context.local, `${context.names.local}.lean`)]
		, [library.module, join(context.root, `${library.module.replaceAll(".", "/")}.lean`)]
		, [library.pendingModule, join(context.root, `${library.pendingModule.replaceAll(".", "/")}.lean`)]
		, ["Corpus.Wire", join(fixtures, "Corpus/Wire.lean")]
	];
	const lean = join(leanPrefix, "bin/lean");
	const env = { PATH: "/usr/bin:/bin", LEAN_SYSROOT: leanPrefix, LEAN_PATH: join(root, "olean") };
	const modules = [];
	for(const [module, source] of sources)
	{
		const path = `${module.replaceAll(".", "/")}.lean`, bytes = await readFile(source);
		await saveLakeFile(join(root, "source"), path, bytes);
		const olean = join(root, "olean", `${path.slice(0, -5)}.olean`);
		await mkdir(resolve(olean, ".."), { recursive: true });
		await run(lean, ["-R", join(root, "source"), "-o", olean, join(root, "source", path)], root, env);
		modules.push({ module, sha256: sha256(bytes) });
	}
	const source = await readFile(join(fixtures, library.oracle));
	await saveLakeFile(root, "Oracle.lean", source);
	const result = JSON.parse((await run(lean, ["--run", "Oracle.lean"], root, env)).stdout);
	return { result, modules, sourceSha256: sha256(source)
		, resultSha256: sha256(canonicalJson(result))
		, leanCompilerSha256: sha256(await readFile(lean))
		, version: (await run(lean, ["--version"], root, env)).stdout.trim() };
};
