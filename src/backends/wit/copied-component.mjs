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
	bool: ["i32", 1], uint8: ["i32", 1], int8: ["i32", 1], unit: ["i32", 1]
	, uint16: ["i32", 2], int16: ["i32", 2], uint32: ["i32", 4], int32: ["i32", 4]
	, uint64: ["i64", 8], int64: ["i64", 8]
	, float32: ["f32", 4], float64: ["f64", 8]
};
const layout = (copy, cache) => {
	if(cache.has(copy)) return cache.get(copy);
	if(copy.record && copy.fields.length)
	{
		const fields = copy.fields.map(field => layout(field.type, cache));
		const alignment = Math.max(...fields.map(field => field.alignment));
		const size = align(fields.reduce((size, field) => align(size, field.alignment) + field.size, 0), alignment);
		if(!Number.isSafeInteger(size) || size > 16 * 1024 * 1024) throw new TypeError("WIT record layout exceeds the 16 MiB copied-value limit");
		const result = { flat: fields.flatMap(field => field.flat).slice(0, 17), alignment, size };
		cache.set(copy, result); return result;
	}
	if(copy.record) return { flat: ["i32"], size: 1, alignment: 1 };
	if(copy.ref.name === "int") return { flat: ["i32", "i32", "i32"], size: 12, alignment: 4 };
	if(leaf[copy.ref.name])
	{
		const [type, size] = leaf[copy.ref.name];
		return { flat: [type], size, alignment: size };
	}
	return { flat: ["i32", "i32"], size: 8, alignment: 4 };
};

const allocator = `(core module $allocator
    (memory (export "memory") 1 1024)
    (global $heap (mut i32) (i32.const 16))
    (func (export "realloc") (param $old i32) (param $old-size i32) (param $alignment i32) (param $size i32) (result i32)
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
${["i32", "i64", "f32", "f64"].map(type => `    (func (export "post-${type}") (param ${type}) (global.set $heap (i32.const 16)))`).join("\n")}
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
 * @param model.types - Non-primitive WIT types.
 * @param model.typeBody - Component instance type declarations and functions.
 * @param model.importName - Fully qualified native interface.
 * @param model.exportName - Fully qualified public interface.
 */
export const renderCopiedWitComponent = ({ surface, types, typeBody, importName, exportName }) => {
	const layouts = new Map();
	const functions = surface.functions.map((fn, index) => {
		const input = fn.parameters.flatMap(parameter => layout(parameter.copy, layouts).flat), result = layout(surface.copy(fn.declaration.result.type), layouts);
		const parameters = input.length > 16 ? ["i32"] : input;
		const indirect = result.flat.length > 1, returned = indirect ? "i32" : result.flat[0];
		return { fn, index, result, parameters, indirect, returned, lowered: [...parameters, ...(indirect ? ["i32"] : [])] };
	});
	const publicType = copy => copy.witName ? `$public${copy.index}` : copy.wat;
	return `(component
  (type $api (instance
${typeBody}
  ))
  (import "${importName}" (instance $host (type $api)))
${types.map(copy => `  (alias export $host "${copy.witName}" (type $public${copy.index}))`).join("\n")}
${functions.map(({ fn, index }) => `  (alias export $host "${fn.witName}" (func $host${index}))`).join("\n")}
  ${allocator}
${functions.map(({ index }) => `  (core func $lower${index} (canon lower (func $host${index}) (memory $memory) (realloc $realloc)))`).join("\n")}
  (core module $forward
    (import "allocation" "realloc" (func $allocate (param i32 i32 i32 i32) (result i32)))
${functions.map(({ index, lowered, indirect, returned }) => `    (import "host" "f${index}" (func $f${index} ${lowered.length ? `(param ${lowered.join(" ")})` : ""} ${indirect ? "" : `(result ${returned})`}))`).join("\n")}
${functions.map(({ index, parameters, indirect, returned, result }) => `    (func (export "f${index}") ${parameters.length ? `(param ${parameters.join(" ")})` : ""} (result ${returned})${indirect ? ` (local $result i32)\n      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const ${result.alignment}) (i32.const ${result.size})))` : ""}
${parameters.map((_, i) => `      local.get ${i}`).join("\n")}
      ${indirect ? "local.get $result\n      " : ""}call $f${index}${indirect ? "\n      local.get $result" : ""}
    )`).join("\n")}
  )
  (core instance $imports
${functions.map(({ index }) => `    (export "f${index}" (func $lower${index}))`).join("\n")}
  )
  (core instance $forwarded (instantiate $forward (with "allocation" (instance $allocation)) (with "host" (instance $imports))))
${functions.map(({ index }) => `  (alias core export $forwarded "f${index}" (core func $forward${index}))`).join("\n")}
${functions.map(({ fn, index, returned }) => `  (func $f${index} ${fn.parameters.map(parameter => `(param "${parameter.witName}" ${publicType(parameter.copy)})`).join(" ")} (result ${publicType(surface.copy(fn.declaration.result.type))}) (canon lift (core func $forward${index}) (memory $memory) (realloc $realloc) (post-return $post-${returned})))`).join("\n")}
  (instance $public
${functions.map(({ fn, index }) => `    (export "${fn.witName}" (func $f${index}))`).join("\n")}
  )
  (export "${exportName}" (instance $public))
)
`;
};
