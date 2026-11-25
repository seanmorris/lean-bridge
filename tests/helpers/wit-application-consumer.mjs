/** @file Link an independently built Wasm application to compiled Lean and a guest object owner. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { witApplicationExchange } from "../../src/backends/wit/application-exchange.mjs";

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
	const ops=name.replace("/objects@","/operations@");
	const signatures=`interface operations {
  use objects.{box, member-error};
  first-error: func(a: u32, b: u32) -> result<own<box>, own<member-error>>;
  update: func(object: borrow<box>, value: u32) -> result<u32, own<member-error>>;
}
world bridge {
  import objects;
  import exchange;
  import dispatch-create: func(a: u32, b: u32) -> bool;
  import dispatch-update: func(value: u32) -> result<u32>;
  export operations;
}
world application {
  import objects;
  import operations;
  export exercise: func(seed: u32, next: u32) -> u32;
}`;
	await writeFile(join(app,"consumer.wit"),[await readFile(join(app,"exchange.wit"),"utf8"),signatures].join("\n"));
	const compile=async(world,source)=>{
		await writeFile(join(app,world+".wat"),source);
		await run(wasm,["component","embed","consumer.wit","--world",world,world+".wat","-o",world+".core"]);
		await run(wasm,["component","new",world+".core","-o",world+".wasm"]);
		const {stdout}=await run(wasm,["print",world+".wasm"]);
		return stdout.replace("(component","(component $"+world);
	};
	const asset=async file=>(await readFile(join(fixture,file+".wat.in"),"utf8"))
		.replaceAll("@IFACE@",name.replace("@1.0.0","@1"))
		.replaceAll("@OPS@",ops.replace("@1.0.0","@1"))
		.replaceAll("@EXCHANGE@",x.name.replace("@1.0.0","@1"));
	const owner=(await run(wasm,["print","guest.wasm"])).stdout.replace("(component","(component $owner");
	const storage=await compile("exchange-storage",await readFile(join(app,"exchange.wat"),"utf8"));
	const bridge=await compile("bridge",await asset("lean-operations"));
	const application=await compile("application",await asset("lean-consumer"));
	const graph=[
		"(component"
		, '(import "dispatch-create" (func $create (param "a" u32) (param "b" u32) (result bool)))'
		, '(import "dispatch-update" (func $update (param "value" u32) (result (result u32))))'
		, owner,storage,bridge,application
		, "(instance $o (instantiate $owner))"
		, `(alias export $o "${name}" (instance $objects))`
		, ...x.slots.map(s=>`(alias export $objects "${s.type}" (type $${s.alias}))`)
		, `(instance $cells (instantiate $exchange-storage (with "${name}" (instance $objects)) ${x.slots.map(s=>`(with "${s.alias}" (type $${s.alias}))`).join(" ")}))`
		, "(instance $exchange "+x.slots.flatMap(s=>[`(export "${s.alias}" (type $${s.alias}))`,...[s.put,s.take].map(f=>`(export "${f}" (func $cells "${f}"))`)]).join(" ")+")"
		, `(instance $b (instantiate $bridge (with "${name}" (instance $objects)) (with "${x.name}" (instance $exchange)) (with "dispatch-create" (func $create)) (with "dispatch-update" (func $update))))`
		, `(instance $client (instantiate $application (with "${name}" (instance $objects)) (with "${ops}" (instance $b "${ops}"))))`
		, '(export "exercise" (func $client "exercise"))'
		, '(export "drops" (func $o "drops"))'
		, `(export "${name}" (instance $objects))`
		, '(export "private-exchange" (instance $exchange))'
		, ")"
	].join("\n");
	await writeFile(join(app,"client-graph.wat"),graph);
	await run(wasm,["parse","client-graph.wat","-o","client-graph.wasm"]);
	await run(wasm,["validate","client-graph.wasm"]);
};
