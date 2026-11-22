/**
 * Stage exact Lean source inputs, compile their import graph and inspect fresh interfaces.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { identifyLeanInterface } from "../analyze/elaborated-metadata.mjs";
import { pythonHostSelection, reconcileHostExports } from "../analyze/host-export-model.mjs";
import { generatePythonHostProvider } from "../backends/python/host-provider.mjs";

const extractor = fileURLToPath(new URL("../analyze/HostExports.lean", import.meta.url));
const hostModule = "LeanBridge.Host.Python";
const fail = message => { throw Object.assign(new Error(message), { code: "host-elaboration-drift" }); };

/**
 * Compile in an isolated module path. No project-provided object, interface or C input is linked.
 *
 * @param options - Captured source modules, entry selection, pinned tools and private workspace.
 */
export const compileHostSources = async options => {
	const { app, ir, sources, projectContract, run, leanPrefix, signal } = options;
	const lean = join(leanPrefix, "bin/lean");
	const compilerSha256 = projectContract ? sha256(await readFile(lean)) : null;
	const extractorSha256 = projectContract ? sha256(await readFile(extractor)) : null;
	const env = { ...options.environment, LEAN_SYSROOT: leanPrefix, LEAN_SRC_PATH: app, LEAN_PATH: app, LEAN_NUM_THREADS: "1" };
	const modules = [...(ir ? [{ module: hostModule, source: generatePythonHostProvider(ir).lean }] : []), ...sources];
	const byPath = new Map(), byName = new Map(), built = new Map(), active = new Set(), objects = [];
	for(const s of modules)
	{
		const path = join(app, `${s.module.replaceAll(".", "/")}.lean`);
		await mkdir(dirname(path), { recursive: true }); await writeFile(path, s.source, { flag: "wx" });
		const spec = { name: s.module, path, sourceSha256: sha256(s.source) };
		byPath.set(path, spec); byName.set(s.module, spec);
	}
	const compile = async spec => {
		if(built.has(spec.name)) return;
		if(active.has(spec.name)) throw new Error(`cyclic host-module imports: ${spec.name}`);
		active.add(spec.name);
		if(projectContract)
		{
			const dependencies = await run(lean, ["-j1", "--src-deps", spec.path], app, env);
			spec.imports = new Set();
			for(const line of dependencies.stdout.trim().split("\n"))
			{
				const dep = byPath.get(resolve(app, line));
				if(dep)
				{ spec.imports.add(dep.name); await compile(dep); }
			}
		}
		const olean = spec.path.replace(/\.lean$/u, ".olean"), c = `module${objects.length}.c`;
		await run(lean, ["-j1", "-R", app, "-o", olean, "-c", c, spec.path], app, env);
		const iface = projectContract ? await identifyLeanInterface(olean, signal) : null;
		const cSha256 = projectContract ? sha256(await readFile(join(app, c))) : null;
		built.set(spec.name, { ...spec, olean, iface, c, cSha256 }); active.delete(spec.name); objects.push(c);
	};
	const roots = projectContract?.modules ?? modules.map(s => s.module);
	if(ir) await compile(byName.get(hostModule));
	for(const root of roots) await compile(byName.get(root));
	if(!projectContract) return { objects, entries: options.entries, env };
	const selection = {
		...pythonHostSelection(ir), exports: projectContract.exports
		, leanResources: projectContract.leanResources ?? []
		, ...(options.python && projectContract.taskExports?.length ? { pythonTaskCallbacks: true } : {})
		, ...(projectContract.taskIOErrors ? { taskIOErrors: projectContract.taskIOErrors } : {})
		, taskExports: projectContract.taskExports ?? []
		, asyncIterators: projectContract.asyncIterators ?? []
		, exportModules: roots, modules: [...built.keys()]
	};
	const request = join(app, "host-request.json");
	await writeFile(request, canonicalJson(selection), { flag: "wx" });
	const result = await run(lean, ["-j1", "--run", extractor, request], app, env);
	const metadata = JSON.parse(result.stdout);
	const interfaces = [];
	for(const f of built.values())
	{
		const check = await identifyLeanInterface(f.olean, signal);
		if(sha256(await readFile(f.path)) !== f.sourceSha256 || canonicalJson(check) !== canonicalJson(f.iface)) fail(`source/interface changed: ${f.name}`);
		if(sha256(await readFile(join(app, f.c))) !== f.cSha256) fail(`generated C changed: ${f.name}`);
		interfaces.push({ module: f.name, sourceSha256: f.sourceSha256, cSha256: f.cSha256, ...check });
	}
	// Independent packages may exchange this type only if the declaring module,
	// its entire application import closure and the Lean compiler agree. Do not
	// include unrelated component entry points or private staging paths.
	const family = n => {
		const seen = new Set();
		const visit = name => {
			const f = built.get(name);
			if(!f) fail("unknown resource owner module");
			if(seen.has(name)) return;
			seen.add(name); for(const dep of f.imports) visit(dep);
		};
		visit(n);
		return [...seen].sort().map(module => ({ module, sourceSha256: built.get(module).sourceSha256 }));
	};
	const owned = (metadata.leanResources ?? []).map(r => ({ ...r
		, identity: sha256(canonicalJson({ abi: "lean-bridge/heap-resource-v1", declaration: r.declaration, compilerSha256, modules: family(r.module) })) }));
	const { entries, api } = reconcileHostExports({ ir, metadata, selection, component: projectContract.component, review: projectContract.review, owned });
	if(sha256(await readFile(lean)) !== compilerSha256 || sha256(await readFile(extractor)) !== extractorSha256
		|| await readFile(request, "utf8") !== canonicalJson(selection)) fail("host inspector or its invocation changed");
	const evidence = {
		selection, compilerSha256, extractorSha256, interfaces, metadata
		, sourceTreeSha256: projectContract.sourceTreeSha256
		, configurationSha256: projectContract.configurationSha256
		, lake: projectContract.lake ?? null
		, hostImportsSourceSha256: projectContract.hostImportsSourceSha256
		, reviewedSourceSha256: projectContract.review?.sha256 ?? null };
	return { objects, entries, env, api, evidence };
};
