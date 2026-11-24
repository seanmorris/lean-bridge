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
 */
export const prepareZendAuthorProject=async(root,component="workshop")=>{
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
	await writeFile(join(project,"ZendMembers.lean"),await readFile(resolve("tests/fixtures/php-wasm-task-owner/ZendMembers.lean")));
	cfg.targets={"php-wasm": {npm: {name: "@example/php-"+component,version: "1.0.0"},composer: {name: "example/php-"+component,version: "1.0.0"}}};
	await writeFile(main,source);await writeFile(configPath,canonicalJson(cfg));
	return {project,configPath,main,source,cfg};
};
