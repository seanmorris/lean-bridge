/**
 * Public PHP functions and typed callback trampolines for the owned C API.
 *
 * @file
 */
import { generateOwnedPhpConversions } from "./owned-conversions.mjs";
import { ownedPhpRuntime } from "./owned-runtime.mjs";
import { ownedPhpCallRuntime } from "./owned-call-runtime.mjs";
import { ownedCallbackRecovery } from "../../build/owned-callback-carriers.mjs";
import { phpCallableLiteral as literal } from "./callable-graph-calls.mjs";

/**
 * Emit call-scoped host descriptors. The C wrapper snapshots each PHP reply
 * before its C argument owner expires, using generated public copies/retains.
 * An authenticated package loader is supplied separately by packaging.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param options - Explicit transport capabilities.
 */
export const generateOwnedPhpCalls = (ir, options = {}) => {
	const model = generateOwnedPhpConversions(ir, options), { c, namespace } = model;
	const transferredInputs = model.functions.some(fn => fn.transfers?.length);
	const anchoredResults = c.anchoredResults;
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const types = new Map(c.native.model.types.map(node => [node.id, node]));
	for(const helper of ["with_recovery", ...anchoredResults ? ["copy_value"] : []])
		if(model.functions.some(fn => fn.publicName.toLowerCase() === helper))
			throw new TypeError(`Owned PHP function collides with ${helper}`);
	const claim = name => {
		if(new RegExp(`\\b${name}\\b`, "u").test(c.header)) throw new TypeError(`Owned PHP native helper collides with ${name}`);
		return name;
	};
	const input = node => node.cName + (node.leaf ? "" : " const *");
	const extra = [], source = [model.nativeSource], callbacks = {};
	for(const callback of c.callbacks)
	{
		const node = nodes.get(callback.id), result = nodes.get(callback.result);
		const parameters = callback.parameters.slice(1).map(id => nodes.get(id));
		const ctype = claim(`${c.prefix}_php_callback_${node.index}`);
		const invoke = claim(`${ctype}_invoke`);
		const definition = `typedef struct ${ctype} {
  uint32_t (*call)(void *, ${c.prefix}_session *${parameters.map(() => ", void *").join("")}, void *);
  void *context;
  ${node.cName} closure;
  ${result.cName} const *recovery;
  uint32_t native_status;
} ${ctype};`;
		extra.push(definition); source.push(definition);
		const copy = (result.identity ? c.retains : c.copies).find(fn => fn.id === result.id);
		source.push(`static inline ${c.prefix}_status ${invoke}(void *context, ${c.prefix}_session *session${parameters.map((node, index) => `, ${input(node)} a${index}`).join("")}, ${result.cName} *out, ${c.prefix}_result **owner) {
  ${ctype} *host = context;
  if (!host || !host->call) return ${c.prefix.toUpperCase()}_INVALID_ARGUMENT;
  ${result.cName} reply = {0};
  uint32_t status = host->call(host->context, session${parameters.map((node, index) => `, (void *)${node.leaf ? "&" : ""}a${index}`).join("")}, &reply);
  if (!status) {
    status = (uint32_t)${copy.cName}(session, ${result.leaf ? "" : "&"}reply, out, owner);
    if (status && !host->native_status) host->native_status = status;
  }
  return (${c.prefix}_status)status;
}`);
		callbacks[node.index] = { ctype, invoke
			, parameters: parameters.map(node => node.index)
			, result: result.index
			, requiresRecovery: ownedCallbackRecovery(c.native.model, types.get(node.id), id => id) === null };
	}
	const calls = [...c.functions, ...c.callbacks, ...c.retains, ...c.copies].map((fn, index) => {
		const parameters = fn.parameters.map((id, index) => {
			const parameter = { type: nodes.get(id).index, host: c.hostArgument(fn, index) };
			if(fn.transfers?.includes(index))
			{
				const snapshot = [...c.retains, ...c.copies].find(copy => copy.result === id);
				if(!snapshot) throw new TypeError(`Missing PHP transfer snapshot for ${id}`);
				parameter.transfer = snapshot.cName;
			}
			if(fn.anchor === index) parameter.anchor = true;
			return parameter;
		});
		const result = nodes.get(fn.result), host = parameters.some(parameter => parameter.host);
		const symbol = host ? claim(`${c.prefix}_php_call_${index}`) : fn.cName;
		if(host)
		{
			const signature = `${c.prefix}_status ${symbol}(${c.prefix}_session *session, ${[
				...parameters.flatMap((parameter, index) => [
					`${parameter.host ? `${callbacks[parameter.type].ctype} *` : input(model.types[parameter.type])} a${index}`
					, ...parameter.transfer ? [`${c.prefix}_result **a${index}_owner`] : []
					, ...parameter.anchor ? [`${c.prefix}_result *a${index}_anchor`] : []
				])
				, `${result.cName} *out`, `${c.prefix}_result **owner`
			].join(", ")})`;
			extra.push(signature + ";"); source.push(signature + " {");
			for(const [index, parameter] of parameters.entries()) if(parameter.host)
			{
				const node = model.types[parameter.type], callback = callbacks[parameter.type];
				source.push(`  ${node.cName}_host host${index} = {0};
  if (a${index}) {
    host${index}.call = a${index}->call ? ${callback.invoke} : NULL;
    host${index}.context = a${index}->call ? (void *)a${index} : NULL;
    host${index}.closure = a${index}->closure;
    host${index}.recovery = a${index}->recovery;
  }`);
			}
			source.push(`  return ${fn.cName}(session, ${[...parameters.flatMap((parameter, index) => [
				parameter.host ? `a${index} ? &host${index} : NULL` : `a${index}`
				, ...parameter.transfer ? [`a${index}_owner`] : []
				, ...parameter.anchor ? [`a${index}_anchor`] : []
			])
			, "out", "owner"].join(", ")});`, "}");
		}
		return { symbol, parameters, result: result.index
			, ...anchoredResults ? { whole: result.representation !== "copied" && !fn.retain && !fn.copy, anchor: fn.anchor ?? null } : {} };
	});
	const closures = Object.fromEntries(c.callbacks.map((fn, index) => [nodes.get(fn.id).index, c.functions.length + index]));
	const retains = Object.fromEntries(c.retains.map((fn, index) => [nodes.get(fn.id).index, c.functions.length + c.callbacks.length + index]));
	const functions = Object.fromEntries(model.functions.map((fn, index) => [fn.publicName, index]));
	const copies = Object.fromEntries([...c.retains, ...c.copies].map((fn, index) => [nodes.get(fn.result).index, c.functions.length + c.callbacks.length + index]));
	const nominals = Object.fromEntries(model.types.filter(node => node.representation !== "copied").flatMap(node =>
		(node.identity || node.kind === "record" ? [node.publicType] : node.cases.map(branch => branch.publicName))
			.map(name => [`${namespace}\\${name}`, node.index])));
	const results = Object.fromEntries(model.functions.filter(fn => nodes.get(fn.result).representation !== "copied")
		.map(fn => [fn.publicName, nodes.get(fn.result).index]));
	const parameters = Object.fromEntries(model.functions.flatMap(fn => fn.parameters.flatMap((id, index) => nodes.get(id).representation === "copied" ? [] : [
		[`${fn.publicName}/${index}`, nodes.get(id).index]
		, [`${fn.publicName}/${fn.declaration.parameters[index].name}`, nodes.get(id).index]
	])));
	const definitions = model.definitions + "\n" + extra.join("\n") + "\nvoid lean_bridge_native_runtime_retire(void);\n";
	const publicFunctions = model.functions.map(fn => {
		const result = nodes.get(fn.result), parameters = fn.parameters.map(id => nodes.get(id));
		const whole = anchoredResults && result.representation !== "copied";
		return `/**
${parameters.map((node, index) => ` * @param ${anchoredResults && (fn.anchor === index || fn.transfers?.includes(index)) ? `Value<${node.docType}>` : node.kind === "callback" && !fn.transfers?.includes(index) ? `callable|${node.docType}|WithRecovery` : node.docType} $${fn.publicParameters[index]}`).join("\n")}${fn.transfers?.length ? `\n * Consumes ${anchoredResults ? "original whole owners" : "resource leases"} in ${fn.transfers.map(index => "$" + fn.publicParameters[index]).join(", ")} at the Lean call boundary.` : ""}
 * @return ${whole ? `Value<${result.docType}>` : result.docType}
 */
function ${fn.publicName}(${fn.publicParameters.map(name => `mixed $${name}`).join(", ")}): ${whole ? "Value" : result.publicType} {
    if (\\func_num_args() !== ${parameters.length}) throw new \\ArgumentCountError('${fn.publicName} requires exactly ${parameters.length} arguments');
    return Internal\\Native::call('${fn.publicName}', [${fn.publicParameters.map(name => `$${name}`).join(", ")}]);
}
`;
	}).join("\n");
	const files = { ...model.files };
	files["src/Api.php"] += `
final readonly class WithRecovery
{
    public function __construct(public mixed $callback, public mixed $value) {
        if (\\func_num_args() !== 2) throw new \\ArgumentCountError('WithRecovery requires a callback and typed value');
    }
}
function with_recovery(mixed $callback, mixed $value): WithRecovery {
    if (\\func_num_args() !== 2) throw new \\ArgumentCountError('with_recovery requires two arguments');
    return new WithRecovery($callback, $value);
}
require_once __DIR__ . '/Internal/OwnedCalls.php';
` + publicFunctions;
	files["src/Internal/OwnedCallTypes.php"] = `<?php\ndeclare(strict_types=1);\nnamespace ${namespace}\\Internal;\n\nfinal class OwnedCallTypes\n{\n    public const DEFINITIONS = <<<'CDEFS'\n${definitions}CDEFS;\n    public const CALLS = ${literal(calls)};\n    public const CALLBACKS = ${literal(callbacks)};\n    public const FUNCTIONS = ${literal(functions)};\n    public const CLOSURES = ${literal(closures)};\n    public const RETAINS = ${literal(retains)};\n}\n`;
	if(anchoredResults)
	{
		files["src/Api.php"] += `
function copy_value(mixed $value, mixed $resultOf = null, mixed $parameterOf = null): Value {
    if (\\func_num_args() > 3) throw new \\ArgumentCountError('copy_value accepts a payload and optional selector');
    if (($resultOf !== null && !\\is_string($resultOf)) || ($parameterOf !== null && !\\is_array($parameterOf)))
        throw new \\TypeError('copy_value requires a string resultOf or an array parameterOf');
    return Internal\\Native::copyValue($value, $resultOf, $parameterOf);
}
`;
		files["src/Internal/OwnedCallTypes.php"] = files["src/Internal/OwnedCallTypes.php"].replace("    public const CALLS =", `    public const COPIES = ${literal(copies)};\n    public const NOMINALS = ${literal(nominals)};\n    public const RESULTS = ${literal(results)};\n    public const PARAMETERS = ${literal(parameters)};\n    public const EQUALITY = ${literal(Object.fromEntries(model.types.filter(node => node.identity).map(node => [node.index, node.cName + "_equal"])))};\n    public const CALLS =`);
	}
	files["src/Internal/OwnedRuntime.php"] = `<?php\ndeclare(strict_types=1);\nnamespace ${namespace}\\Internal;\n${ownedPhpRuntime(c.prefix, { transferredInputs, anchoredResults })}`;
	files["src/Internal/OwnedCalls.php"] = `<?php\ndeclare(strict_types=1);\nnamespace ${namespace}\\Internal;\n\nrequire_once __DIR__ . '/OwnedRuntime.php';\nrequire_once __DIR__ . '/OwnedConversions.php';\nrequire_once __DIR__ . '/OwnedCallTypes.php';\n${ownedPhpCallRuntime({ transferredInputs, anchoredResults }).replaceAll("@NAMESPACE@", `\\${namespace}`)}`;
	if(Object.values(files).reduce((sum, text) => sum + Buffer.byteLength(text), 0) > 16 * 1024 * 1024)
		throw new TypeError("Owned PHP call sources exceed 16 MiB");
	return { ...model, files, definitions, callbacks, calls, functionIndices: functions, closures, retains, nativeSource: source.join("\n") + "\n" };
};
