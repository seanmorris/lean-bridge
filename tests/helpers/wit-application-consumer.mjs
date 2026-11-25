/** @file Link an independently built Wasm application to compiled Lean and a guest object owner. */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { witApplicationExchange } from "../../src/backends/wit/application-exchange.mjs";
import { witCoreInterface } from "../../src/backends/wit/application-operations.mjs";

/**
 * Build the owner, exchange, facade and user as distinct typed components.
 *
 * @param o - Captured paths, interface, wasm-tools and checked process runner.
 * @param o.app - Build directory containing the staged exchange and defining guest.
 * @param o.fixture - Source directory of the facade and independent application.
 * @param o.descriptor - WIT imports derived from the compiled Lean application.
 * @param o.wasm - Pinned wasm-tools executable.
 * @param o.run - Checked process runner in the private build directory.
 */
export const buildWitApplicationConsumer = async ({app,fixture,descriptor,wasm,run}) => {
	const x=witApplicationExchange(descriptor),{interfaceName: name}=descriptor;
	const {publicName: ops,nativeName,nativeType,methods}=JSON.parse(await readFile(join(app,"operations-layout.json"),"utf8"));
	for(const dir of ["wit-api","wit-user"])await mkdir(join(app,dir,"deps"),{recursive: true});
	await copyFile(join(app,"exchange.wit"),join(app,"wit-api/deps/objects.wit"));
	await writeFile(join(app,"wit-user/deps/objects.wit"),descriptor.wit);
	await copyFile(join(app,"operations.wit"),join(app,"wit-api/api.wit"));
	await copyFile(join(app,"api.wit"),join(app,"wit-user/deps/api.wit"));
	await writeFile(join(app,"wit-user/user.wit"),`package demo:consumer; world application {
  import ${name}; use ${name}.{box}; import ${ops}; export exercise: func(seed: u32, next: u32) -> u32; export suite: func() -> u32; export bad-input: func(value: borrow<box>);
}`);
	const compile=async(world,source,path)=>{
		await writeFile(join(app,world+".wat"),source);
		await run(wasm,["component","embed",path,"--world",world,world+".wat","-o",world+".core"]);
		await run(wasm,["component","new",world+".core","-o",world+".wasm"]);
		const {stdout}=await run(wasm,["print",world+".wasm"]);
		return stdout.replace("(component","(component $"+world);
	};
	const asset=async file=>(await readFile(join(fixture,file+".wat.in"),"utf8"))
		.replaceAll("@IFACE@",witCoreInterface(name))
		.replaceAll("@OPS@",witCoreInterface(ops));
	await writeFile(join(app,"observed.wit"),descriptor.wit+"\nworld observed { import observe-drop: func(); export objects; export drops: func() -> u32; export arm-drop: func(); }");
	const owner=await compile("observed",(await asset("guest-box"))
		.replace(";; @test-drop-import@",'(import "cm32p2" "observe-drop" (func $notify))')
		.replace(";; @test-drop-notify@","(call $notify)"),"observed.wit");
	const storage=await compile("exchange-storage",await readFile(join(app,"exchange.wat"),"utf8"),"exchange.wit");
	const bridge=await compile("bridge",await readFile(join(app,"operations.wat"),"utf8"),"wit-api");
	const application=await compile("application",await asset("lean-consumer"),"wit-user");
	const userCore=(await run(wasm,["print","application.core"])).stdout;
	const prefix='(import "cm32p2|'+witCoreInterface(ops)+'" "';
	const imported=userCore.split("\n").map(line=>line.trimStart()).filter(line=>line.startsWith(prefix)).map(line=>line.slice(prefix.length).split('"')[0]);
	assert.deepEqual(imported.sort(),methods.map(m=>m.name).sort(),"independent app must import every generated synchronous operation");
	const graph=[
		"(component"
		, `(type $native-type ${nativeType}) (import "${nativeName}" (instance $native (type $native-type)))`
		, '(import "observe-drop" (func $observe))'
		, owner,storage,bridge,application
		, '(instance $o (instantiate $observed (with "observe-drop" (func $observe))))'
		, `(alias export $o "${name}" (instance $objects))`
		, `(export "${name}" (instance $objects))`
		, ...x.slots.map(s=>`(alias export $objects "${s.type}" (type $${s.alias}))`)
		, `(instance $cells (instantiate $exchange-storage (with "${name}" (instance $objects)) ${x.slots.map(s=>`(with "${s.alias}" (type $${s.alias}))`).join(" ")}))`
		, "(instance $exchange "+x.slots.flatMap(s=>[`(export "${s.alias}" (type $${s.alias}))`,...[s.put,s.take].map(f=>`(export "${f}" (func $cells "${f}"))`)]).join(" ")+")"
		, `(instance $b (instantiate $bridge (with "${name}" (instance $objects)) (with "${x.name}" (instance $exchange)) (with "${nativeName}" (instance $native))))`
		, `(export "${ops}" (instance $b "${ops}"))`
		, `(instance $client (instantiate $application (with "${name}" (instance $objects)) (with "box" (type $item0)) (with "${ops}" (instance $b "${ops}"))))`
		, '(export "exercise" (func $client "exercise"))'
		, '(export "suite" (func $client "suite"))'
		, '(export "bad-input" (func $client "bad-input"))'
		, '(export "drops" (func $o "drops"))'
		, '(export "private-exchange" (instance $exchange))'
		, ")"
	].join("\n");
	await writeFile(join(app,"client-graph.wat"),graph);
	await run(wasm,["parse","client-graph.wat","-o","client-graph.wasm"]);
	await run(wasm,["validate","client-graph.wasm"]);
	const delivery=JSON.parse(await readFile(join(app,"object-delivery.json"),"utf8"));
	const supported=delivery.supported;
	const cbLayout=JSON.parse(await readFile(join(app,"object-callbacks.json"),"utf8")),{interfaceName: cbName}=cbLayout;
	assert.equal(cbLayout.signatures[cbLayout.sites["Jobs.relay#1"]].label,"call-box-to-box");
	const cbWit=await readFile(join(app,"object-callbacks.wit"),"utf8"),cbDir=join(app,"wit-callback");
	await mkdir(join(cbDir,"deps"),{recursive: true});await writeFile(join(cbDir,"deps/objects.wit"),descriptor.wit);
	await copyFile(join(app,"api.wit"),join(cbDir,"api.wit"));
	const extra=cbWit.replace("resource %call-box-to-box {","resource %call-box-to-box { make: static func(mode: u32) -> own<%call-box-to-box>;");
	await writeFile(join(cbDir,"cb.wit"),extra+`\nworld callback-fixture { import ${name}; import api; import inside-callback: func(); export callbacks; export callback-drops: func() -> u32; export callback-visits: func() -> u32; }`);
	const callback=await compile("callback-fixture",(await asset("guest-callback")).replaceAll("@CALLS@",witCoreInterface(cbName)),"wit-callback");
	// Check the exported callbacks against the production contract, without
	// the test factory that lets this probe construct the guest's registrations.
	await writeFile(join(cbDir,"cb.wit"),cbWit+`\nworld examined { import ${name}; import api; import inside-callback: func(); export callbacks; }`);
	await run(wasm,["component","targets","wit-callback","--world","examined","callback-fixture.wasm"]);
	assert.deepEqual(supported.map(m=>[m.name,m.shape]),[["accept","factory"],["completed","returned"],["echo","owned"],["outcome","returned"],["reject","factory"],["relay","callback"],["relay-late","callback"]]);
	assert.deepEqual(delivery.remaining,["Jobs.series"]);
	const component=async(file,id)=>{const data=await readFile(join(app,file),"utf8");return data.replace("(component","(component $"+id);};
	await writeFile(join(app,"reader.wat"),(await asset("lean-future-consumer")).replace("@TASKS@",delivery.publicName));
	await run(wasm,["parse","reader.wat","-o","reader.wasm"]);
	await writeFile(join(app,"fault-reader.wat"),(await asset("lean-failure-consumer")).replace("@TASKS@",delivery.publicName));
	await run(wasm,["parse","fault-reader.wat","-o","fault-reader.wasm"]);
	await writeFile(join(app,"relay-reader.wat"),(await asset("lean-relay-consumer")).replace("@TASKS@",delivery.publicName));
	await run(wasm,["parse","relay-reader.wat","-o","relay-reader.wasm"]);
	await mkdir(join(app,"wit-future/deps"),{recursive: true});
	await writeFile(join(app,"wit-future/deps/objects.wit"),descriptor.wit);
	await copyFile(join(app,"object-tasks.wit"),join(app,"wit-future/tasks.wit"));
	await copyFile(join(app,"object-callbacks.wit"),join(app,"wit-future/callbacks.wit"));
	await writeFile(join(app,"wit-future/fixture.wit"),`package lean-bridge:workshop@1.0.0;
world future-probe {
  import object-tasks; use object-tasks.{box};
  import source: func() -> own<box>; import same: func(left: borrow<box>, right: borrow<box>) -> bool;
  export start: func(); export discard: func(); export receive: func() -> bool;
  export request: func(); export collect: func() -> bool; export release-original: func();
}
world failure-probe {
  import object-tasks; use object-tasks.{box};
  import source: func() -> own<box>; import same: func(left: borrow<box>, right: borrow<box>) -> bool;
  export reject: func(); export start-case: func(mode: u32); export discard-case: func(); export receive-case: func();
}
world relay-probe {
  import object-tasks; use object-tasks.{box, member-error, call-box-to-box};
  import source: func() -> own<box>; import register: func(mode: u32) -> own<call-box-to-box>;
  import same: func(left: borrow<box>, right: borrow<box>) -> bool; import message: func(self: borrow<member-error>) -> string;
  export begin: func(mode: u32); export discard: func(); export receive: func();
  export request: func(); export collect: func();
}`);
	await run(wasm,["component","targets","wit-future","--world","relay-probe","relay-reader.wasm"]);
	await run(wasm,["component","targets","wit-future","--world","future-probe","reader.wasm"]);
	await run(wasm,["component","targets","wit-future","--world","failure-probe","fault-reader.wasm"]);
	const fault=(await run(wasm,["print","fault-reader.wasm"])).stdout.replace("(component","(component $fault");
	const client=id=>`(instance $${id} (instantiate $fault (with "${delivery.publicName}" (instance $f "${delivery.publicName}")) (with "source" (func $cells "take-item0")) (with "same" (func $objects "same-box"))))`;
	const hooks=supported.flatMap(m=>[[m.name+"-native-start","(result u32)"],[m.name+"-native-stage",'(param "key" u32) '+(m.shape==="callback"?"(result (result u32 (error string)))":m.shape==="factory"?"(result u32)":m.shape==="returned"?"(result (option u32))":"")]]);
	const user=(await run(wasm,["print","reader.wasm"])).stdout.replace("(component","(component $reader");
	const futureGraph=[
		"(component"
		, `(type $native-type ${nativeType}) (import "${nativeName}" (instance $native (type $native-type)))`
		, '(import "observe-drop" (func $observe))'
		, '(import "inside-callback" (func $inside))'
		, ...hooks.map(([n,type])=>`(import "${n}" (func $${n} ${type}))`)
		, graph.replace("(component","(component $base")
		, await component("object-tasks.wat","tasks")
		, await component("relay-reader.wat","relay-client")
		, await component("callback-exchange.wat","callback-storage")
		, (await asset("guest-registration")).replace("(component","(component $registrations")
		, user,fault,callback
		, `(instance $g (instantiate $base (with "${nativeName}" (instance $native)) (with "observe-drop" (func $observe))))`
		, `(alias export $g "${name}" (instance $objects)) (export "${name}" (instance $objects))`
		, '(alias export $g "private-exchange" (instance $cells)) (alias export $objects "box" (type $box))'
		, `(instance $cb (instantiate $callback-fixture (with "${name}" (instance $objects)) (with "${ops}" (instance $g "${ops}")) (with "inside-callback" (func $inside))))`
		, `(export "${cbName}" (instance $cb "${cbName}")) (export "callback-drops" (func $cb "callback-drops")) (export "callback-visits" (func $cb "callback-visits"))`
		, `(alias export $cb "${cbName}" (instance $provider)) (alias export $provider "call-box-to-box" (type $registration))`
		, `(instance $cs (instantiate $callback-storage (with "${cbName}" (instance $provider))))`
		, `(alias export $cs "${cbLayout.exchange.name}" (instance $cx)) (export "${cbLayout.exchange.name}" (instance $cx))`
		, '(instance $registrar (instantiate $registrations (with "registration" (type $registration)) (with "make" (func $provider "[static]call-box-to-box.make")) (with "put" (func $cx "put-item0"))))'
		, '(export "create-registration" (func $registrar "create"))'
		, `(instance $f (instantiate $tasks (with "${name}" (instance $objects)) (with "${x.name}" (instance $cells)) (with "${cbName}" (instance $provider)) (with "${cbLayout.exchange.name}" (instance $cx)) ${hooks.map(([n])=>`(with "${n}" (func $${n}))`).join(" ")}))`
		, ...["rc","rc2"].map(id=>`(instance $${id} (instantiate $relay-client (with "${delivery.publicName}" (instance $f "${delivery.publicName}")) (with "source" (func $cells "take-item0")) (with "register" (func $provider "[static]call-box-to-box.make")) (with "same" (func $objects "same-box")) (with "message" (func $objects "[method]member-error.message"))))`)
		, ...["begin","discard","receive","request","collect"].map(n=>`(export "guest-relay-${n}" (func $rc "${n}"))`)
		, ...["begin","receive"].map(n=>`(export "second-relay-${n}" (func $rc2 "${n}"))`)
		, `(instance $u (instantiate $reader (with "${delivery.publicName}" (instance $f "${delivery.publicName}")) (with "source" (func $cells "take-item0")) (with "same" (func $objects "same-box"))))`
		, client("v"),client("v2")
		, ...supported.flatMap(m=>["deliver","reap","retire"].map(n=>`(export "${m.name}-${n}" (func $f "${m.name}-${n}"))`))
		, ...["reject","start-case","receive-case","discard-case"].map(n=>`(export "${n}" (func $v "${n}"))`)
		, ...["start-case","receive-case"].map(n=>`(export "second-${n}" (func $v2 "${n}"))`)
		, ...["start","receive","request","collect","discard","release-original"].map(n=>`(export "${n}" (func $u "${n}"))`)
		, '(export "private-exchange" (instance $cells)) (export "drops" (func $g "drops")))'
	].join("\n");
	await writeFile(join(app,"future-graph.wat"),futureGraph);
	await run(wasm,["parse","future-graph.wat","-o","future-graph.wasm"]);
	await run(wasm,["validate","--features","cm-async,cm-async-builtins","future-graph.wasm"]);
};
