/** @file Call-scoped C input views for records with explicitly selected callable fields. */

/**
 * Keep result/lease layouts unchanged. A second input layout accepts typed
 * descriptors only at a selected field of a borrowed record parameter.
 * Copy, transfer, anchor and callback-result paths still require real owners.
 *
 * @param options - Validated owned C projection and header under construction.
 * @param options.ir - Compiler-derived public binding interface.
 * @param options.functions - Projected native declarations.
 * @param options.table - C value layouts keyed by type identity.
 * @param options.names - Names already reserved in the generated header.
 * @param options.header - Destination for alternate input type declarations.
 */
export const ownedHostRecordInputs=({ir,functions,table,names,header})=>{
	const selected=new Set(ir.aggregatePolicy.closureFields??[]);
	if(!selected.size)return [];
	const records=new Map(), calls=[];
	const definitions=new Map(ir.types.map(t=>[t.id,t]));
	const reserve=base=>{
		let name=base;
		while(names.has(name))name+="_input";
		names.set(name,"generated host record view");return name;
	};
	for(const fn of functions)
	{
		const slots=[];
		fn.parameters.forEach((id,index)=>{
			const node=table.get(id);
			if(node.kind!=="record" || fn.anchor===index || fn.transfers?.includes(index) || fn.receiver===index)return;
			// The source checker grants refined fields the closure direction.
			// A validator for a Lean-produced function is not a host-input proof.
			const fields=node.fields.filter(f=>table.get(f.type).kind==="callback"
				&& !Object.hasOwn(definitions.get(f.type).source.extensions??{},"lean-lang.org/refinements")
				&& selected.has(definitions.get(id).source.declaration+"."+f.sourceName));
			if(!fields.length)return;
			if(!records.has(id))
			{
				const type=reserve(node.cName+"_host_input");
				header.push("/* Host fields are borrowed only until the enclosing call returns. */",`typedef struct ${type} {`);
				for(const f of node.fields)header.push(`  ${table.get(f.type).cName}${fields.includes(f)?"_host":""}${f.pointer?" const *":" "}${f.name};`);
				header.push(`} ${type};`);records.set(id,type);
			}
			slots.push({index,node,inputType: records.get(id),fields});
		});
		if(slots.length)calls.push({...fn,cName: reserve(fn.cName+"_with_host_fields"),hostRecordSlots: slots});
	}
	return calls;
};

/**
 * Stage ordinary members and borrowed descriptors without exposing tokens to the caller.
 *
 * @param slots - Borrowed record parameters with selected callable fields.
 * @param nodes - Native and public type layouts indexed by identity.
 */
export const stageHostRecordInputs=(slots,nodes)=>{
	const declarations=[],prepare=[],release=[];
	// Wide input records must not multiply per-callback stack frames at
	// every synchronous reentry. The enclosing input arena owns the block.
	const wide=slots.reduce((n,s)=>n+s.node.fields.length,0)>4, members=[];
	const local=name=>wide?"host_stage->"+name:name;
	const storage=(type,name)=>{
		if(wide)members.push(`    ${type} ${name};`);
		else declarations.push(`  ${type} ${name} = {0};`);
	};
	for(const {index: i,node,inputType,fields} of slots)
	{
		storage(node.cName,"staged"+i);
		prepare.push(`  if (!status && !ov_pointer(a${i}, sizeof(*a${i}), _Alignof(${inputType}))) status = LB_OWNED_INVALID;`);
		for(const [k,f] of node.fields.entries())
		{
			if(!fields.includes(f))
			{
				prepare.push(`  if (!status) ${local("staged"+i)}.${f.name} = a${i}->${f.name};`);continue;
			}
			const child=nodes.get(f.type),frame=`field${i}_${k}`,type=`oc_host_v${child.index}`;
			if(wide)
			{storage(type,frame);storage(child.nativeName,frame+"_raw");}
			else declarations.push(`  ${type} ${frame} = {0}; ${child.nativeName} ${frame}_raw = {0};`);
			prepare.push(`  if (!status) status = ${type}_begin(&${local(frame)}, &a${i}->${f.name}, active, &budget, &${local(frame+"_raw")});`
				,`  if (!status) ${local("staged"+i)}.${f.name} = (${child.cName})(uintptr_t)${local(frame+"_raw")}.token;`);
			release.unshift(`  ${wide?"if (host_stage) ":""}{ int cleanup = ${type}_end(&${local(frame)}); if (!status) status = cleanup; }`);
		}
	}
	if(wide)
	{
		declarations.push("  struct {",...members,"  } *host_stage = NULL;","  void *host_storage = NULL;");
		prepare.unshift("  if (!status) status = oc_allocate(&input, 1, sizeof(*host_stage), &host_storage);",
			"  if (!status) { host_stage = host_storage; memset(host_stage, 0, sizeof(*host_stage)); }");
	}
	return {declarations,prepare,release,staged: i=>local("staged"+i)};
};
