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
 * Component-local error latch read after a typed owned callback returns.
 *
 * @param model - Validated ownership graph.
 */
export const ownedCallbackFailureSymbol = model =>
	`lean_bridge_owned_callback_failure_${model.bindingIrSha256.slice(0, 20)}`;

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
	const known = new Map(), recipes = new Map();
	const add = (id, expression, dependencies = []) => {
		if(known.has(id)) return false;
		const name = `recovery${known.size}`;
		known.set(id, name);
		recipes.set(id, { dependencies, line: `let ${name} : ${sourceType(id)} := ${expression}` });
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
				if(value) changed = add(node.target, value, [node.id]) || changed;
				if(known.has(node.target)) changed = add(node.id, known.get(node.target), [node.target]) || changed;
			}
			if(!value) continue;
			if(node.kind === "record") for(const field of node.fields)
				changed = add(field.type, `${value}.«${field.name}»`, [node.id]) || changed;
			if(node.kind === "tuple") node.arguments.forEach((id, index) => {
				changed = add(id, `${value}.${index ? "snd" : "fst"}`, [node.id]) || changed;
			});
		}
	}
	for(let changed = true; changed;)
	{
		changed = false;
		for(const node of types.values())
		{
			if(known.has(node.id)) continue;
			let expression, dependencies = [];
			if(node.kind === "primitive") expression = primitiveDefault(node.name);
			else if(node.kind === "array") expression = "#[]";
			else if(node.kind === "list") expression = "[]";
			else if(node.kind === "option") expression = ".none";
			else if(node.kind === "alias")
			{
				expression = known.get(node.target); dependencies = [node.target];
			}
			else if(node.kind === "tuple" && node.arguments.every(id => known.has(id)))
			{
				expression = `(${node.arguments.map(id => known.get(id)).join(", ")})`;
				dependencies = node.arguments;
			}
			else if(node.kind === "result")
			{
				const index = node.arguments.findIndex(id => known.has(id));
				if(index !== -1)
				{
					expression = `.${index ? "error" : "ok"} ${known.get(node.arguments[index])}`;
					dependencies = [node.arguments[index]];
				}
			}
			else if(node.kind === "record" && node.fields.every(field => known.has(field.type)))
			{
				expression = `{ ${node.fields.map(field => `«${field.name}» := ${known.get(field.type)}`).join(", ")} }`;
				dependencies = node.fields.map(field => field.type);
			}
			else if(node.kind === "variant")
			{
				const branch = node.cases.find(branch => branch.fields.every(field => known.has(field.type)));
				if(branch)
				{
					expression = `.«${branch.name}» ${branch.fields.map(field => known.get(field.type)).join(" ")}`;
					dependencies = branch.fields.map(field => field.type);
				}
			}
			if(expression !== undefined) changed = add(node.id, expression, dependencies) || changed;
		}
	}
	const result = known.get(callback.callable.result.type);
	if(!result) return null;
	const needed = new Set(), visit = id => {
		if(needed.has(id)) return;
		needed.add(id);
		for(const dependency of recipes.get(id)?.dependencies ?? []) visit(dependency);
	};
	visit(callback.callable.result.type);
	const lines = [...recipes].filter(([id]) => needed.has(id))
		.map(([, recipe]) => recipe.line);
	return [...lines, result];
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
 * @param options.refinements - Optional owned refinement carrier conversions.
 */
export const generateOwnedCallbackCarriers = ({
	model, symbols, sourceType, carrier, refinements
}) => {
	const lines = [], callbacks = [];
	const failure = ownedCallbackFailureSymbol(model);
	const header = [`int ${failure}(void);`];
	const source = [
		'#include "carriers.h"', '#include "lean_bridge_native_runtime.h"'
		, `static _Thread_local int ${failure}_state;`
		, `int ${failure}(void) { int result = ${failure}_state; ${failure}_state = 0; return result; }`];
	for(const node of model.types.filter(node => node.kind === "callback"))
	{
		const index = callbacks.length, symbol = symbols.types[node.id];
		const valueType = refinements?.sourceValueType ?? sourceType;
		const parameters = node.callable.parameters.map(
			(site, i) => `(a${i} : ${valueType(site.type)})`
		);
		const names = node.callable.parameters.map((_, i) => `a${i}`);
		const recovery = ownedCallbackRecovery(model, node, valueType);
		const parameterSites = names.map((_, position) =>
			refinements?.byPosition.get(
				refinements.siteKey(node.id, "parameter", position)
			)
		);
		const resultSite = refinements?.byPosition.get(
			refinements.siteKey(node.id, "result")
		);
		const invokeArguments = names.map((name, position) => {
			const site = parameterSites[position];
			const value = site?.direction === "result"
				? refinements.resultConversion(site.tree, name) : name;
			return `#[${value}]`;
		});
		const invoked = `carrierValue (hostInvoke${index} token ${invokeArguments.join(" ")})`;
		const checkedResult = resultSite?.direction === "input"
			? `(do let value ← ${invoked}; ${refinements.inputConversion(
				resultSite.tree, "value"
			)})` : invoked;
		const checkedRecovery = resultSite?.direction === "input"
			? `(do let value ← carrierValue recovery; ${refinements.inputConversion(
				resultSite.tree, "value"
			)})` : "carrierValue recovery";
		const reject = value => resultSite?.direction === "input"
			? `hostReject${index} token (${value})` : value;
		if(recovery && node.callable.direction !== "closure")
			lines.push(`def hostRecovery${index} ${parameters.join(" ")} : ${valueType(node.callable.result.type)} :=`
				, ...recovery.map(line => `  ${line}`), "");
		if(resultSite?.direction === "input")
			lines.push(`@[extern "${symbol}_reject"]`
				, `opaque hostReject${index} (token : _root_.USize) (recovery : ${valueType(node.callable.result.type)}) : ${valueType(node.callable.result.type)} := recovery`, "");
		lines.push(`@[extern "${symbol}_invoke"]`
			, `opaque hostInvoke${index} (token : _root_.USize) ${node.callable.parameters.map((site, i) => `(a${i} : ${carrier(site.type)})`).join(" ")} : ${carrier(node.callable.result.type)} := #[]`
			, "", `@[export ${symbol}_wrap]`);
		if(node.callable.direction === "closure")
			lines.push(`def hostWrap${index} (_token : _root_.USize) (_recovery : ${carrier(node.callable.result.type)}) : ${carrier(node.id)} := #[]`, "");
		else lines.push(
			`def hostWrap${index} (token : _root_.USize) (recovery : ${carrier(node.callable.result.type)}) : ${carrier(node.id)} :=`
			, `  match ${checkedRecovery} with`, "  | .some fallback =>"
			, `    #[fun ${names.join(" ")} => match ${checkedResult} with`
			, "      | .some value => value", `      | .none => ${reject("fallback")}]`
			, ...recovery ? ["  | .none =>"
				, `    #[fun ${names.join(" ")} => match ${checkedResult} with`
				, "      | .some value => value"
				, `      | .none => ${reject(`hostRecovery${index} ${names.join(" ")}`)}]`] : ["  | .none => #[]"]
			, "");
		header.push(`lean_object *${symbol}_wrap(size_t, lean_object *);`
			, `lean_object *${symbol}_invoke(size_t${names.map(() => ", lean_object *").join("")});`
			, ...resultSite?.direction === "input" ? [`lean_object *${symbol}_reject(size_t, lean_object *);`] : []);
		source.push(`lean_object *${symbol}_invoke(size_t token${names.map(name => `, lean_object *${name}`).join("")}) {`
			, "  lb_native_callback callback = lb_native_callback_lookup(token);"
			, "  if (!callback.invoke) {", ...names.map(name => `    lean_dec(${name});`)
			, "    return lean_alloc_array(0, 0);", "  }"
			, `  return ((lean_object *(*)(void *${names.map(() => ", lean_object *").join("")}))callback.invoke)(callback.context${names.map(name => `, ${name}`).join("")});`, "}"
			, ...resultSite?.direction === "input" ? [
				`lean_object *${symbol}_reject(size_t token, lean_object *recovery) {`
				, "  (void)token;"
				, `  ${failure}_state = 1;`
				, "  return recovery;", "}"
			] : []);
		callbacks.push({ id: node.id, symbol
			, automaticRecovery: node.callable.direction !== "closure"
				&& recovery !== null
			, ...(node.callable.direction === undefined ? {}
				: { direction: node.callable.direction }) });
	}
	return { lines, header, source: source.join("\n") + "\n", callbacks };
};
