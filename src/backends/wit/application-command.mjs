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
const hooks=m=>{
	const stage={owned: "",returned: " (result (option u32))",factory: " (result u32)",stream: " (result u32)",callback: " (result (result u32 (error string)))"};
	if(!Object.hasOwn(stage,m.shape))fail("unknown delivery: "+m.declaration);
	return [
		[m.name+"-native-start","(result u32)"]
		, [m.name+"-native-stage",'(param "key" u32)'+stage[m.shape]]
		, ...m.shape==="stream"?[[m.name+"-native-act",'(param "key" u32) (param "op" u32) (result u32)']]:[]
	];
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
	const channels=methods.flatMap(hooks),roles=["objects",...registered?["callbacks"]:[],"application"];
	const imports=[obj,"api",...registered?["callbacks"]:[],...methods.length?["object-tasks"]:[]];
	const world=[
		`package lean-bridge:${name}@${version};`
		, "world application {"
		, ...imports.map(n=>"  import "+n+";")
		, "  export run: "+(methods.length?"async ":"")+"func() -> s64;"
		, "}"
		, ...registered?[`world registrations { import ${obj}; import api; export callbacks; }`]:[]].join("\n");
	const parts=["(component",`(type $native-type ${ops.nativeType}) (import "${ops.nativeName}" (instance $native (type $native-type)))`];
	for(const [n,ty] of channels)parts.push(`(import "${n}" (func $${n} ${ty}))`);
	parts.push(nested(modules.owner,"owner","objects"),nested(modules.exchange,"cells-code"),nested(modules.facade,"facade"),
		"(instance $o (instantiate $owner))",`(alias export $o "${obj}" (instance $objects))`,
		`(export "${obj}" (instance $objects))`,...x.slots.map(s=>`(alias export $objects "${s.type}" (type $${s.alias}))`),
		`(instance $cells (instantiate $cells-code (with "${obj}" (instance $objects)) ${x.slots.map(s=>`(with "${s.alias}" (type $${s.alias}))`).join(" ")}))`,
		"(instance $exchange "+x.slots.flatMap(s=>[`(export "${s.alias}" (type $${s.alias}))`,...[s.put,s.take].map(f=>`(export "${f}" (func $cells "${f}"))`)]).join(" ")+")",
		'(export "private-exchange" (instance $exchange))',
		`(instance $b (instantiate $facade (with "${obj}" (instance $objects)) (with "${x.name}" (instance $exchange)) (with "${ops.nativeName}" (instance $native))))`,
		`(alias export $b "${sync}" (instance $sync))`);
	const appImports=[`(with "${obj}" (instance $objects))`,`(with "${sync}" (instance $sync))`];
	const taskImports=[appImports[0],`(with "${x.name}" (instance $exchange))`];
	if(registered)
	{
		const cx=callbacks.exchange.name;
		parts.push(nested(modules.callbacks,"registrations","callbacks"),nested(modules.callbackExchange,"cb-cells"),
			`(instance $c (instantiate $registrations ${appImports.join(" ")})) (alias export $c "${cb}" (instance $cb))`,
			`(export "${cb}" (instance $cb)) (instance $cc (instantiate $cb-cells (with "${cb}" (instance $cb))))`,
			`(alias export $cc "${cx}" (instance $cx)) (export "${cx}" (instance $cx))`);
		appImports.push(`(with "${cb}" (instance $cb))`);
		taskImports.push(`(with "${cb}" (instance $cb))`,`(with "${cx}" (instance $cx))`);
	}
	if(methods.length)
	{
		parts.push(nested(witTurnOwners(descriptor,registered?callbacks:null),"turn-owners"),
			`(instance $owners (instantiate $turn-owners ${appImports[0]} ${registered?`(with "${cb}" (instance $cb))`:""}))`,
			'(export "bind-owners" (func $owners "bind"))','(export "close-owners" (func $owners "close"))');
		parts.push(nested(modules.tasks,"tasks"),`(instance $jobs (instantiate $tasks ${taskImports.join(" ")} ${channels.map(([n])=>`(with "${n}" (func $${n}))`).join(" ")}))`);
		for(const m of methods)for(const p of (m.shape==="stream"?["pump","retire"]:["deliver","reap","retire"]))
		{
			const n=m.name+"-"+p;parts.push(`(export "${n}" (func $jobs "${n}"))`);
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
	const ds=[
		"#include \"application-operations.h\""
		, "#include \"canonical-future-reactor.h\""
		, "static lwit_store graph; static lwit_operations ops;"
		, `#define LB_GRAPH_OK ${cIdentifier(name)}_OK`
		, `#define LB_ASYNC ${methods.length?1:0}`
		, `#define LB_INPUTS ${roles.length}`
		, `#define LB_FDS ${Math.max(1,methods.length*64)}`
		, "static const char *const input_roles[]={"+roles.map(r=>JSON.stringify(r)).join(",")+"};"
		, ...parts.map((b,i)=>`static const uint8_t fixed${i}[]={${b.length?[...b].join(","):"0"}};`)
		, "static const struct {const uint8_t *p;size_t n;} fixed[]={"+parts.map((b,i)=>`{fixed${i},${b.length}}`).join(",")+"};"
		, "typedef struct {lb_cf_reactor *r; wasmtime_error_t *(*link)(wasmtime_component_linker_t *); bool (*open)(void); wasmtime_error_t *(*close)(void); wasmtime_error_t *(*pump)(unsigned,unsigned *);} channel;"];
	const rows=[];
	for(const [i,m] of methods.entries())
	{
		const stream=m.shape==="stream",kind=stream?"stream":"future",entry=entries.find(e=>e.declaration===m.declaration);
		if(!entry)fail("native method missing: "+m.declaration);
		const f="lwit_"+kind+"_"+cIdentifier(entry.name),v="channel"+i;
		ds.push(`#include "${m.name}-${kind}.h"`,`static ${f} ${v};`,
			`static wasmtime_error_t *link${i}(wasmtime_component_linker_t *l){return ${f}_link(l,&${v});}`,
			`static bool open${i}(void){return ${f}_open(&${v},&ops);}`,
			`static wasmtime_error_t *close${i}(void){return ${f}_shutdown(&${v});}`);
		if(stream)ds.push(`static wasmtime_error_t *pump${i}(unsigned key,unsigned *state){return ${f}_pump(&${v},key,state);}`);
		rows.push(`{&${v}.r,link${i},open${i},close${i},${stream?"pump"+i:"NULL"}}`);
	}
	return [...ds,"static const channel channels[]={"+[...rows,"{0}"].join(",")+"};",""].join("\n");
};
