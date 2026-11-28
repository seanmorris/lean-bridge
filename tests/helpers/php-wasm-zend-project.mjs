/** @file Prepare the same real PHP import and Lean sources for compiler and installed-consumer tests. */
import {readFile,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";

/**
 * Create a root Lake project declaring the application host classes.
 *
 * @param root - Isolated test root.
 * @param component - Distinct Lake and package identity for an installed peer.
 * @param functions - Include ordinary Lean factories in the installed worker fixture.
 * @param [immediate] - Publish only immediate operations without any Lean tasks or streams.
 * @param [records] - Include the actual Lean structures used by the standalone record client.
 */
export const prepareZendAuthorProject=async(root,component="workshop",functions=false,immediate=false,records=false)=>{
	const project=join(root,"source"),configPath=join(project,"lean-bridge.exports.json"),main=join(project,"Workshop.lean");
	await prepareNativeHostFixture(project,"php");
	const fixture=resolve("tests/fixtures/php-host-tasks"),source="prelude\n"+await readFile(join(fixture,"Workshop.lean"),"utf8");
	const cfg=JSON.parse(await readFile(join(fixture,"lean-bridge.exports.json"),"utf8"));
	const imports=join(project,cfg.hostImports),hosts=JSON.parse(await readFile(imports,"utf8"));
	const ctor=hosts.declarations.find(d=>d.kind==="constructor");
	hosts.declarations.push({...ctor
		, id: ctor.owner+".fromValue"
		, name: "fromValue"
		, kind: "static-method"
		, overloadKey: "Box.fromValue"
		, documentation: {summary: "Call the PHP class factory.",details: ""}
		, source: {...ctor.source,declaration: "Box.fromValue"}});
	await writeFile(imports,canonicalJson(hosts));
	const lake=join(project,"lakefile.toml");await writeFile(lake,(await readFile(lake,"utf8")).replace('name = "workshop"','name = "'+component+'"')+'\n[[lean_lib]]\nname = "ZendMembers"\n');
	cfg.modules.push("ZendMembers");cfg.exports.push(...["makeBox","fromClass","getLevel","setLevel","sameBox","recoverRead"].map(n=>"Workshop."+n));
	let declarations=await readFile(resolve("tests/fixtures/php-wasm-task-owner/ZendMembers.lean"),"utf8");
	if(functions)
	{
		const closures=await readFile(resolve("tests/fixtures/c-host-closures/Closures.lean"),"utf8");
		declarations+="\n"+closures.slice(closures.indexOf("namespace Closures")).replaceAll("LeanBridge.Host.C","LeanBridge.Host.Php");
		cfg.exports.push("Closures.remember","Closures.reader","Closures.identityReader");
	}
	if(immediate)
	{
		delete cfg.taskExports;delete cfg.taskIOErrors;delete cfg.asyncIterators;
		cfg.nativeEffects=[];cfg.modules=["ZendMembers"];
		cfg.exports=["Workshop.makeBox","Workshop.fromClass","Workshop.getLevel"
			, "Workshop.setLevel","Workshop.sameBox","Workshop.recoverRead"
			, "Workshop.either","Workshop.checked"
			, ...functions?["Closures.remember","Closures.reader","Closures.identityReader"]:[]];
		declarations+="\nnamespace Workshop\nopen LeanBridge.Host.Php\n"
			+"def either (b : Box) : Except Box UInt32 := .error b\n"
			+"def checked (b : Box) : EIO Box UInt32 := throw b\nend Workshop\n";
	}
	await writeFile(join(project,"ZendMembers.lean"),declarations);
	if(records)
	{
		if(!immediate || component!=="workshop") throw new Error("Record fixture requires the standalone Workshop");
		const gauge=await readFile("tests/fixtures/dotnet-host-record/Workshop.lean","utf8");
		await writeFile(join(project,"Gauge.lean"),"prelude\n"+gauge.replaceAll("LeanBridge.Host.Dotnet","LeanBridge.Host.Php"));
		await writeFile(lake,(await readFile(lake,"utf8"))+'\n[[lean_lib]]\nname = "Gauge"\n');
		cfg.modules.push("Gauge");
		cfg.exports.push(...["createPair","flip","sumRead","choose","duplicateSample"].map(n=>"Gauge."+n));
	}
	cfg.targets={"php-wasm": {npm: {name: "@example/php-"+component,version: "1.0.0"},composer: {name: "example/php-"+component,version: "1.0.0"}}};
	await writeFile(main,immediate?"import ZendMembers\n":source);await writeFile(configPath,canonicalJson(cfg));
	return {project,configPath,main,source,cfg};
};
