/** @file Generate input-only call-scoped callback records for both JVM value families. */

const quote = name => name.split(".").map(part => `\`${part}\``).join(".");

/**
 * Keep the leased record unchanged. Each selected input field can hold either
 * a typed host function or an original Lean lease, independently of its peers.
 *
 * @param model - Checked owned Java and Kotlin value models.
 */
export const jvmHostRecords = model => {
	const nodes = new Map(model.types.map(n => [n.id,n]));
	const names = new Set([...Object.keys(model.files),...Object.keys(model.kotlin.files)].map(p=>p.split("/").at(-1).replace(/\.(?:java|kt)$/u,"")));
	const views = new Map();
	for(const layout of model.hostInputLayouts)
	{
		const node = nodes.get(layout.id);
		let name = node.publicType+"Input";
		while(names.has(name)) name += "Input";
		names.add(name);
		const fields = layout.fields.map((f,i)=>({...f,publicName: node.fields[i].publicName,child: nodes.get(f.type)}));
		views.set(node.id,{...layout, publicName: name, node,fields});
	}
	const methods = new Set(model.functions.map(f=>f.publicName));
	const functions = model.c.hostFieldCalls.map(call=>{
		const original = model.functions.find(f=>f.id===call.id);
		let publicName = original.publicName+"WithHostFields";
		while(methods.has(publicName)) publicName += "Input";
		methods.add(publicName);
		return {...original,...call,publicName};
	});
	const slot = (fn,i) => fn.hostRecordSlots?.some(s=>s.index===i) ? views.get(fn.parameters[i]) : null;
	return {views, functions, slot};
};

/**
 * Emit consumer types without exposing a pointer or native descriptor.
 *
 * @param model - Checked owned Java and Kotlin value models.
 * @param records - Input views and the original leased record types.
 * @param type - Java source spelling of the selected representation.
 */
export const jvmHostRecordSources = (model,records,type) => {
	const files=[], methods=[], readers=[];
	const ns=model.namespace, kn=model.kotlin.namespace;
	for(const view of records.views.values())
	{
		const {fields,node,publicName: name}=view;
		const fieldType=(f,k,leased=false)=>f.descriptor&&!leased
			? (k?quote(kn+"."+f.child.delegateType):ns+"."+f.child.delegateType)
			: k?model.kotlin.publicTypes[f.type]:type(f.type,false);
		const args=(k,typed)=>fields.map(f=>k?(quote(f.publicName)+(typed?": "+fieldType(f,true):""))
			: (typed?fieldType(f,false)+" ":"")+f.publicName).join(", ");
		const wide=fields.reduce((n,f)=>n+(!f.descriptor&&["long","double"].includes(f.child.publicType)?2:1),0)>254;
		const from=(k)=>fields.map(f=>(k?quote(f.publicName):f.publicName)+"(value."+(k?quote(f.publicName):f.publicName+"()")+")").join(".");
		const setters=(k)=>fields.flatMap((f,i)=>(f.descriptor?[false,true]:[false]).map(leased=>k
			? `        fun ${quote(f.publicName)}(value: ${fieldType(f,true,leased)}): Builder { slots[${i}] = value; return this }`
			: `        public Builder ${f.publicName}(${fieldType(f,false,leased)} value) { slots[${i}] = java.util.Objects.requireNonNull(value); return this; }`)).join("\n");
		files.push({path: name+".java", pub: true
			, source: `package ${ns};
/** Input only. Application callbacks are borrowed for one Lean call. */
public final class ${name} {
    private final Object[] slots;
    private ${name}(Builder builder) {
        slots = builder.slots.clone();
        for (Object value : slots) if (value == null) throw new IllegalStateException("Every field must be assigned");
    }
${wide?"":`    public ${name}(${args(false,true)}) { this(new Builder().${fields.map(f=>f.publicName+"("+f.publicName+")").join(".")}); }
`}    Object field(int index) { return slots[index]; }
    public static Builder builder() { return new Builder(); }
    public static ${name} fromLeased(${type(node.id,false)} value) { return builder().${from(false)}.build(); }
    public static final class Builder {
        private final Object[] slots = new Object[${fields.length}];
${setters(false)}
        public ${name} build() { return new ${name}(this); }
    }
}
`});
		files.push({path: "kotlin/"+name+".kt", pub: true
			, source: `package ${quote(kn)}
/** Input only. Application callbacks are borrowed for one Lean call. */
class ${quote(name)} private constructor(private val slots: kotlin.Array<kotlin.Any?>) {
${wide?"":`    constructor(${args(true,true)}) : this(arrayOf<kotlin.Any?>(${args(true,false)}))
`}    @kotlin.jvm.JvmSynthetic internal fun field(index: kotlin.Int): kotlin.Any = slots[index]!!
    companion object {
        @kotlin.jvm.JvmStatic fun builder(): Builder = Builder()
        @kotlin.jvm.JvmStatic fun fromLeased(value: ${model.kotlin.publicTypes[node.id]}): ${quote(name)} = builder().${from(true)}.build()
    }
    class Builder {
        private val slots = arrayOfNulls<kotlin.Any>(${fields.length})
${setters(true)}
        fun build(): ${quote(name)} {
            check(slots.none { it == null }) { "Every field must be assigned" }
            return ${quote(name)}(slots.copyOf())
        }
    }
}
`});
		readers.push(`    @kotlin.jvm.JvmStatic fun read${node.index}(row: ${quote(kn+"."+name)}, i: kotlin.Int): kotlin.Any = row.field(i)`);
		// Numeric offsets come from the same independently checked C and FFM
		// layouts. Generate once per record, not once per exported function.
		const data="hostRecord"+node.index;
		methods.push(`    private static final int[][] ${data} = {${fields.map(f=>`{${f.child.index},${f.offset},${f.descriptor?32:f.child.size},${f.descriptor?2:f.pointer?1:0}}`).join(",")}};`);
		for(const k of [false,true])
		{
			const family=k?"Kotlin":"Java", catalog=k?"_KotlinOwnedTypes.CATALOG":"_OwnedTypes.CATALOG";
			const cb=[...new Map(fields.filter(f=>f.descriptor).map(f=>[f.type,f])).values()];
			const hostCases=cb.map(f=>`                        case ${f.child.index} -> host${family}${f.child.index}((${k?kn:ns}.${f.child.delegateType})item, scope, frame);`).join("\n");
			const isLease=cb.map(f=>`                        case ${f.child.index} -> item instanceof ${type(f.type,k)};`).join("\n");
			methods.push(`    private MemorySegment record${family}${node.index}(${k?kn:ns}.${name} value, _OwnedConvert.Scope scope, _OwnedCallFrame frame) {
        java.util.Objects.requireNonNull(value);
        var catalog = ${catalog}; scope.visit(0,catalog.nodes()[${node.index}],false);
        scope.nativeBytes(${view.size},1); var raw = scope.allocate(${view.size},${view.alignment});
        scope.inputDepth++;
        try {
            for (int i = 0; i != ${data}.length; ++i) {
                var field = ${data}[i]; int type = field[0], offset = field[1], mode = field[3];
                Object item = ${k?"_KotlinOwnedRecordSlots.read"+node.index+"(value,i)":"value.field(i)"};
                if (mode == 2) {
                    boolean lease = switch(type) {
${isLease}
                        default -> throw new AssertionError(type);
                    };
                    if (lease) {
                        var kept = _OwnedConvert.write(catalog,type,item,scope);
                        if (!scope.checkOnly) raw.set(ADDRESS,offset+16L,kept.get(ADDRESS,0));
                        continue;
                    }
                    var descriptor = switch(type) {
${hostCases}
                        default -> throw new AssertionError(type);
                    };
                    if (!scope.checkOnly) MemorySegment.copy(descriptor,0,raw,offset,32);
                } else {
                    var child = _OwnedConvert.write(catalog,type,item,scope);
                    if (!scope.checkOnly) {
                        if (mode == 1) raw.set(ADDRESS,offset,child);
                        else MemorySegment.copy(child,0,raw,offset,field[2]);
                    }
                }
            }
        } finally { scope.inputDepth--; }
        return raw;
    }`);
		}
	}
	if(readers.length) files.push({path: "_KotlinOwnedRecordSlots.kt", pub: false
		, source: `package ${quote(ns)}
internal object _KotlinOwnedRecordSlots {
${readers.join("\n")}
}
`});
	return {files,methods};
};
