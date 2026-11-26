/** @file Marshal caller-created function fields only at borrowed record inputs. */
/**
 * Generate ctypes input records and scope-aware conversions for their fields.
 *
 * @param records - Selected nominal input records and public field names.
 * @param nodes - Python value layouts keyed by binding type.
 */
export const ownedPythonHostRecords=(records,nodes)=>{
	const lines=[],layouts=[];
	for(const [id,record] of records)
	{
		const node=nodes.get(id),raw="_OwnedHostRecord"+node.index;
		const fields=node.fields.map((f,i)=>({child: nodes.get(f.type),host: record.fields.includes(f.name),f,i}));
		lines.push(`class ${raw}(_c.Structure):`,`    _fields_ = [${fields.map(({child,host,f,i})=>`("field${i}", ${host?"_OwnedHost"+child.index:f.pointer?"_c.c_void_p":child.raw})`).join(", ")}]`,"",
			`def _owned_host_record${node.index}(value, scope, frame=None):`,
			`    if type(value) not in (_V.${node.publicType}, _V.${record.name}): raise TypeError("Expected ${node.publicType} or ${record.name}")`,
			"    key = _b.id(value)",`    scope.enter(key, 0, ${raw})`,"    try:",`        out = scope.value(${raw})`);
		for(const {child,host,f,i} of fields)
		{
			if(host)lines.push(`        item = value.${f.publicName}`,
				`        if (type(value) is _V.${node.publicType} or isinstance(item, _R._OwnedResource)) and type(item) is not _V.${child.publicType}:`,
				`            raise TypeError("Expected ${child.publicType}; use ${record.name} for a host function")`,
				`        converted = _owned_host${child.index}(item, scope, frame)`);
			else lines.push(`        converted = _owned_input${child.index}(value.${f.publicName}, scope, 1)`);
			lines.push(`        if not scope.check_only: out.field${i} = ${f.pointer?"_c.addressof(converted)":"converted"}`);
		}
		lines.push("        return out","    finally:","        scope.leave(key)","        item = converted = value = out = frame = None","");
		layouts.push({name: record.cType,raw,fields: node.fields.map(f=>f.name)});
	}
	return {source: lines.join("\n"),layouts};
};
