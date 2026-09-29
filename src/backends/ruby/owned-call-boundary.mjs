/**
 * Pointer-argument C forwarders for Fiddle's ownership-aware calls and callbacks.
 *
 * @file
 */

/**
 * Adapt leaf-by-value public C arguments to private address-only Fiddle calls.
 * Typed C callback trampolines supply addresses valid for the synchronous call.
 * The source is appended to the checked C package's implementation unit.
 *
 * @param model - Ruby layouts over the authenticated public C value model.
 */
export const ownedRubyCallBoundary = model => {
	const { c } = model, p = c.prefix, nodes = new Map(model.types.map(node => [node.id, node]));
	const callbacks = [], calls = [], sources = [];
	const invalid = `${p.toUpperCase()}_INVALID_ARGUMENT`;
	const names = new Set([...c.functions, ...c.callbacks, ...c.retains, ...c.copies, ...c.nodes].map(item => item.cName));
	const claim = name => {
		if(names.has(name)) throw new TypeError(`Owned Ruby forwarder collides with export: ${name}`);
		names.add(name);
	};
	for(const callback of c.callbacks)
	{
		const node = nodes.get(callback.id), result = nodes.get(callback.result), index = node.index;
		const parameters = callback.parameters.slice(1).map(id => nodes.get(id));
		const name = `${p}_ruby_host${index}`, forward = `${p}_ruby_callback${index}`;
		claim(name); claim(forward);
		callbacks.push({ ...callback, node, result, parameters, name, forward });
		sources.push(`typedef struct ${name} {
  uint32_t (*call)(void *, ${p}_session *, ${parameters.map(() => "void const *").concat("void *", `${p}_result **`).join(", ")});
  void *context;
  ${node.cName} closure;
  ${result.cName} const *recovery;
} ${name};
_Static_assert(sizeof(${name}) == 32 && _Alignof(${name}) == 8, "Ruby callback layout");
static inline ${p}_status ${forward}(void *context, ${p}_session *session, ${parameters.map((parameter, i) => `${parameter.cName}${parameter.leaf ? " " : " const *"}arg${i}`).concat(`${result.cName} *output`, `${p}_result **owner`).join(", ")}) {
  ${name} const *host = context;
  return (${p}_status)host->call(host->context, session, ${parameters.map((parameter, i) => `${parameter.leaf ? "&" : ""}arg${i}`).concat("output", "owner").join(", ")});
}`);
	}
	for(const [group, functions] of [["call", c.functions], ["invoke", c.callbacks], ["retain", c.retains], ["copy", c.copies]]) for(const [index, fn] of functions.entries())
	{
		const name = `${group}${group === "call" ? index : nodes.get(fn.id).index}`, symbol = `${p}_ruby_${name}`;
		claim(symbol);
		const parameters = fn.parameters.map(id => nodes.get(id)), result = nodes.get(fn.result);
		const hosts = parameters.map((_, i) => c.hostArgument(fn, i));
		calls.push({ ...fn, group, name, symbol, parameters, result, hosts });
		const setup = [], arguments_ = [];
		for(const [i, node] of parameters.entries())
		{
			const host = hosts[i] ? callbacks.find(item => item.id === node.id) : null;
			const type = host ? host.name : node.cName;
			setup.push(`  if (!ov_pointer(arg${i}, sizeof(${type}), _Alignof(${type}))) return ${invalid};`);
			if(host)
			{
				setup.push(`  ${host.name} const *host${i} = arg${i};`
					, `  ${node.cName}_host input${i} = {host${i}->call ? ${host.forward} : NULL, host${i}->call ? (void *)host${i} : host${i}->context, host${i}->closure, host${i}->recovery};`);
				arguments_.push(`&input${i}`);
			}
			else arguments_.push(node.leaf ? `*(${node.cName} const *)arg${i}` : `(${node.cName} const *)arg${i}`);
			if(fn.transfers?.includes(i)) arguments_.push(`input_owner${i}`);
		}
		sources.push(`uint32_t ${symbol}(${p}_session *session, ${parameters.flatMap((_, i) => [`void const *arg${i}`, ...fn.transfers?.includes(i) ? [`${p}_result **input_owner${i}`] : []]).concat("void *output", `${p}_result **owner`).join(", ")}) {
${setup.join("\n")}
  return (uint32_t)${fn.cName}(session, ${arguments_.concat(`(${result.cName} *)output`, "owner").join(", ")});
}`);
	}
	return { callbacks, calls, source: sources.join("\n\n") + "\n" };
};
