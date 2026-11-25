/** @file Generate typed Wasmtime export lookup for an authenticated application interface. */
const simple = {
	bool: "BOOL"
	, char: "CHAR"
	, string: "STRING"
	, float32: "F32"
	, float64: "F64"
	, usize: "U64"
	, isize: "S64"
};
for(const bits of [8, 16, 32, 64])
{
	simple["uint" + bits] = "U" + bits;
	simple["int" + bits] = "S" + bits;
}

/**
 * Bind every member before creating a Lean binding or running a guest member.
 * A compatible name cannot stand in for a different nominal return type.
 *
 * @param descriptor - Output of witApplicationHostImports for the captured IR.
 */
export const witApplicationMemberBindings = descriptor => {
	const {contract, interfaceName} = descriptor, {resources, methods, error} = contract;
	const type = (kind, ownership) => {
		if(typeof kind === "number") return "{WASMTIME_COMPONENT_VALTYPE_"+(ownership==="borrow"?"BORROW":"OWN")+", b.kinds["+kind+"].type}";
		if(["bytes", "nat", "int", "unit", "void"].includes(kind)) return "{LWIT_"+kind.toUpperCase()+", NULL}";
		if(!Object.hasOwn(simple, kind)) throw new TypeError("Unknown WIT member type: "+kind);
		return "{WASMTIME_COMPONENT_VALTYPE_"+simple[kind]+", NULL}";
	};
	const cName = text => text.replaceAll("-", "_");
	const fields = resources.map(r => {
		const group = methods.filter(m => m.resource === r.name);
		return group.length ? "    struct { "+group.map(m => "wasmtime_component_func_t m_"+cName(m.name)+";").join(" ")+" } on_"+cName(r.name)+";" : "";
	});
	const bind = methods.map(m => {
		const prefix = m.implicitReceiver ? "[method]" : ["constructor","static-method"].includes(m.op) ? "[static]" : "";
		const name = prefix ? prefix+m.resource+"."+m.name : m.name;
		const args = m.inputs.map(a => "{"+JSON.stringify(a.name)+", "+type(a.kind,a.ownership)+"}");
		const result = type(m.result==="unit"?"void":m.result,"lease");
		return `    if(!lwit_member_bind(s,scope,${JSON.stringify(name)},${args.length?"(lwit_param[]){"+args.join(",")+"}":"NULL"},${args.length},(lwit_shape)${result},${m.error?"b.error":"NULL"},&b.on_${cName(m.resource)}.m_${cName(m.name)}))goto done;`;
	});
	return `/* Generated from the captured application-owned WIT interface. */
#ifndef LB_WIT_BOUND_${descriptor.identity.toUpperCase()}
#define LB_WIT_BOUND_${descriptor.identity.toUpperCase()}
#include "application-member-types.h"
typedef struct {
    lwit_store *store;
    lwit_class kinds[${resources.length}];
    wasmtime_component_resource_type_t *error;
    wasmtime_component_func_t message;
${fields.filter(Boolean).join("\n")}
} lwit_members;
static inline void lwit_members_clear(lwit_members *b){
    for(size_t i=0;i<${resources.length};i++)lwit_class_clear(b->kinds+i);
    if(b->error)wasmtime_component_resource_type_delete(b->error);
    *b=(lwit_members){0};
}
static inline bool lwit_members_bind(lwit_store *s,lwit_members *out){
    if(!lwit_open(s) || !out || out->store)return false;
    const char *iface=${JSON.stringify(interfaceName)};
    wasmtime_component_export_index_t *scope=wasmtime_component_instance_get_export_index(&s->instance,s->ctx,NULL,iface,strlen(iface));
    if(!scope)return false;
    bool ok=false;lwit_members b={.store=s};
    if(!lwit_error_bind(s,scope,${JSON.stringify("[method]"+error+".message")},&b.error,&b.message))goto done;
${resources.map((r,i)=>`    if(!lwit_class_bind(s,scope,${JSON.stringify(r.retain)},${JSON.stringify(r.same)},&b.kinds[${i}]))goto done;`).join("\n")}
    for(size_t i=0;i<${resources.length};i++){
        if(wasmtime_component_resource_type_equal(b.kinds[i].type,b.error))goto done;
        for(size_t j=0;j<i;j++)if(wasmtime_component_resource_type_equal(b.kinds[i].type,b.kinds[j].type))goto done;
    }
${bind.join("\n")}
    *out=b;ok=true;
done:
    if(!ok)lwit_members_clear(&b);
    wasmtime_component_export_index_delete(scope);return ok;
}
#endif
`;
};
