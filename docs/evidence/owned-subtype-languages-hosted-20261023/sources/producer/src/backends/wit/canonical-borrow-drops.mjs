/**
 * Release guest borrow handles inside canonical-ABI values after forwarding.
 *
 * @file
 */

/**
 * Render cleanup for active borrowed fields without consuming owned resources.
 * Input graphs are the finite canonical value types, not recursive Lean values.
 *
 * @param options - Canonical layout operations shared with the forwarding code.
 * @param options.layout - Return the flattened types, byte size and alignment.
 * @param options.align - Align a byte offset to a canonical field boundary.
 */
export const createCanonicalBorrowDrops = ({ layout, align }) => {
	const branches = new Map(), borrowing = new Map(), active = new Set();
	const memory = new Map(), lists = new Map(), definitions = [];
	const payloads = copy => {
		if(branches.has(copy)) return branches.get(copy);
		const result = copy.variant ? copy.cases.map((branch, tag) => ({ tag
			, type: branch.fields.length ? { payloadRecord: true, fields: branch.fields } : null }))
			: copy.compound === "option" ? [{ tag: 1, type: copy.fields[0].type }]
				: copy.compound === "result" ? copy.fields.map((field, tag) => ({ tag, type: field.type })) : [];
		branches.set(copy, result); return result;
	};
	const hasBorrow = copy => {
		if(borrowing.has(copy)) return borrowing.get(copy);
		if(active.has(copy)) throw new TypeError("Canonical WIT value types must be acyclic");
		active.add(copy);
		const result = copy.aliasTarget ? hasBorrow(copy.aliasTarget)
			: copy.resource ? copy.borrowed === true
				: copy.element ? hasBorrow(copy.element)
					: copy.variant || copy.compound === "option" || copy.compound === "result"
						? payloads(copy).some(branch => branch.type && hasBorrow(branch.type))
						: (copy.fields ?? []).some(field => hasBorrow(field.type));
		active.delete(copy); borrowing.set(copy, result); return result;
	};
	const offset = (pointer, bytes) => bytes ? `(i32.add ${pointer} (i32.const ${bytes}))` : pointer;
	const load = (pointer, bytes = 0) => `(i32.load ${offset(pointer, bytes)})`;
	const word = ({ value, type }) => type === "i32" ? value
		: type === "i64" ? `(i32.wrap_i64 ${value})`
			: type === "f32" ? `(i32.reinterpret_f32 ${value})`
				: type === "f64" ? `(i32.wrap_i64 (i64.reinterpret_f64 ${value}))`
					: (() => { throw new TypeError(`Unexpected canonical flat type ${type}`); })();
	const listFunction = copy => {
		if(lists.has(copy)) return lists.get(copy);
		const name = `$borrow-list${lists.size}`; lists.set(copy, name);
		const stride = layout(copy.element).size, element = memoryFunction(copy.element);
		if(!Number.isSafeInteger(stride) || stride <= 0) throw new TypeError("Borrowed list elements require a positive canonical stride");
		definitions.push(`    (func ${name} (param $p i32) (param $count i32) (local $index i32)
      (block $done
        (loop $next
          (br_if $done (i32.eq (local.get $index) (local.get $count)))
          (call ${element} (i32.add (local.get $p) (i32.mul (local.get $index) (i32.const ${stride}))))
          (local.set $index (i32.add (local.get $index) (i32.const 1)))
          (br $next))))`);
		return name;
	};
	const memoryFunction = copy => {
		if(copy.aliasTarget) return memoryFunction(copy.aliasTarget);
		if(memory.has(copy)) return memory.get(copy);
		const name = `$borrow-value${memory.size}`; memory.set(copy, name);
		let body;
		if(copy.resource) body = `(call $drop${copy.resourceIndex} ${load("(local.get $p)")})`;
		else if(copy.element) body = `(call ${listFunction(copy)} ${load("(local.get $p)")} ${load("(local.get $p)", 4)})`;
		else if(copy.variant || copy.compound === "option" || copy.compound === "result")
		{
			const cases = payloads(copy), tagSize = !copy.variant || copy.cases.length <= 256 ? 1 : copy.cases.length <= 65536 ? 2 : 4;
			const boundary = Math.max(1, ...cases.map(branch => branch.type ? layout(branch.type).alignment : 1));
			const payload = offset("(local.get $p)", align(tagSize, boundary));
			const tag = `(i32.${tagSize === 1 ? "load8_u" : tagSize === 2 ? "load16_u" : "load"} (local.get $p))`;
			body = cases.filter(branch => branch.type && hasBorrow(branch.type)).map(branch =>
				`(if (i32.eq ${tag} (i32.const ${branch.tag})) (then (call ${memoryFunction(branch.type)} ${payload})))`).join("\n      ");
		}
		else
		{
			let end = 0;
			body = copy.fields.flatMap(field => {
				const value = layout(field.type), start = align(end, value.alignment); end = start + value.size;
				return hasBorrow(field.type) ? [`(call ${memoryFunction(field.type)} ${offset("(local.get $p)", start)})`] : [];
			}).join("\n      ");
		}
		definitions.push(`    (func ${name} (param $p i32)\n      ${body})`);
		return name;
	};
	const flat = (copy, values) => {
		if(copy.aliasTarget) return flat(copy.aliasTarget, values);
		if(!hasBorrow(copy)) return [];
		if(copy.resource) return [`(call $drop${copy.resourceIndex} ${word(values[0])})`];
		if(copy.element) return [`(call ${listFunction(copy)} ${word(values[0])} ${word(values[1])})`];
		if(copy.variant || copy.compound === "option" || copy.compound === "result")
			return payloads(copy).filter(branch => branch.type && hasBorrow(branch.type)).map(branch =>
				`(if (i32.eq ${word(values[0])} (i32.const ${branch.tag})) (then ${flat(branch.type, values.slice(1)).join(" ")}))`);
		let index = 0;
		return copy.fields.flatMap(field => {
			const start = index; index += layout(field.type).flat.length;
			return flat(field.type, values.slice(start, index));
		});
	};
	return {
		hasNested: copy => !copy.resource && hasBorrow(copy)
		, parameters: (parameters, input) => {
			let end = 0, index = 0;
			return parameters.flatMap(parameter => {
				const copy = parameter.copy, value = layout(copy), start = align(end, value.alignment);
				end = start + value.size;
				const first = index; index += value.flat.length;
				if(!hasBorrow(copy)) return [];
				return input.length > 16 ? [`(call ${memoryFunction(copy)} ${offset("(local.get 0)", start)})`]
					: flat(copy, input.slice(first, index).map((type, index) => ({ type, value: `(local.get ${first + index})` })));
			}).map(line => "      " + line).join("\n");
		}
		, definitions: () => definitions.length ? definitions.join("\n") + "\n" : ""
	};
};
