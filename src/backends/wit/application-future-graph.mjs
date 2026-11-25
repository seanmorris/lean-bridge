/** @file Compose the resource-owning task interface without redefining its resource types. */
import { validateOrdinaryWasiSettings } from "./copied-model.mjs";

/**
 * Private native hooks only transport readiness. The consumer sees the
 * original nominal types, declared parameter names and ordinary WIT futures.
 *
 * @param o - Package coordinates, original object interface, selected methods and compiled components.
 */
export const objectFutureGraph=o=>{
	const {name,version,descriptor,methods,files}=o;
	validateOrdinaryWasiSettings({name,version});
	const rs=descriptor.contract.resources,iface=descriptor.interfaceName,exchange=iface.replace("/objects@","/exchange@");
	const slots=[...new Set(methods.flatMap(m=>[m.input,m.owner]))],inputs=new Set(methods.map(m=>m.input)),outputs=new Set(methods.map(m=>m.owner));
	const labels=new Set(methods.map(m=>m.name)),aliases=new Map();
	for(const i of slots)
	{
		let alias=rs[i].name;while(labels.has(alias))alias="lb-"+alias;
		labels.add(alias);aliases.set(i,alias);
	}
	const api="lean-bridge:"+name+"/object-tasks@"+version;
	const parts=[
		"(component",`(import "${iface}" (instance $o`
		, ...slots.map(i=>`(export "${rs[i].name}" (type $r${i} (sub resource)))`)
		, ...[...inputs].map(i=>`(export "${rs[i].retain}" (func (param "value" (borrow $r${i})) (result (own $r${i}))))`)
		, "))"
		, ...slots.map(i=>`(alias export $o "${rs[i].name}" (type $r${i}))`)
		, `(import "${exchange}" (instance $x`
		, ...[...inputs].map(i=>`(export "put-item${i}" (func (param "value" (own $r${i}))))`)
		, ...[...outputs].map(i=>`(export "take-item${i}" (func (result (own $r${i}))))`)
		, "))"
	];
	methods.forEach(({name: n,input: a,owner: z,shape},j)=>{
		const types=[...new Set([a,z])].map(i=>`(with "r${i}" (type $r${i}))`).join(" ");
		const stage=shape==="factory"?" (result u32)":shape==="returned"?" (result (option u32))":"";
		parts.push(`(import "${n}-native-start" (func $start${j} (result u32)))`,`(import "${n}-native-stage" (func $stage${j} (param "key" u32)${stage}))`);
		parts.push(files[n+"-ports.wat"].replace("(component","(component $ports"+j),files[n+"-future.wat"].replace("(component","(component $future"+j));
		parts.push(`(instance $p${j} (instantiate $ports${j} ${types} (with "retain" (func $o "${rs[a].retain}")) (with "put" (func $x "put-item${a}")) (with "take" (func $x "take-item${z}")) (with "start-native" (func $start${j})) (with "stage" (func $stage${j}))))`);
		parts.push(`(instance $f${j} (instantiate $future${j} ${types} (with "begin" (func $p${j} "begin")) (with "peek" (func $p${j} "peek"))))`);
		parts.push(...["deliver","reap","retire"].map(port=>`(export "${n}-${port}" (func $f${j} "${port}"))`));
	});
	parts.push("(instance $api",...slots.map(i=>`(export "${aliases.get(i)}" (type $r${i}))`));
	parts.push(...methods.map((m,j)=>`(export "${m.name}" (func $f${j} "start"))`),")",`(export "${api}" (instance $api)))`);
	const uses=slots.map(i=>"%"+rs[i].name+(aliases.get(i)===rs[i].name?"":" as %"+aliases.get(i)));
	const type=m=>{
		const owned=`own<%${aliases.get(m.owner)}>`;
		if(m.shape==="factory")return `result<future<u32>, ${owned}>`;
		return m.shape==="returned"?`future<result<u32, ${owned}>>`:`future<${owned}>`;
	};
	const wit=[`package lean-bridge:${name}@${version};`,"interface object-tasks {"
		, ...uses.length?[`  use ${iface}.{${uses.join(", ")}};`]:[]
		, ...methods.map(m=>`  %${m.name}: func(%${m.param}: borrow<%${aliases.get(m.input)}>) -> ${type(m)};`)
		, "}","world task-consumer { import object-tasks; }"].join("\n");
	return {api,wit,wat: parts.join("\n")};
};
