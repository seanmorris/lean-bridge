/**
 * Typed host callback wrappers. Failure must return a real Lean value so compiled
 * Lean can finish normal reference-counted cleanup; the bridge withholds results.
 *
 * @file
 */

const primitiveDefault = name => ({ unit: "()", bool: "false"
	, char: "Char.ofNat 0"
	, string: '""', bytes: "ByteArray.empty" }[name] ?? "0");

/**
 * Find a finite typed recovery expression using actual callback arguments and
 * productive constructors. Resource leaves have no synthetic default. Shared
 * recipes use let bindings, never recursively expand a nominal graph.
 *
 * @param model - Validated ownership graph.
 * @param callback - Callback node from that graph.
 * @param sourceType - Compiler-authenticated Lean type rendering.
 */
export const ownedCallbackRecovery = (model, callback, sourceType) => {
	const types = new Map(model.types.map(type => [type.id, type]));
	const known = new Map(), lines = [];
	const add = (id, expression) => {
		if(known.has(id)) return false;
		const name = `recovery${known.size}`;
		known.set(id, name); lines.push(`let ${name} : ${sourceType(id)} := ${expression}`);
		return true;
	};
	callback.callable.parameters.forEach((site, index) => add(site.type, `a${index}`));
	// Only unconditional projections are witnesses. An empty array, missing
	// option, or other variant branch cannot promise an opaque resource.
	for(let changed = true; changed;)
	{
		changed = false;
		for(const node of types.values())
		{
			const value = known.get(node.id);
			if(node.kind === "alias")
			{
				if(value) changed = add(node.target, value) || changed;
				if(known.has(node.target)) changed = add(node.id, known.get(node.target)) || changed;
			}
			if(!value) continue;
			if(node.kind === "record") for(const field of node.fields)
				changed = add(field.type, `${value}.«${field.name}»`) || changed;
			if(node.kind === "tuple") node.arguments.forEach((id, index) => {
				changed = add(id, `${value}.${index ? "snd" : "fst"}`) || changed;
			});
		}
	}
	for(let changed = true; changed;)
	{
		changed = false;
		for(const node of types.values())
		{
			if(known.has(node.id)) continue;
			let expression;
			if(node.kind === "primitive") expression = primitiveDefault(node.name);
			else if(node.kind === "array") expression = "#[]";
			else if(node.kind === "list") expression = "[]";
			else if(node.kind === "option") expression = ".none";
			else if(node.kind === "alias") expression = known.get(node.target);
			else if(node.kind === "tuple" && node.arguments.every(id => known.has(id)))
				expression = `(${node.arguments.map(id => known.get(id)).join(", ")})`;
			else if(node.kind === "result")
			{
				const index = node.arguments.findIndex(id => known.has(id));
				if(index !== -1) expression = `.${index ? "error" : "ok"} ${known.get(node.arguments[index])}`;
			}
			else if(node.kind === "record" && node.fields.every(field => known.has(field.type)))
				expression = `{ ${node.fields.map(field => `«${field.name}» := ${known.get(field.type)}`).join(", ")} }`;
			else if(node.kind === "variant")
			{
				const branch = node.cases.find(branch => branch.fields.every(field => known.has(field.type)));
				if(branch) expression = `.«${branch.name}» ${branch.fields.map(field => known.get(field.type)).join(" ")}`;
			}
			if(expression !== undefined) changed = add(node.id, expression) || changed;
		}
	}
	const result = known.get(callback.callable.result.type);
	return result ? [...lines, result] : null;
};

/**
 * Emit optional typed recovery, call-scoped token wrappers and matching C
 * trampolines. The shared broker checks stale tokens and thread/process affinity.
 *
 * @param options - Authenticated type graph and carrier naming functions.
 * @param options.model - Validated ownership graph.
 * @param options.symbols - Private typed carrier symbols.
 * @param options.sourceType - Source Lean type rendering.
 * @param options.carrier - Typed Array rendering.
 */
export const generateOwnedCallbackCarriers = ({ model, symbols, sourceType, carrier }) => {
	const lines = [], header = [], callbacks = [];
	const source = ['#include "carriers.h"', '#include "lean_bridge_native_runtime.h"'];
	for(const node of model.types.filter(node => node.kind === "callback"))
	{
		const index = callbacks.length, symbol = symbols.types[node.id];
		const parameters = node.callable.parameters.map((site, i) => `(a${i} : ${sourceType(site.type)})`);
		const names = node.callable.parameters.map((_, i) => `a${i}`);
		const recovery = ownedCallbackRecovery(model, node, sourceType);
		if(recovery) lines.push(`def hostRecovery${index} ${parameters.join(" ")} : ${sourceType(node.callable.result.type)} :=`
			, ...recovery.map(line => `  ${line}`), "");
		lines.push(`@[extern "${symbol}_invoke"]`
			, `opaque hostInvoke${index} (token : _root_.USize) ${node.callable.parameters.map((site, i) => `(a${i} : ${carrier(site.type)})`).join(" ")} : ${carrier(node.callable.result.type)} := #[]`
			, "", `@[export ${symbol}_wrap]`
			, `def hostWrap${index} (token : _root_.USize) (recovery : ${carrier(node.callable.result.type)}) : ${carrier(node.id)} :=`
			, "  match carrierValue recovery with", "  | .some fallback =>"
			, `    #[fun ${names.join(" ")} => match carrierValue (hostInvoke${index} token ${names.map(name => `#[${name}]`).join(" ")}) with`
			, "      | .some value => value", "      | .none => fallback]"
			, ...recovery ? ["  | .none =>"
				, `    #[fun ${names.join(" ")} => match carrierValue (hostInvoke${index} token ${names.map(name => `#[${name}]`).join(" ")}) with`
				, "      | .some value => value"
				, `      | .none => hostRecovery${index} ${names.join(" ")}]`] : ["  | .none => #[]"]
			, "");
		header.push(`lean_object *${symbol}_wrap(size_t, lean_object *);`
			, `lean_object *${symbol}_invoke(size_t${names.map(() => ", lean_object *").join("")});`);
		source.push(`lean_object *${symbol}_invoke(size_t token${names.map(name => `, lean_object *${name}`).join("")}) {`
			, "  lb_native_callback callback = lb_native_callback_lookup(token);"
			, "  if (!callback.invoke) {", ...names.map(name => `    lean_dec(${name});`)
			, "    return lean_alloc_array(0, 0);", "  }"
			, `  return ((lean_object *(*)(void *${names.map(() => ", lean_object *").join("")}))callback.invoke)(callback.context${names.map(name => `, ${name}`).join("")});`, "}");
		callbacks.push({ id: node.id, symbol, automaticRecovery: recovery !== null });
	}
	return { lines, header, source: source.join("\n") + "\n", callbacks };
};
