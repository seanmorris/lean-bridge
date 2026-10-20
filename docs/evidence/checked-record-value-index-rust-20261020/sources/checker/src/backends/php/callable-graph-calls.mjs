/**
 * Generate public PHP wrappers and the private recursive callable engine.
 *
 * @file
 */
import { compileCallablePhpGraphPackageModel } from './callable-graph-model.mjs';
import { phpClosurePublic } from './callables.mjs';
import { phpCallableGraphTransfers, phpCallableGraphLease, phpCallableGraphRuntime } from './callable-graph-runtime.mjs';

/**
 * Emit private descriptor constants without a runtime JSON decoder.
 *
 * @param value - Finite descriptor value.
 */
export const phpCallableLiteral = value => value === null ? 'null' : typeof value === 'boolean' || typeof value === 'number' ? String(value)
	: typeof value === 'string' ? "'" + value.replaceAll('\\', '\\\\').replaceAll("'", "\\'") + "'"
		: Array.isArray(value) ? '[' + value.map(phpCallableLiteral).join(', ') + ']'
			: '[' + Object.entries(value).map(([key, entry]) => phpCallableLiteral(key) + ' => ' + phpCallableLiteral(entry)).join(', ') + ']';

/**
 * Generate typed public functions and their bounded private FFI engine.
 *
 * @param ir - Compiler-checked Binding IR.
 */
export const generateCallablePhpGraphSources = ir => {
	const model = compileCallablePhpGraphPackageModel(ir), files = { ...model.files };
	const copied = node => ({ type: node.index, aggregate: node.aggregate });
	const value = site => site.callback ? { callback: site.callback.index } : copied(site.node);
	const callbacks = [...model.callbacks.values()].map(cb => ({ index: cb.index, ctype: 'lb_php_callback_' + cb.index, parameters: cb.parameters.map(copied), result: copied(cb.result), call: cb.call, dispose: cb.dispose }));
	const functions = model.functions.map(fn => ({ name: fn.publicName, symbol: fn.native, parameters: fn.parameters.map(value), result: value(fn.result) }));
	const definitions = [
		'uint32_t ' + model.prefix + '_graph_initialize(void);'
		, 'int ' + model.prefix + '_graph_ready(void);'
		, 'void ' + model.prefix + '_graph_retire(void);'
		, 'void ' + model.prefix + '_php_graph_clear(void *);'
		, ...callbacks.flatMap(cb => [
			'typedef struct { uint32_t (*call)(void *, ' + Array(cb.parameters.length + 1).fill('void *').join(', ') + '); void *context; } ' + cb.ctype + ';'
			, 'uint32_t ' + cb.call + '(uint64_t, ' + Array(cb.parameters.length + 1).fill('void *').join(', ') + ');'
			, 'void ' + cb.dispose + '(uint64_t);'])
		, ...functions.map(fn => 'uint32_t ' + fn.symbol + '(' + Array(fn.parameters.length + 1).fill('void *').join(', ') + ');')
	].join('\n');
	const doc = site => site.callback ? site.callback.docType : site.node.docType;
	files['src/Api.php'] += '\n' + phpClosurePublic + "\nrequire_once __DIR__ . '/Internal/Native.php';\n\n" + model.functions.map(fn => [
		'/**'
		, ...fn.parameters.map((site, index) => ' * @param ' + doc(site) + ' $' + fn.parameterNames[index])
		, ' * @return ' + (fn.result.callback ? 'LeanClosure&' + doc(fn.result) : doc(fn.result))
		, ' */'
		, 'function ' + fn.publicName + '(' + fn.parameterNames.map(name => 'mixed $' + name).join(', ') + '): ' + (fn.result.callback ? 'LeanClosure' : fn.result.node.publicType) + ' {'
		, '    if (\\func_num_args() !== ' + fn.parameters.length + ") throw new \\ArgumentCountError('" + fn.publicName + ' requires exactly ' + fn.parameters.length + " arguments');"
		, "    return Internal\\Native::call('" + fn.publicName + "', [" + fn.parameterNames.map(name => '$' + name).join(', ') + ']);'
		, '}'
	].join('\n')).join('\n\n') + '\n';
	files['src/Internal/CallableRuntime.php'] = [
		'<?php'
		, 'declare(strict_types=1);'
		, 'namespace ' + model.namespace + '\\Internal;'
		, ''
		, "require_once __DIR__ . '/Runtime.php';"
		, "require_once __DIR__ . '/GraphNative.php';"
		, ''
		, phpCallableGraphTransfers
		, phpCallableGraphLease
		, phpCallableGraphRuntime
	].join('\n').replaceAll('GRAPH_NAMESPACE', '\\' + model.namespace);
	files['src/Internal/CallableTypes.php'] = [
		'<?php'
		, 'declare(strict_types=1);'
		, 'namespace ' + model.namespace + '\\Internal;'
		, ''
		, 'final class CallableTypes'
		, '{'
		, '    public const CATALOG = ' + phpCallableLiteral({ prefix: model.prefix, callbacks, functions }) + ';'
		, '}'
		, ''
	].join('\n');
	if(Object.values(files).reduce((sum, text) => sum + Buffer.byteLength(text), 0) > 16 * 1024 * 1024) throw new TypeError('PHP callable sources exceed 16 MiB');
	return { ...model, files, definitions, catalog: { prefix: model.prefix, callbacks, functions } };
};
