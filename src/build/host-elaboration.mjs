/**
 * Stage exact Lean source inputs, compile their import graph and inspect fresh interfaces.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import {parseBindingIr} from "../binding-ir/canonical.mjs";
import { identifyLeanInterface } from "../analyze/elaborated-metadata.mjs";
import { heapResourceIdentities } from "../analyze/heap-resource-identity.mjs";
import { nativeHostSelection, reconcileHostExports } from "../analyze/host-export-model.mjs";
import { nativeEffectPolicy } from "../analyze/native-host-effects.mjs";
import { generatePythonHostProvider } from "../backends/python/host-provider.mjs";
import { staticHostMembers } from "../backends/native/static-host-members.mjs";
import { compiledHostModules, compiledHostTargets, generateLeanHostObjectAdapters } from "../backends/lean/host-object.mjs";

const extractor = fileURLToPath(new URL("../analyze/HostExports.lean", import.meta.url));
const fail = message => { throw Object.assign(new Error(message), { code: "host-elaboration-drift" }); };

/**
 * Recover the exact threaded host provider from the captured author file.
 * Never select a module or its generated C object by an archive-supplied name.
 *
 * @param contract - Project snapshot with the original UTF-8 host input.
 * @param evidence - Fresh elaboration record (when reconstructing after compilation).
 * @param target - Author language of the nominal host contract.
 */
export const threadedHostSource=(contract,evidence,target="javascript")=>{
	if(!["php","javascript"].includes(target)) fail("Unknown threaded host provider");
	if(evidence?.selection.phpWasmSyncObjects!==undefined) fail("Standalone Zend objects cannot enter a worker package");
	const php=target==="php",label=php?"PHP-Wasm":"JavaScript";
	const {ir,hostImportsSource: source,hostImportsSourceSha256: hash}=contract;
	if(!ir)
	{
		if(source!=null || hash!==null || contract.generatedHostModule!=null || evidence
			&& (evidence.hostImportsSourceSha256!==null || evidence.selection.hostModule!==undefined || evidence.selection.javascriptThreadedHostMembers!==undefined || evidence.selection.phpWasmTaskObjects!==undefined || evidence.selection.phpNativeTaskObjects!==undefined))
			fail("Unexpected threaded host source without import declarations");
		return null;
	}
	const module=compiledHostModules[target];
	if(typeof source!=="string" || sha256(source)!==hash || contract.generatedHostModule!==module)
		fail("Unverified threaded "+label+" host source");
	const parsed=parseBindingIr(source);
	if(canonicalJson(parsed)!==canonicalJson(ir)) fail("Captured host source differs from threaded "+label+" declarations");
	if(evidence)
	{
		const interfaces=evidence.interfaces.filter(f=>f.module===module);
		const lean=generateLeanHostObjectAdapters(parsed,{threadedJavaScript: !php,phpWasmTaskObjects: php})[module.replaceAll(".","/")+".lean"];
		if((php?evidence.selection.phpWasmTaskObjects:evidence.selection.javascriptThreadedHostMembers)!==true || evidence.selection.phpNativeTaskObjects!==undefined || evidence.selection.phpNativeFunctions!==undefined
			|| (php?evidence.selection.javascriptThreadedHostMembers:evidence.selection.phpWasmTaskObjects)!==undefined || evidence.selection.hostModule!==module
			|| evidence.hostImportsSourceSha256!==hash || interfaces.length!==1 || interfaces[0].sourceSha256!==sha256(lean))
			fail("Threaded "+label+" provider differs from the elaborated module");
	}
	return parsed;
};

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
	if(ir && options.target && !Object.hasOwn(compiledHostTargets, options.target)) fail("No host import provider for the selected target");
	const target = compiledHostTargets[options.target] ?? "python", hostModule = compiledHostModules[target];
	const threadedJavaScript=Boolean(ir && options.target==="npm" && (projectContract?.taskExports?.length || projectContract?.asyncIterators?.length));
	const phpNativeTaskObjects=Boolean(ir && options.target==="php-native" && (projectContract?.taskExports?.length || projectContract?.asyncIterators?.length));
	const rubyTaskObjects=Boolean(ir && options.target==="rubygems" && (projectContract?.taskExports?.length || projectContract?.asyncIterators?.length));
	const jvmTaskObjects = Boolean(ir && options.target === "maven" && (projectContract?.taskExports?.length || projectContract?.asyncIterators?.length));
	const dotnetTaskObjects=Boolean(ir && options.target==="nuget" && (projectContract?.taskExports?.length || projectContract?.asyncIterators?.length));
	const perlTaskObjects=Boolean(ir && options.target==="cpan" && (projectContract?.taskExports?.length || projectContract?.asyncIterators?.length));
	const staticTarget = { c: "C", cpp: "C++", rust: "Rust", "wit-wasi": "WIT/WASI" };
	const staticTaskOwner = ir && Object.hasOwn(staticTarget,target) && (projectContract?.taskExports?.length || projectContract?.asyncIterators?.length) ? target : null;
	const localWorkerOwner = staticTaskOwner ? staticTarget[staticTaskOwner] : perlTaskObjects ? "Perl" : jvmTaskObjects ? "JVM" : dotnetTaskObjects ? "CLR" : rubyTaskObjects ? "Ruby" : null;
	if(localWorkerOwner)
	{
		const source=projectContract.hostImportsSource;
		if(projectContract.generatedHostModule!==hostModule || typeof source!=="string"
			|| sha256(source)!==projectContract.hostImportsSourceSha256 || canonicalJson(parseBindingIr(source))!==canonicalJson(ir))
			fail(localWorkerOwner+" worker declarations differ from the captured host source");
	}
	// Probe the actual exported Lean types, not the project's package name or
	// a claim in its review. A scalar worker next to a synchronous host import
	// retains its existing, binding-independent Python API.
	const pythonTaskObjects=Boolean(options.python && options.target === "pypi" && ir
		&& (projectContract?.taskExports?.length || projectContract?.asyncIterators?.length));
	if(pythonTaskObjects)
	{
		const source=projectContract?.hostImportsSource;
		if(!ir || !options.python || target!=="python" || projectContract.generatedHostModule!==hostModule
			|| !(projectContract.taskExports?.length || projectContract.asyncIterators?.length) || typeof source!=="string"
			|| sha256(source)!==projectContract.hostImportsSourceSha256 || canonicalJson(parseBindingIr(source))!==canonicalJson(ir))
			fail("Python worker declarations differ from the captured host source");
	}
	const phpWasmTaskObjects=Boolean(ir && options.target==="php-wasm" && (projectContract?.taskExports?.length || projectContract?.asyncIterators?.length));
	if(ir && ["c","cpp","rust","php","wit-wasi"].includes(target))
	{
		const label={c: "C",cpp: "C++",rust: "Rust",php: "PHP","wit-wasi": "WIT/WASI"}[target];
		if(target!=="php" && !projectContract) fail(label+" host members require a captured import source");
		if(projectContract)
		{
			const {hostImportsSource: text,hostImportsSourceSha256: hash}=projectContract;
			if(typeof text!=="string" || sha256(text)!==hash || canonicalJson(parseBindingIr(text))!==canonicalJson(ir))
				fail(label+" host declarations differ from the captured import source");
		}
		staticHostMembers(ir,target);
	}
	if(threadedJavaScript && canonicalJson(threadedHostSource(projectContract))!==canonicalJson(ir)) fail("Wrong threaded host compile input");
	if(projectContract && Object.hasOwn(projectContract, "generatedHostModule")
		&& projectContract.generatedHostModule !== (ir ? hostModule : null)) fail("Captured host module and compile target differ");
	if(ir && sources.some(s => s.module === hostModule)) fail("Application source shadows the generated host module");
	const modules = [...(ir ? [{ module: hostModule
		, source: target === "python" ? generatePythonHostProvider(ir).lean
			: generateLeanHostObjectAdapters(ir,{threadedJavaScript,phpWasmTaskObjects})[hostModule.replaceAll(".", "/") + ".lean"] }] : [])
	, ...sources];
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
		...nativeHostSelection(ir, target), exports: projectContract.exports
		, nativeEffectPolicy, nativeEffects: projectContract.nativeEffects ?? []
		, ...(projectContract.synchronousIO ? { synchronousIO: true } : {})
		, leanResources: projectContract.leanResources ?? []
		, ...(options.python && projectContract.taskExports?.length ? { pythonTaskCallbacks: true } : {})
		, ...(options.target === "cargo" && projectContract.taskExports?.length ? { rustTaskCallbacks: true } : {})
		, ...(options.target === "cpp" && projectContract.taskExports?.length ? { cppTaskCallbacks: true } : {})
		, ...(options.target === "c" && projectContract.taskExports?.length ? { cTaskCallbacks: true } : {})
		, ...(options.target === "rubygems" && projectContract.taskExports?.length ? { rubyTaskCallbacks: true } : {})
		, ...(options.target === "nuget" && projectContract.taskExports?.length ? { dotnetTaskCallbacks: true } : {})
		, ...(options.target === "maven" && projectContract.taskExports?.length ? { jvmTaskCallbacks: true } : {})
		, ...(options.target === "cpan" && projectContract.taskExports?.length ? { perlTaskCallbacks: true } : {})
		, ...(["php-native","php-wasm"].includes(options.target) && projectContract.taskExports?.length ? { phpTaskCallbacks: true } : {})
		, ...(options.target === "npm" && projectContract.taskExports?.length ? { javascriptTaskCallbacks: true } : {})
		, ...(threadedJavaScript ? {javascriptThreadedHostMembers: true} : {})
		, ...(phpNativeTaskObjects ? {phpNativeTaskObjects: true} : {})
		, ...(ir && options.target==="php-native" ? {phpNativeFunctions: true} : {})
		, ...(pythonTaskObjects ? {pythonTaskObjects: true} : {})
		, ...(rubyTaskObjects ? {rubyTaskObjects: true} : {})
		, ...(jvmTaskObjects ? {jvmTaskObjects: true} : {})
		, ...(perlTaskObjects ? {perlTaskObjects: true} : {})
		, ...(dotnetTaskObjects ? {dotnetTaskObjects: true} : {})
		, ...(staticTaskOwner ? {staticTaskOwner} : {})
		, ...(phpWasmTaskObjects ? {phpWasmTaskObjects: true} : {})
		, ...(ir && options.target==="php-wasm" && !phpWasmTaskObjects ? {phpWasmSyncObjects: true} : {})
		, ...(options.target === "wit-wasi" && projectContract.taskExports?.length ? { witTaskCallbacks: true } : {})
		, ...(options.target === "wit-wasi" && !ir && projectContract.asyncIterators?.length ? { witCursorIO: true } : {})
		, ...(projectContract.taskIOErrors ? { taskIOErrors: projectContract.taskIOErrors } : {})
		, ...(projectContract.taskCallbackPolicies ? {taskCallbackPolicies: projectContract.taskCallbackPolicies} : {})
		, ...(options.target==="php-wasm" && projectContract.taskCallbackPolicies ? {phpWasmCallbackBudgets: true} : {})
		, ...(options.target==="php-native" && !ir && projectContract.taskCallbackPolicies ? {phpNativeCallbackBudgets: true} : {})
		, taskExports: projectContract.taskExports ?? []
		, asyncIterators: projectContract.asyncIterators ?? []
		, ...(projectContract.iterators?.length ? {iterators: projectContract.iterators} : {})
		, exportModules: roots, modules: [...built.keys()]
	};
	let request = join(app, "host-request.json");
	await writeFile(request, canonicalJson(selection), { flag: "wx" });
	const result = await run(lean, ["-j1", "--run", extractor, request], app, env).catch(error => {
		signal?.throwIfAborted();
		// Surface this author decision without exposing raw compiler output, paths
		// or commands. Only match failures from our own checked extractor.
		if(error.code === "build-command-failed")
		{
			const output = [error.details?.stderr, error.details?.stdout].filter(Boolean).join("\n").split("\n");
			if(localWorkerOwner)
				for(const name of [...selection.taskExports,...selection.asyncIterators.flatMap(p=>[p.open,p.next,p.close])])
				{
					const owner=localWorkerOwner;
					const message=owner+" task calls a "+owner+" member outside its owner: "+name;
					if(output.some(line=>line.trimEnd().endsWith(message)))
						throw Object.assign(new Error(message),{code: "invalid-task-export",cause: error,details: error.details});
				}
			for(const name of selection.taskExports)
			{
				const message = "taskExports requires a real Lean Task result: " + name;
				if(output.some(line => line.trimEnd().endsWith(message)))
					throw Object.assign(new Error(message), {code: "invalid-task-export", cause: error, details: error.details});
			}
		}
		throw error;
	});
	let metadata = JSON.parse(result.stdout);
	if(pythonTaskObjects)
	{
		const kinds = new Set(selection.resources.map(r => r.id));
		const nominal = t => t?.kind === "named" ? kinds.has(t.id)
			: t?.kind === "io-callback" ? nominal(t.argument) || nominal(t.reply)
				: t?.kind === "apply" && t.arguments.some(nominal);
		if(!metadata.entries.some(e => e.delivery && [e.result, e.error, e.stepError, ...e.parameters.map(p => p.type)].some(nominal)))
		{
			delete selection.pythonTaskObjects;
			request = join(app, "host-request-copied.json");
			await writeFile(request, canonicalJson(selection), { flag: "wx" });
			metadata = JSON.parse((await run(lean, ["-j1", "--run", extractor, request], app, env)).stdout);
		}
	}
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
	const resources = metadata.leanResources ?? [];
	const resourceImports = resources.length ? Object.fromEntries([...built].map(([name,f])=>[name,[...f.imports].sort()])) : null;
	const owned = resources.length ? heapResourceIdentities({ compilerSha256, interfaces, resourceImports, resources }) : [];
	const { entries, api } = reconcileHostExports({ ir, metadata, selection, component: projectContract.component, review: projectContract.review, owned });
	if(sha256(await readFile(lean)) !== compilerSha256 || sha256(await readFile(extractor)) !== extractorSha256
		|| await readFile(request, "utf8") !== canonicalJson(selection)) fail("host inspector or its invocation changed");
	const evidence = {
		selection, compilerSha256, extractorSha256, interfaces, metadata
		, ...(["cpan", "php-native", "php-wasm", "npm", "wit-wasi"].includes(options.target) && owned.length ? { resourceImports } : {})
		, sourceTreeSha256: projectContract.sourceTreeSha256
		, configurationSha256: projectContract.configurationSha256
		, lake: projectContract.lake ?? null
		, hostImportsSourceSha256: projectContract.hostImportsSourceSha256
		, reviewedSourceSha256: projectContract.review?.sha256 ?? null };
	return { objects, entries, env, api, evidence };
};
