/**
 * Generate synchronous canonical-ABI forwarding with bounded scratch memory.
 *
 * @file
 */

/**
 * Round a canonical record offset up to its next field alignment.
 *
 * @param size - Current byte offset.
 * @param boundary - Canonical field alignment.
 */
const align = (size, boundary) => Math.ceil(size / boundary) * boundary;
const leaf = {
	char: ["i32", 4], bool: ["i32", 1], uint8: ["i32", 1], int8: ["i32", 1]
	, unit: ["i32", 1]
	, uint16: ["i32", 2], int16: ["i32", 2], uint32: ["i32", 4], int32: ["i32", 4]
	, uint64: ["i64", 8], int64: ["i64", 8]
	, float32: ["f32", 4], float64: ["f64", 8]
};
const layout = (copy, cache) => {
	if(copy.resource) return { flat: ["i32"], size: 4, alignment: 4 };
	if(cache.has(copy)) return cache.get(copy);
	if(copy.compound === "option" || copy.compound === "result")
	{
		const cases = copy.fields.map(field => layout(field.type, cache));
		const alignment = Math.max(...cases.map(value => value.alignment));
		// Canonical variants place their payload after an aligned one-byte tag.
		const size = align(align(1, alignment) + Math.max(...cases.map(value => value.size)), alignment);
		if(!Number.isSafeInteger(size) || size > 16 * 1024 * 1024) throw new TypeError("WIT variant layout exceeds the 16 MiB copied-value limit");
		const payload = [];
		for(const value of cases) for(const [index, type] of value.flat.entries())
		{
			const previous = payload[index];
			payload[index] = !previous || previous === type ? type
				: [previous, type].every(type => type === "i32" || type === "f32") ? "i32" : "i64";
		}
		const result = { flat: ["i32", ...payload].slice(0, 17), alignment, size };
		cache.set(copy, result); return result;
	}
	if((copy.record && copy.fields.length) || copy.compound === "tuple")
	{
		const fields = copy.fields.map(field => layout(field.type, cache));
		const alignment = Math.max(...fields.map(field => field.alignment));
		const size = align(fields.reduce((size, field) => align(size, field.alignment) + field.size, 0), alignment);
		if(!Number.isSafeInteger(size) || size > 16 * 1024 * 1024) throw new TypeError("WIT record layout exceeds the 16 MiB copied-value limit");
		const result = { flat: fields.flatMap(field => field.flat).slice(0, 17), alignment, size };
		cache.set(copy, result); return result;
	}
	if(copy.record) return { flat: ["i32"], size: 1, alignment: 1 };
	if(copy.scalarName === "int") return { flat: ["i32", "i32", "i32"], size: 12, alignment: 4 };
	if(leaf[copy.scalarName])
	{
		const [type, size] = leaf[copy.scalarName];
		return { flat: [type], size, alignment: size };
	}
	return { flat: ["i32", "i32"], size: 8, alignment: 4 };
};

// Nested host callbacks may re-enter this component. Keep the outer return area
// live until its own post-return; reserve 64 heap marks below callable data.
const allocator = callables => `(core module $allocator
    (memory (export "memory") 1 1024)
    (global $heap (mut i32) (i32.const ${callables ? 272 : 16}))
${callables ? `    (global $depth (mut i32) (i32.const 0))
    (func (export "enter")
      (if (i32.ge_u (global.get $depth) (i32.const 64)) (then unreachable))
      (i32.store offset=16 (i32.shl (global.get $depth) (i32.const 2)) (global.get $heap))
      (global.set $depth (i32.add (global.get $depth) (i32.const 1))))
    (func $leave
      (if (i32.eqz (global.get $depth)) (then unreachable))
      (global.set $depth (i32.sub (global.get $depth) (i32.const 1)))
      (global.set $heap (if (result i32) (i32.eqz (global.get $depth))
        (then (i32.const 272))
        (else (i32.load offset=16 (i32.shl (global.get $depth) (i32.const 2)))))))
` : ""}    (func (export "realloc") (param $old i32) (param $old-size i32) (param $alignment i32) (param $size i32) (result i32)
      (local $start i32) (local $end i32) (local $pages i32)
      (if (i32.eqz (local.get $size)) (then (return (i32.const 0))))
      (local.set $start (i32.and
        (i32.add (global.get $heap) (i32.sub (local.get $alignment) (i32.const 1)))
        (i32.sub (i32.const 0) (local.get $alignment))))
      (local.set $end (i32.add (local.get $start) (local.get $size)))
      (if (i32.or (i32.lt_u (local.get $end) (local.get $start)) (i32.gt_u (local.get $end) (i32.const 67108864))) (then unreachable))
      (local.set $pages (i32.shr_u (i32.add (local.get $end) (i32.const 65535)) (i32.const 16)))
      (if (i32.gt_u (local.get $pages) (memory.size))
        (then (if (i32.eq (memory.grow (i32.sub (local.get $pages) (memory.size))) (i32.const -1)) (then unreachable))))
      (if (local.get $old)
        (then (memory.copy (local.get $start) (local.get $old)
          (select (local.get $old-size) (local.get $size) (i32.lt_u (local.get $old-size) (local.get $size))))))
      (global.set $heap (local.get $end))
      (local.get $start))
${["i32", "i64", "f32", "f64"].map(type => `    (func (export "post-${type}") (param ${type}) ${callables ? "(call $leave)" : "(global.set $heap (i32.const 16))"})`).join("\n")}
  )
  (core instance $allocation (instantiate $allocator))
  (alias core export $allocation "memory" (core memory $memory))
  (alias core export $allocation "realloc" (core func $realloc))
${["i32", "i64", "f32", "f64"].map(type => `  (alias core export $allocation "post-${type}" (core func $post-${type}))`).join("\n")}`;

/**
 * Match the canonical ABI's 16-parameter/one-result flattening limits.
 *
 * @param model - Native interface type and admitted source functions.
 * @param model.surface - Canonical copied C descriptions.
 * @param model.functions - Forwarded functions, including typed callable invocations.
 * @param model.types - Non-primitive WIT types.
 * @param model.resources - Signature-specific callable resource types.
 * @param model.typeBody - Component instance type declarations and functions.
 * @param model.importName - Fully qualified native interface.
 * @param model.exportName - Fully qualified public interface.
 */
export const renderCopiedWitComponent = ({ surface, functions: exports = surface.functions, types, resources = [], typeBody, importName, exportName }) => {
	const layouts = new Map();
	const functions = exports.map((fn, index) => {
		const input = fn.parameters.flatMap(parameter => layout(parameter.copy, layouts).flat), result = layout(fn.resultCopy ?? surface.copy(fn.declaration.result.type), layouts);
		const parameters = input.length > 16 ? ["i32"] : input;
		const indirect = result.flat.length > 1, returned = indirect ? "i32" : result.flat[0];
		let offset = 0, flat = 0;
		// Canonical lowering creates guest borrow handles. Even after the native
		// import releases its borrow, this forwarding instance must drop its own.
		const drop = fn.parameters.flatMap(parameter => {
			const value = layout(parameter.copy, layouts); offset = align(offset, value.alignment);
			const handle = input.length > 16 ? `(i32.load offset=${offset} (local.get 0))` : `(local.get ${flat})`;
			offset += value.size; flat += value.flat.length;
			return parameter.copy.resource && parameter.copy.borrowed ? [`      (call $drop${parameter.copy.resourceIndex} ${handle})`] : [];
		}).join("\n");
		return { fn, index, result, parameters, indirect, returned, drop, lowered: [...parameters, ...(indirect ? ["i32"] : [])] };
	});
	const publicType = copy => copy.resource ? `$public${copy.borrowed ? "Borrow" : "Own"}${copy.resourceIndex}` : copy.witName ? `$public${copy.index}` : copy.wat;
	// Type ascription gives re-exported aliases fresh IDs while preserving the
	// imported resource identity. Direct duplicate exports confuse WIT decoders.
	const publicResources = resources.length ? `  (type $public-api (instance
${types.map(copy => `    (alias outer 1 $public${copy.index} (type $outer${copy.index}))\n    (export "${copy.witName}" (type $public${copy.index} (eq $outer${copy.index})))`).join("\n")}
${resources.map(resource => `    (alias outer 1 $publicResource${resource.index} (type $outer${resource.index}))\n    (export "${resource.witName}" (type $publicResource${resource.index} (eq $outer${resource.index})))\n    (type $publicBorrow${resource.index} (borrow $publicResource${resource.index}))\n    (type $publicOwn${resource.index} (own $publicResource${resource.index}))`).join("\n")}
${functions.map(({ fn }) => `    (export "${fn.witName}" (func ${fn.parameters.map(parameter => `(param "${parameter.witName}" ${publicType(parameter.copy)})`).join(" ")} (result ${publicType(fn.resultCopy)})))`).join("\n")}
  ))\n` : "";
	return `(component
  (type $api (instance
${typeBody}
  ))
  (import "${importName}" (instance $host (type $api)))
${types.map(copy => `  (alias export $host "${copy.witName}" (type $public${copy.index}))`).join("\n")}
${resources.length ? resources.map(resource => `  (alias export $host "${resource.witName}" (type $publicResource${resource.index}))\n  (type $publicBorrow${resource.index} (borrow $publicResource${resource.index}))\n  (type $publicOwn${resource.index} (own $publicResource${resource.index}))`).join("\n") + "\n" : ""}${functions.map(({ fn, index }) => `  (alias export $host "${fn.witName}" (func $host${index}))`).join("\n")}
  ${allocator(resources.length > 0)}
${functions.map(({ index }) => `  (core func $lower${index} (canon lower (func $host${index}) (memory $memory) (realloc $realloc)))`).join("\n")}
${resources.length ? resources.map(resource => `  (core func $drop${resource.index} (canon resource.drop $publicResource${resource.index}))`).join("\n") + "\n" : ""}  (core module $forward
    (import "allocation" "realloc" (func $allocate (param i32 i32 i32 i32) (result i32)))
${resources.length ? `    (import "allocation" "memory" (memory 1))\n    (import "allocation" "enter" (func $enter))\n${resources.map(resource => `    (import "resources" "drop${resource.index}" (func $drop${resource.index} (param i32)))`).join("\n")}\n` : ""}${functions.map(({ index, lowered, indirect, returned }) => `    (import "host" "f${index}" (func $f${index} ${lowered.length ? `(param ${lowered.join(" ")})` : ""} ${indirect ? "" : `(result ${returned})`}))`).join("\n")}
${functions.map(({ index, parameters, indirect, returned, result, drop }) => `    (func (export "f${index}") ${parameters.length ? `(param ${parameters.join(" ")})` : ""} (result ${returned})${indirect || drop ? ` (local $result ${returned})` : ""}${resources.length ? "\n      call $enter" : ""}${indirect ? `\n      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const ${result.alignment}) (i32.const ${result.size})))` : ""}
${parameters.map((_, i) => `      local.get ${i}`).join("\n")}
      ${indirect ? "local.get $result\n      " : ""}call $f${index}${drop && !indirect ? "\n      local.set $result" : ""}${drop ? `\n${drop}` : ""}${indirect || drop ? "\n      local.get $result" : ""}
    )`).join("\n")}
  )
  (core instance $imports
${functions.map(({ index }) => `    (export "f${index}" (func $lower${index}))`).join("\n")}
  )
${resources.length ? `  (core instance $resources\n${resources.map(resource => `    (export "drop${resource.index}" (func $drop${resource.index}))`).join("\n")}\n  )\n` : ""}  (core instance $forwarded (instantiate $forward (with "allocation" (instance $allocation)) (with "host" (instance $imports))${resources.length ? ' (with "resources" (instance $resources))' : ""}))
${functions.map(({ index }) => `  (alias core export $forwarded "f${index}" (core func $forward${index}))`).join("\n")}
${functions.map(({ fn, index, returned }) => `  (func $f${index} ${fn.parameters.map(parameter => `(param "${parameter.witName}" ${publicType(parameter.copy)})`).join(" ")} (result ${publicType(fn.resultCopy ?? surface.copy(fn.declaration.result.type))}) (canon lift (core func $forward${index}) (memory $memory) (realloc $realloc) (post-return $post-${returned})))`).join("\n")}
${publicResources}  (instance $public
${resources.length ? [...types.map(copy => `    (export "${copy.witName}" (type $public${copy.index}))`), ...resources.map(resource => `    (export "${resource.witName}" (type $publicResource${resource.index}))`)].join("\n") + "\n" : ""}${functions.map(({ fn, index }) => `    (export "${fn.witName}" (func $f${index}))`).join("\n")}
  )
  (export "${exportName}" (instance $public)${resources.length ? " (instance (type $public-api))" : ""})
)
`;
};
