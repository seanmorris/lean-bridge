/** @file Prepare independently authored WIT packages sharing one defining guest contract. */
import {copyFile,mkdir,readFile,rename,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {witCoreInterface} from "../../src/backends/wit/application-operations.mjs";

/**
 * Select distinct Lean modules and package coordinates; do not copy a compiled library.
 *
 * @param project - Fresh package source directory.
 * @param name - Workshop returns a box and Gauge mutates or throws it.
 */
export const prepareWitPeerProject=async(project,name)=>{
	await prepareNativeHostFixture(project,"wit-wasi");
	await copyFile("LICENSE",join(project,"LICENSE"));
	const path=join(project,"lean-bridge.exports.json"),config=JSON.parse(await readFile(path,"utf8"));
	if(name==="gauge")
	{
		const lake=join(project,"lakefile.toml");
		await writeFile(lake,(await readFile(lake,"utf8")).replace('"workshop"','"gauge"').replace('"Workshop"','"Gauge"'));
		await rename(join(project,"Workshop.lean"),join(project,"Gauge.lean"));
		await copyFile("tests/fixtures/static-host-workers/Gauge.lean",join(project,"Gauge.lean"));
		config.modules=["Gauge"];config.exports=["Gauge.increase","Gauge.reject"];
	}else if(name==="workshop")config.exports=["Workshop.choose","Workshop.mapped"];
	else throw new TypeError("Unknown peer fixture: "+name);
	config.targets["wit-wasi"].name=name;await writeFile(path,canonicalJson(config));
};

/**
 * Compile the actual defining guest and a client of both packages.
 *
 * @param wit - Installed defining WIT file.
 * @param out - Separate application build directory.
 * @param run - Invoke wasm-tools in the output directory.
 */
export const buildWitPeerGuests=async(wit,out,run)=>{
	const prefix=/^package ([^;]+)@1\.0\.0;/u.exec(await readFile(wit,"utf8"))[1];
	const iface=prefix+"/objects@1.0.0",fixture=n=>readFile("tests/fixtures/static-host-workers/"+n+".wat.in","utf8");
	// Count every actual canonical box acquisition and release in its defining guest.
	const owner=(await fixture("guest-box")).replaceAll("@IFACE@",witCoreInterface(iface))
		.replace('"box_new" (func $new','"box_new" (func $allocate')
		.replace('"member-error_new" (func $error','"member-error_new" (func $allocate-error')
		.replace('(global $armed','(global $live (mut i32) (i32.const 0))\n'+[["new","allocate"],["error","allocate-error"]].map(([n,f])=>'(func $'+n+' (param i32) (result i32) (global.set $live (i32.add (global.get $live) (i32.const 1))) (call $'+f+' (local.get 0)))').join("\n")+'\n  (global $armed')
		.replace(';; @installed-drop-observer@','(if (i32.eq (i32.load (local.get $p)) (i32.const 77777)) (then (return (call $result (i32.const 0) (global.get $live)))))')
		.replace(';; @test-drop-notify@','(if (i32.eqz (global.get $live)) (then unreachable)) (global.set $live (i32.sub (global.get $live) (i32.const 1)))');
	await writeFile(join(out,"objects.wat"),owner);
	await run("component","embed",wit,"--world","owner","objects.wat","-o","owner.core");
	await run("component","new","owner.core","-o","objects.wasm");
	// Both definitions come from identical bytes. Export the second instance's
	// retain method alongside the first one's box: this is a valid component,
	// but its retain-box cannot satisfy the first facade's resource import.
	const definition=(await run("print","objects.wasm")).stdout.replace("(component","(component $definition");
	const names=["lean-unit","lean-int","box","member-error"];
	const wrongOwner=["(component",definition
		, "(instance $a (instantiate $definition)) (instance $b (instantiate $definition))"
		, '(alias export $a "'+iface+'" (instance $one)) (alias export $b "'+iface+'" (instance $two))'
		, "(instance $mixed"
		, ...names.map(n=>'(export "'+n+'" (type $one "'+n+'"))')
		, '(export "other-box" (type $two "box"))'
		, '(export "retain-box" (func $two "retain-box"))) (export "'+iface+'" (instance $mixed)))'].join("\n");
	await writeFile(join(out,"foreign-owner.wat"),wrongOwner);await run("parse","foreign-owner.wat","-o","foreign-owner.wasm");await run("validate","foreign-owner.wasm");
	const client=(await fixture("installed-peers")).replaceAll("@OBJECTS@",iface);
	await writeFile(join(out,"application.wat"),client);await run("parse","application.wat","-o","application.wasm");await run("validate","application.wasm");
	const foreign=client.replace('(alias export $owner "box" (type $b))','(alias export $owner "box" (type $b)) (alias export $owner "member-error" (type $foreign))')
		.replace('(type $gb (eq $b))','(type $gb (eq $foreign))');
	const privateGuest=client.replace("(component",'(component (import "private-exchange" (instance))');
	const wrong='(component (core module $m (func (export "f") (result i32) unreachable)) (core instance $i (instantiate $m)) (func (export "run") (result u32) (canon lift (core func $i "f"))))';
	for(const [id,source] of [["foreign",foreign],["private",privateGuest],["wrong-run",wrong]])
	{
		await writeFile(join(out,id+".wat"),source);await run("parse",id+".wat","-o",id+".wasm");await run("validate",id+".wasm");
	}
};

/**
 * Type-check the documented downstream world against the extracted package WIT,
 * including the original resource import and both public interfaces.
 *
 * @param workshop - Workshop's installed WIT directory.
 * @param gauge - Gauge's installed WIT directory.
 * @param out - Guest build directory containing application.wasm.
 * @param run - Invoke wasm-tools in the guest build directory.
 */
export const checkWitPeerWorld=async(workshop,gauge,out,run)=>{
	const world=join(out,"wit"),deps=join(world,"deps");
	for(const n of ["workshop","gauge"])await mkdir(join(deps,n),{recursive: true});
	await copyFile(join(workshop,"deps/objects.wit"),join(deps,"objects.wit"));
	for(const f of ["api.wit","application.wit"])await copyFile(join(workshop,f),join(deps,"workshop",f));
	await copyFile(join(gauge,"api.wit"),join(deps,"gauge/api.wit"));
	await copyFile("tests/fixtures/static-host-workers/peer-world.wit",join(world,"world.wit"));
	await run("component","targets",world,"--world","meters","application.wasm");
};
