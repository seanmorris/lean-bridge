/** @file Build an ordinary or reviewed C-family callback budget package from the Lean fixtures. */
import {appendFile,copyFile,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";

const common=resolve("tests/fixtures/javascript-once-callback"),extra=resolve("tests/fixtures/native-callback-budget");
export const nativeBudgetReview="The callback allowance belongs to this task and source parameter.";
/**
 * Remove the author tree after sealing the original package receipt and archive.
 *
 * @param options - Work directory, destination, native target, route and verified ordinary interface.
 */
export const buildNativeBudget=async options=>{
	const {work,set,target,route,ordinary}=options;
	const project=join(work,target+"-"+route+"-project"),out=join(work,target+"-"+route+"-out");await mkdir(project);
	for(const f of ["Budget.lean","lean-toolchain","lakefile.toml"]) await copyFile(join(common,f),join(project,f));
	await copyFile(join(extra,"Racing.lean"),join(project,"Racing.lean"));
	await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname = "Racing"\n');
	const cfg=JSON.parse(await readFile(join(common,"lean-bridge.exports.json")));
	cfg.modules.push("Racing");
	const declarations=["Racing.duringStart","Racing.race","Racing.replace"];
	const extraModules=["rubygems","nuget","maven","php-native","cpan","wit-wasi"].includes(target)?["TypedBudget","FactoryFault"]:target==="cargo"?["TypedBudget"]:[];
	for(const module of extraModules)
	{
		await copyFile(join(extra,module+".lean"),join(project,module+".lean"));
		await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname = "'+module+'"\n');
		cfg.modules.push(module);declarations.push(module+(module==="TypedBudget"?".checked":".start"));
	}
	for(const n of declarations)
	{
		cfg.taskExports.push(n);cfg.taskIOErrors.push(n);
		cfg.taskCallbackPolicies.push({declaration: n,parameter: "f",invocation: "once"});
	}
	const names={maven: "org.leanbridge:callback-budget","php-native": "example/callback-budget","wit-wasi": "budget"};
	cfg.targets={[target]: target==="cpan"?{module: "LeanBridge::Budget",version: "0.001"}:{name: names[target]??target+"-budget",version: "1.0.0"}};
	if(options.canonical)
	{
		if(target!=="wit-wasi") throw new TypeError("Only WIT has a canonical task ABI");
		cfg.targets[target].asyncAbi="canonical";
	}
	if(route==="ordinary") cfg.exports=cfg.taskExports;
	else
	{
		const api=structuredClone(ordinary);api.documentation.summary=nativeBudgetReview;
		await writeFile(join(project,"public.binding-ir.json"),canonicalJson(api));
	}
	await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(cfg));
	try
	{await buildCanonicalProject({projectRoot: project,outputRoot: out,targets: [target]});}
	catch(e)
	{throw new Error(e.message+" "+JSON.stringify(e.details),{cause: e});}
	const api=JSON.parse(await readFile(join(out,"binding-ir.json")));
	await copyPackageSetHandoff(out,set);await rm(project,{recursive: true});await rm(out,{recursive: true});
	return api;
};
