/**
 * Match the ordinary Perl broker kind to the authenticated word-wire lease.
 * Those identities have different representations and must never be cast.
 *
 * @file
 */
import { heapResourceIdentities } from "../../analyze/heap-resource-identity.mjs";
import { taskResourceTypes } from "../c/task-resources.mjs";

/**
 * Authenticate resource definitions before emitting an XS conversion.
 *
 * @param api - Source-reconciled component Binding IR.
 * @param wire - Actual native adapter with per-kind release and equality operations.
 * @param evidence - Original compiler selection, module fingerprints and import graph.
 * @param ledger - Release-verified library identity and digest.
 */
export const perlResourceKinds = (api,wire,evidence,ledger) => {
	const kinds=taskResourceTypes(api.types.filter(t=>t.kind==="resource"));
	const drafts=wire.leases??[], selected=evidence.selection.leanResources??[];
	if(!Array.isArray(drafts)||kinds.length!==drafts.length||kinds.length!==selected.length)
		throw new TypeError("Mismatched Perl resource definitions");
	if(!kinds.length) return new Map();
	const digest=x=>typeof x==="string" && /^[0-9a-f]{64}$/u.test(x);
	if(!digest(ledger?.id)||!digest(ledger.sha256)||ledger.library!=="liblb_task_resources_"+ledger.id+".so")
		throw new TypeError("Unverified Perl resource ledger");
	const resources=heapResourceIdentities({...evidence,resources: evidence.metadata.leanResources});
	const byName=new Map(resources.map(r=>[r.declaration,r]));
	const names=new Map(evidence.interfaces.map(i=>[i.module,i.sourceSha256]));
	if(byName.size!==kinds.length||new Set(selected).size!==selected.length) throw new TypeError("Ambiguous Perl resource selection");
	return new Map(kinds.map((kind,i)=>{
		const w=drafts[i], r=byName.get(kind.lean), stem=wire.clear?.replace(/_clear$/u,"");
		if(!stem || !r || !selected.includes(kind.lean) || kind.hash!==r.identity || w.name!==kind.name || w.hash!==kind.hash
			|| w.type!=="lease:"+kind.hash || w.tag!==i+3 || w.symbol!==stem+"_lease_"+i)
			throw new TypeError("Unverified Perl resource kind: "+kind.lean);
		// Bless the public object in the component's named class; use this
		// source-specific base only for common isa checks across components.
		const brokerKind = "lean:"+r.declaration+":"+names.get(r.module);
		const identityClass = "LeanBridge::Runtime::Heap::H"+kind.hash+"::"+kind.name;
		const value = { ...kind, index: i, tag: w.tag, wire: w.type
			, ledger: ledger.id, close: w.symbol+"_close", brokerKind, identityClass };
		return [w.type, value];
	}));
};

/**
 * Emit only operations tied to the compiled ledger and checked nominal type.
 * The saved input lease and scope unwind in reverse order on every XS exit.
 *
 * @param kinds - Authenticated nominal models.
 * @param ns - Component's validated Perl namespace.
 */
export const perlLeaseXs = (kinds,ns) => {
	if(!kinds.size) return "";
	const first=[...kinds.values()][0], prefix="lb_task_resource_"+first.ledger+"_";
	return `extern int ${prefix}create(const char *,lean_object *,uint64_t *);
extern lean_object *${prefix}borrow(const char *,const uint64_t *);
extern int ${prefix}release(const char *,uint64_t *);
${[...kinds.values()].map(r=>`static void lbs_drop_${r.index}(pTHX_ void *data) {
    uint64_t *h=data; if (h[0]) ${prefix}release("${r.hash}",h); Safefree(h);
}
static void lbs_in_${r.index}(pTHX_ SV *v, uint64_t *a) {
    lbp_scope *scope=lbp_begin(aTHX); SAVEDESTRUCTOR_X(lbp_end,scope);
    lean_object *object=lbp_borrow(aTHX_ scope,v,"${r.brokerKind}");
    uint64_t *tmp; Newxz(tmp,2,uint64_t); SAVEDESTRUCTOR_X(lbs_drop_${r.index},tmp);
    int status=${prefix}create("${r.hash}",object,tmp);
    if (status || !tmp[0] || !tmp[1]) croak("Could not borrow Lean resource (status %d)",status);
    a[0]=tmp[0]; a[1]=tmp[1];
}
static SV *lbs_out_${r.index}(pTHX_ uint64_t *out) {
    if (!out[0] || !out[1] || out[2] || out[3]!=${r.tag}) croak("Malformed Lean resource output");
    lean_object *object=${prefix}borrow("${r.hash}",out);
    if (!object) croak("Closed or foreign Lean resource output");
    return lbp_independent_resource(aTHX_ object,"${r.brokerKind}","${ns}::${r.name}");
}`).join("\n")}`;
};

/**
 * Project ordinary component-named classes over a stable cross-component base.
 *
 * @param kinds - Authenticated heap resources.
 * @param ns - Component Perl namespace.
 */
export const perlLeaseModules = (kinds,ns) => [...kinds.values()].map(r=>{
	const reserved=["Future","RetainedFuture","Cursor","RetainedCallback","Ok","Err","Failure","Error","StepError","TaskIOError","IOError","EIOError"];
	if(reserved.includes(r.name)) throw new TypeError("Resource class collides with a generated Perl class: "+r.name);
	return `\npackage ${r.identityClass}; our @ISA=('LeanBridge::Runtime::Resource');
package ${ns}::${r.name}; our @ISA=('${r.identityClass}'); sub CLONE_SKIP { 0 }\n`;
}).join("");
