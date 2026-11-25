/** @file Compose the resource-owning task interface without redefining its resource types. */
import { validateOrdinaryWasiSettings } from "./copied-model.mjs";

/**
 * Private native hooks only transport readiness. The consumer sees the
 * original nominal types, declared parameter names and ordinary WIT futures.
 *
 * @param o - Package coordinates, original object interface, selected methods and compiled components.
 */
export const objectFutureGraph=o=>{
	const {name,version,descriptor,methods,files,callbacks}=o;
	validateOrdinaryWasiSettings({name,version});
	const orig=descriptor.contract.resources,iface=descriptor.interfaceName,exchange=iface.replace("/objects@","/exchange@");
	const rs=[...orig,{name: descriptor.contract.error},...callbacks.exchange.slots.map(s=>({name: s.type,retain: "retain-"+s.type}))];
	const methodSlots=m=>[...new Set([m.input,m.owner,...m.err!=null?[m.err]:[],...m.cb!=null?[m.cb]:[]])];
	const relays=methods.filter(m=>m.shape==="callback"),slots=[...new Set(methods.flatMap(methodSlots))];
	const objects=slots.filter(i=>i<=orig.length),registrations=slots.filter(i=>i>orig.length);
	const inputs=new Set(methods.map(m=>m.input)),outputs=new Set(methods.flatMap(m=>m.err!=null?[m.owner,m.err]:[m.owner]));
	const labels=new Set(methods.map(m=>m.name)),aliases=new Map();
	for(const i of slots)
	{
		let alias=rs[i].name;while(labels.has(alias))alias="lb-"+alias;
		labels.add(alias);aliases.set(i,alias);
	}
	const api="lean-bridge:"+name+"/object-tasks@"+version;
	let failure="callback-failure";while(labels.has(failure))failure="lb-"+failure;
	const parts=[
		"(component",`(import "${iface}" (instance $o`
		, ...objects.map(i=>`(export "${rs[i].name}" (type $r${i} (sub resource)))`)
		, ...[...inputs].map(i=>`(export "${rs[i].retain}" (func (param "value" (borrow $r${i})) (result (own $r${i}))))`)
		, "))"
		, ...objects.map(i=>`(alias export $o "${rs[i].name}" (type $r${i}))`)
		, `(import "${exchange}" (instance $x`
		, ...[...inputs].map(i=>`(export "put-item${i}" (func (param "value" (own $r${i}))))`)
		, ...[...outputs].map(i=>`(export "take-item${i}" (func (result (own $r${i}))))`)
		, "))"
	];
	if(relays.length)parts.push(`(import "${callbacks.interfaceName}" (instance $cb`
		, ...registrations.map(i=>`(export "${rs[i].name}" (type $r${i} (sub resource)))`)
		, ...registrations.map(i=>`(export "${rs[i].retain}" (func (param "value" (borrow $r${i})) (result (own $r${i}))))`),"))"
		, ...registrations.map(i=>`(alias export $cb "${rs[i].name}" (type $r${i}))`)
		, `(import "${callbacks.exchange.name}" (instance $cx`
		, ...registrations.map(i=>`(export "put-item${i-orig.length-1}" (func (param "value" (own $r${i}))))`),"))"
		, `(type $failure (variant (case "callback" (own $r${orig.length})) (case "io" string)))`);
	methods.forEach(({name: n,input: a,owner: z,shape,cb,err,idx},j)=>{
		const relay=shape==="callback",stream=shape==="stream";
		const types=methodSlots(methods[j]).map(i=>`(with "r${i}" (type $r${i}))`).join(" ")+(relay?' (with "failure" (type $failure))':"");
		const stage=relay?" (result (result u32 (error string)))":shape==="factory"||stream?" (result u32)":shape==="returned"?" (result (option u32))":"";
		parts.push(`(import "${n}-native-start" (func $start${j} (result u32)))`,`(import "${n}-native-stage" (func $stage${j} (param "key" u32)${stage}))`);
		if(stream)parts.push(`(import "${n}-native-act" (func $act${j} (param "key" u32) (param "op" u32) (result u32)))`);
		parts.push(files[n+"-ports.wat"].replace("(component","(component $ports"+j),files[n+(stream?"-stream.wat":"-future.wat")].replace("(component","(component $future"+j));
		const extra=(relay?`(with "retain-callback" (func $cb "${rs[cb].retain}")) (with "put-callback" (func $cx "put-item${idx}")) `:"")+(err!=null?`(with "take-error" (func $x "take-item${err}"))`:"");
		parts.push(`(instance $p${j} (instantiate $ports${j} ${types} (with "retain" (func $o "${rs[a].retain}")) (with "put" (func $x "put-item${a}")) (with "take" (func $x "take-item${z}")) ${extra} (with "start-native" (func $start${j})) (with "stage" (func $stage${j}))))`);
		parts.push(`(instance $f${j} (instantiate $future${j} ${types} (with "begin" (func $p${j} "begin")) (with "peek" (func $p${j} "peek"))${stream?` (with "act" (func $act${j}))`:""}))`);
		parts.push(...(stream?["pump","retire"]:["deliver","reap","retire"]).map(port=>`(export "${n}-${port}" (func $f${j} "${port}"))`));
	});
	parts.push("(instance $api",...slots.map(i=>`(export "${aliases.get(i)}" (type $r${i}))`));
	if(relays.length)parts.push(`(export "${failure}" (type $failure))`);
	parts.push(...methods.map((m,j)=>`(export "${m.name}" (func $f${j} "start"))`),")",`(export "${api}" (instance $api)))`);
	const uses=rows=>rows.map(i=>"%"+rs[i].name+(aliases.get(i)===rs[i].name?"":" as %"+aliases.get(i))).join(", ");
	const type=m=>{
		const owned=`own<%${aliases.get(m.owner)}>`;
		if(m.shape==="stream")return m.err===null?`stream<${owned}>`:`stream<result<${owned}, own<%${aliases.get(m.err)}>>>`;
		if(m.shape==="callback")return `future<result<${owned}, %${failure}>>`;
		if(m.shape==="factory")return `result<future<u32>, ${owned}>`;
		return m.shape==="returned"?`future<result<u32, ${owned}>>`:`future<${owned}>`;
	};
	const wit=[`package lean-bridge:${name}@${version};`,"interface object-tasks {"
		, ...objects.length?[`  use ${iface}.{${uses(objects)}};`]:[]
		, ...relays.length?[`  use callbacks.{${uses(registrations)}};`,`  variant %${failure} { callback(own<%${aliases.get(orig.length)}>), io(string) }`]:[]
		, ...methods.map(m=>`  %${m.name}: func(%${m.param}: borrow<%${aliases.get(m.input)}>${m.shape==="callback"?`, %${m.callbackParam}: borrow<%${aliases.get(m.cb)}>`:""}) -> ${type(m)};`)
		, "}","world task-consumer { import object-tasks; }"].join("\n");
	return {api,wit,wat: parts.join("\n")};
};
