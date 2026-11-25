/** @file Compose independently built object, callback and application components with the compiled Lean facade. */
import {canonicalSupervisor} from "./canonical-supervisor.mjs";
import {witApplicationExchange} from "./application-exchange.mjs";
import {witTurnOwners} from "./application-turn-owners.mjs";
import {cIdentifier} from "../c/generate.mjs";

const fail=message=>{throw new TypeError("WIT application command: "+message);};
const nested=(wat,id,role)=>{
	if(typeof wat!=="string" || !wat.startsWith("(component"))fail("missing component: "+id);
	return wat.replace("(component","(component $"+id+(role?' (@custom "lean-bridge-guest-slot-v1" "'+role+'")':""));
};
/**
 * The native embedding sees private scheduling functions. Only the defining
 * object provider, optional registration provider and public Lean interfaces
 * are linked to the downstream guest. No protocol may disappear in packaging.
 *
 * @param o - Compiler-selected inventory, generated components and typed guest stubs.
 */
export const witApplicationCommand=o=>{
	const {descriptor,ops,delivery,callbacks,entries,modules,name,version}=o;
	const methods=delivery?.supported??[],registered=methods.some(m=>m.shape==="callback");
	const actual=[...ops.methods,...methods].map(m=>m.declaration);
	if(delivery?.remaining?.length || actual.length!==entries.length || new Set(actual).size!==actual.length
		|| !entries.every(e=>actual.includes(e.declaration)) || new Set(entries.map(e=>e.declaration)).size!==actual.length)
		fail("package would omit or duplicate a source declaration");
	const x=witApplicationExchange(descriptor),obj=descriptor.interfaceName,sync=ops.publicName,cb=callbacks?.interfaceName;
	const mixed=methods.length>0,roles=["objects",...registered?["callbacks"]:[],"application"];
	const imports=[obj,"api",...registered?["callbacks"]:[],...methods.length?["object-tasks"]:[]];
	const world=[
		`package lean-bridge:${name}@${version};`
		, "world application {"
		, ...imports.map(n=>"  import "+n+";")
		, "  export run: "+(methods.length?"async ":"")+"func() -> s64;"
		, "}"
		, ...registered?[`world registrations { import ${obj}; import api; export callbacks; }`]:[]].join("\n");
	const parts=["(component"],channels=[];
	if(mixed)
	{
		parts.push(`(type $sync-ports ${modules.syncPorts}) (import "sync-ports" (instance $transport (type $sync-ports)))`);
		for(const {name,shape} of methods)
		{
			const n="turn-"+name,input=shape==="stream"?'(param "value" u64)':'(param "left" u64) (param "right" u64)';
			parts.push(`(import "${n}" (func $${n} (param "op" u32) (param "key" u32) ${input} (result (tuple u32 u32 u64 u64))))`);
			channels.push(`(with "${n}" (func $${n}))`);
		}
	}
	else parts.push(`(type $native-type ${ops.nativeType}) (import "${ops.nativeName}" (instance $native (type $native-type)))`);
	parts.push(nested(modules.owner,"owner","objects"),nested(modules.exchange,"cells-code"),nested(modules.facade,"facade"),
		"(instance $o (instantiate $owner))",`(alias export $o "${obj}" (instance $objects))`,
		`(export "${obj}" (instance $objects))`,...x.slots.map(s=>`(alias export $objects "${s.type}" (type $${s.alias}))`),
		`(instance $cells (instantiate $cells-code (with "${obj}" (instance $objects)) ${x.slots.map(s=>`(with "${s.alias}" (type $${s.alias}))`).join(" ")}))`,
		"(instance $exchange "+x.slots.flatMap(s=>[`(export "${s.alias}" (type $${s.alias}))`,...[s.put,s.take].map(f=>`(export "${f}" (func $cells "${f}"))`)]).join(" ")+")",
		...mixed?[]:['(export "private-exchange" (instance $exchange))']);
	const objectArg=`(with "${obj}" (instance $objects))`,exchangeArg=`(with "${x.name}" (instance $exchange))`;
	if(mixed)
	{
		parts.push(nested(witTurnOwners(descriptor,null),"object-table"),`(instance $vault (instantiate $object-table ${objectArg}))`,
			nested(modules.members,"members-code"),`(instance $members (instantiate $members-code ${objectArg} (with "leases" (instance $vault))))`,
			nested(modules.native,"turn-code"),`(instance $turn (instantiate $turn-code ${objectArg} ${exchangeArg} (with "leases" (instance $vault)) (with "members" (instance $members)) (with "sync-ports" (instance $transport))))`,
			`(alias export $turn "${ops.nativeName}" (instance $native))`);
	}
	parts.push(`(instance $b (instantiate $facade ${objectArg} ${exchangeArg} (with "${ops.nativeName}" (instance $native))))`,
		`(alias export $b "${sync}" (instance $sync))`);
	const appImports=[objectArg,`(with "${sync}" (instance $sync))`],taskImports=[objectArg];
	if(registered)
	{
		parts.push(nested(modules.callbacks,"registrations","callbacks"),
			`(instance $c (instantiate $registrations ${appImports.join(" ")})) (alias export $c "${cb}" (instance $cb))`,
			nested(witTurnOwners(descriptor,callbacks),"registration-table"),
			`(instance $owners (instantiate $registration-table ${objectArg} (with "${cb}" (instance $cb)) (with "object-owners" (instance $vault))))`);
		const cbArg=`(with "${cb}" (instance $cb))`;appImports.push(cbArg);taskImports.push(cbArg);
	}
	if(mixed)
	{
		const vault=registered?"$owners":"$vault";
		for(const [name,method] of [["bind-owners","bind"],["close-owners","close"]])parts.push(`(export "${name}" (func ${vault} "${method}"))`);
		parts.push(nested(modules.tasks,"tasks"),`(instance $jobs (instantiate $tasks ${taskImports.join(" ")} (with "leases" (instance ${vault})) ${channels.join(" ")}))`);
		for(const {name,shape} of methods)for(const port of (shape==="stream"?["pump","retire","drain"]:["poll","deliver","reap","retire","close","drain"]))
		{
			const n=name+"-"+port;parts.push(`(export "${n}" (func $jobs "${n}"))`);
		}
		appImports.push(`(with "${delivery.publicName}" (instance $jobs "${delivery.publicName}"))`);
	}
	parts.push(nested(modules.application,"downstream","application"),`(instance $app (instantiate $downstream ${appImports.join(" ")}))`,
		methods.length?canonicalSupervisor:'(export "run" (func $app "run"))',")");
	return {world,wat: parts.join("\n"),roles};
};

/**
 * Bind all checked native methods into a single owner-thread run loop. The
 * template bytes neither contain the dummy applications nor need a WAT parser.
 *
 * @param template - Verified fixed binary sections, consumer roles and delivery methods.
 * @param template.parts - Fixed binary sections before, between and after the input components.
 * @param template.roles - Ordered consumer inputs.
 * @param template.methods - Checked native worker declarations.
 * @param entries - Source-selected native names.
 * @param name - Native facade prefix.
 */
export const witCommandHeader=({parts,roles,methods},entries,name)=>{
	const p=cIdentifier(name)+"_",inputs=[
		`#define LB_INPUTS ${roles.length}`
		, "static const char *const input_roles[]={"+roles.map(r=>JSON.stringify(r)).join(",")+"};"
		, ...parts.map((b,i)=>`static const uint8_t fixed${i}[]={${b.length?[...b].join(","):"0"}};`)
		, "static const struct {const uint8_t *p;size_t n;} fixed[]={"+parts.map((b,i)=>`{fixed${i},${b.length}}`).join(",")+"};"];
	if(methods.length)
	{
		const ids=entries.filter(e=>e.delivery).map(e=>e.declaration);
		if(ids.length!==methods.length || !ids.every(d=>methods.some(m=>m.declaration===d)))fail("native task inventory differs from validated template");
		return [
			'#include "application-turn-sync-host.h"'
			, '#include "application-turn-tasks.h"'
			, ...inputs
			, `#define LB_BINDING ${p}binding\n#define LB_OPEN ${p}with_hosts\n#define LB_CLOSE ${p}close\n#define LB_OK ${p}OK\n`].join("\n");
	}
	return [
		'#include "application-operations.h"'
		, "static lwit_store graph; static lwit_operations ops;"
		, `#define LB_GRAPH_OK ${p}OK`,...inputs,""].join("\n");
};
