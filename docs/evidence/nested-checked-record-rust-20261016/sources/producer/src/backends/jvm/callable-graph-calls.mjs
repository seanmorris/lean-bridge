/**
 * Generate Java SAMs and Kotlin metadata APIs for recursive callback values.
 *
 * @file
 */
import { hashBindingIr } from '../../binding-ir/canonical.mjs';
import { compileCallableJvmGraphPackageModel as compileModel } from './callable-graph-model.mjs';
import { state } from './callable-graph-runtime.mjs';

const boxes = { boolean: 'Boolean', byte: 'Byte', short: 'Short', int: 'Integer', long: 'Long', float: 'Float', double: 'Double' };
const quoted = name => name.split('.').map(part => '`' + part + '`').join('.');
const unit = node => node.ref.kind === 'primitive' && node.ref.name === 'unit';

/**
 * Generate Java SAMs and Kotlin metadata APIs for recursive callback values.
 *
 * @param ir - Validated component binding graph.
 */
export const generateCallableJvmGraphSources = ir => {
	const model = compileModel(ir), ns = model.namespace;
	const java = 'src/main/java/' + ns.replaceAll('.', '/'), kotlin = 'src/main/kotlin/' + ns.replaceAll('.', '/');
	const files = { ...model.files, ...model.kotlin.files };
	// The preexisting callable API reports null copied payloads as NPE.
	const runtimePath = java + '/_GraphRuntime.java';
	const guard = '        if (value == null || (node.kind() == 0 ? value.getClass() != node.hostType() : !node.hostType().isInstance(value)))';
	if(!files[runtimePath].includes(guard)) throw new Error('Missing copied null guard');
	files[runtimePath] = files[runtimePath].replace(guard, '        java.util.Objects.requireNonNull(value, "Copied values cannot be null");\n        if (node.kind() == 0 ? value.getClass() != node.hostType() : !node.hostType().isInstance(value))');
	const publicFiles = [...model.publicFiles, ...model.kotlin.publicFiles], internalFiles = [...model.internalFiles, ...model.kotlin.internalFiles];
	const type = (node, k = false) => {
		const host = ns + (k ? '.kotlin' : '');
		if(node.ref.kind === 'named') return host + '.' + node.publicType;
		if(node.kind === 'primitive') return unit(node) ? ns + '.Unit' : node.publicType === 'String' ? 'java.lang.String' : node.publicType;
		if(node.element) return type(model.nodes.get(node.element), k) + '[]';
		return host + '.' + ({ option: 'Option', result: 'Result', tuple: 'Pair' }[node.kind]) + '<' + node.fields.map(field => {
			const name = type(model.nodes.get(field.type), k); return boxes[name] ? 'java.lang.' + boxes[name] : name;
		}).join(', ') + '>';
	};
	const name = (cb, k) => k ? cb.kotlinJavaName : cb.publicName;
	const parameter = (value, k) => value.callback ? name(value.callback, k) : type(value.node, k);
	const result = (value, k) => value.callback ? name(value.callback, k) + '.LeanClosure' : unit(value.node) ? 'void' : type(value.node, k);
	const add = (path, source, isPublic = false) => { if(Object.hasOwn(files, path)) throw new Error('Generated source collision ' + path); files[path] = source; (isPublic ? publicFiles : internalFiles).push(path); };
	const methods = [];
	const render = (method, parameters, output, native, k, lease = false) => {
		const catalog = k ? '_KotlinGraphTypes.CATALOG' : '_GraphTypes.CATALOG';
		const resultSize = output.callback ? '8' : String(output.node.size), resultAlignment = output.callback ? '8' : String(output.node.alignment);
		const nativeArguments = [...lease ? ['token'] : [], ...parameters.map((_, i) => 'input' + i), 'output'].join(', ');
		return `    @SuppressWarnings("unchecked")
    static ${result(output, k)} ${method}(${[...lease ? ['ClosureLease lease'] : [], ...parameters.map((value, i) => parameter(value, k) + ' arg' + i)].join(', ')}) {
        enterCall();
        try {
            ${lease ? 'long token = lease.enter(); try {' : ''}
            var catalog = ${catalog};
            try (var check = new _GraphRuntime.Scope(true)) {
${parameters.map((value, i) => '                ' + (value.callback ? 'java.util.Objects.requireNonNull(arg' + i + ');' : `_GraphRuntime.write(catalog, ${value.node.index}, arg${i}, check);`)).join('\n')}
            }
            var links = _CallableGraphNative.resolve();
            try (var scope = new _GraphRuntime.Scope(false); var frame = new CallbackFrame(catalog, scope, links.lifecycle())) {
                var output = scope.allocate(${resultSize}, ${resultAlignment});
                ${!output.callback && output.node.kind === 'variant' ? 'output.set(java.lang.foreign.ValueLayout.JAVA_INT, 16, -1);' : ''}
                ${output.callback ? `var created = new ClosureLease(links.drops()[${output.callback.index}]);
                var published = new ${name(output.callback, k)}.LeanClosure(created);` : ''}
                try {
${parameters.map((value, i) => `                    var input${i} = ${value.callback ? `borrow${k && value.callback.structured ? 'Kotlin' : 'Java'}${value.callback.index}(arg${i}, frame)` : `_GraphRuntime.write(catalog, ${value.node.index}, arg${i}, scope)`};`).join('\n')}
                    links.lifecycle().before();
                    int status = (int)${native}.invokeExact(${nativeArguments});
                    frame.finish(status); links.lifecycle().after();
                    ${output.callback ? 'created.adopt(output); return published;' : `var copied = _GraphRuntime.read(catalog, ${output.node.index}, output, scope);
                    _GraphRuntime.checkpoint(); links.lifecycle().after();
                    ${unit(output.node) ? 'return;' : 'return (' + type(output.node, k) + ')copied;'}`}
                } catch (_GraphRuntime.InvalidNative failure) {
                    links.lifecycle().poison(); throw new LeanBridgeException(4, failure.getMessage(), failure);
                } finally {
                    ${output.callback ? `long remaining = output.get(java.lang.foreign.ValueLayout.JAVA_LONG, 0); if (remaining != 0) links.drops()[${output.callback.index}].invokeExact(remaining);` : output.node.aggregate ? 'links.clear().invokeExact(output);' : ''}
                }
            }
            ${lease ? '} finally { lease.leave(); }' : ''}
        } catch (Throwable error) { throw rethrow(error); }
        finally { leaveCall(); }
    }`;
	};
	for(const cb of model.callbacks.values())
	{
		for(const k of cb.structured ? [false, true] : [false])
		{
			const family = k ? 'Kotlin' : 'Java', publicName = name(cb, k), output = { node: cb.result };
			const args = cb.parameters.map((node, i) => type(node, k) + ' arg' + i).join(', '), params = cb.parameters.map((_, i) => 'arg' + i).join(', ');
			add(java + '/' + publicName + '.java', `package ${ns};
@FunctionalInterface
public interface ${publicName} {
    ${result(output, k)} invoke(${args});
    final class LeanClosure implements ${publicName}, java.lang.AutoCloseable {
        private final _CallableGraphRuntime.ClosureLease lease;
        private final java.lang.ref.Cleaner.Cleanable cleanable;
        LeanClosure(_CallableGraphRuntime.ClosureLease lease) { this.lease = lease; cleanable = _CallableGraphRuntime.register(this, lease); }
        @Override public ${result(output, k)} invoke(${args}) {
            try { ${unit(cb.result) ? '' : 'return '}_CallableGraphRuntime.invoke${family}${cb.index}(lease${params ? ', ' + params : ''}); }
            finally { java.lang.ref.Reference.reachabilityFence(this); }
        }
        public boolean isClosed() { return lease.isClosed(); }
        @Override public void close() { lease.close(); cleanable.clean(); }
    }
}
`, true);
			const descriptor = 'DESC' + family + cb.index, host = 'Host' + family + cb.index, thunk = 'callback' + family + cb.index;
			methods.push(`    private static final java.lang.foreign.FunctionDescriptor ${descriptor} = java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT, ${Array.from({ length: cb.parameters.length + 2 }, () => 'java.lang.foreign.ValueLayout.ADDRESS').join(', ')});
    private static final java.lang.invoke.MethodHandle UPCALL${family}${cb.index} = upcall${family}${cb.index}();
    private static java.lang.invoke.MethodHandle upcall${family}${cb.index}() {
        try { return java.lang.invoke.MethodHandles.lookup().findStatic(_CallableGraphRuntime.class, "${thunk}", ${descriptor}.toMethodType().insertParameterTypes(0, ${host}.class)); }
        catch (java.lang.ReflectiveOperationException error) { throw new java.lang.ExceptionInInitializerError(error); }
    }
    private record ${host}(${publicName} callback, CallbackFrame frame) { }
    private static int ${thunk}(${host} state, java.lang.foreign.MemorySegment context, ${cb.parameters.map((_, i) => 'java.lang.foreign.MemorySegment p' + i + ', ').join('')}java.lang.foreign.MemorySegment output) {
        var frame = state.frame();
        if (frame.failure != null) return 6;
        try {
            frame.before();
${cb.parameters.map((node, i) => `            var arg${i} = (${type(node, k)})_GraphRuntime.read(frame.catalog, ${node.index}, p${i}, frame.replies);`).join('\n')}
            ${unit(cb.result) ? '' : 'var result = '}state.callback().invoke(${params});
            frame.lifecycle.after();
            var reply = _GraphRuntime.write(frame.catalog, ${cb.result.index}, ${unit(cb.result) ? 'Unit.INSTANCE' : 'result'}, frame.replies);
            java.lang.foreign.MemorySegment.copy(reply, 0, _GraphRuntime.checked(output, 1, ${cb.result.size}, ${cb.result.alignment}), 0, ${cb.result.size});
            return 0;
        } catch (Throwable error) { frame.fail(error); return 6; }
    }
    private static java.lang.foreign.MemorySegment borrow${family}${cb.index}(${publicName} callback, CallbackFrame frame) {
        var host = new ${host}(java.util.Objects.requireNonNull(callback), frame); frame.keep(host);
        var stub = java.lang.foreign.Linker.nativeLinker().upcallStub(UPCALL${family}${cb.index}.bindTo(host), ${descriptor}, frame.replies.arena);
        var output = frame.replies.allocate(16, 8); output.set(java.lang.foreign.ValueLayout.ADDRESS, 0, stub); return output;
    }`);
			methods.push(render('invoke' + family + cb.index, cb.parameters.map(node => ({ node })), output, `links.invokes()[${cb.index}]`, k, true));
		}
		add(kotlin + '/kotlin/' + cb.publicName + '.kt', `package ${quoted(ns + '.kotlin')}
typealias ${quoted(cb.publicName)} = ${quoted(ns + '.' + cb.kotlinJavaName)}
`, true);
	}
	for(const k of [false, true]) for(const fn of model.functions) methods.push(render('call' + (k ? 'Kotlin' : 'Java') + fn.index, fn.parameters, fn.result, `links.exports()[${fn.index}]`, k));
	add(java + '/_CallableGraphRuntime.java', `package ${ns};
final class _CallableGraphRuntime {
    private _CallableGraphRuntime() { }
${state}
${methods.join('\n')}
}
`);
	add(java + '/_CallableGraphNative.java', `package ${ns};
final class _CallableGraphNative {
    private _CallableGraphNative() { }
    record Links(java.lang.invoke.MethodHandle[] exports, java.lang.invoke.MethodHandle[] invokes,
        java.lang.invoke.MethodHandle[] drops, java.lang.invoke.MethodHandle clear, _GraphRuntime.Lifecycle lifecycle) { }
    static Links resolve() { throw new IllegalStateException("Build a prepared Maven release before calling this API"); }
}
`);
	add(java + '/Api.java', `package ${ns};
public final class Api {
    private Api() { }
${model.functions.map(fn => `    public static ${result(fn.result, false)} ${fn.publicName}(${fn.parameters.map((value, i) => parameter(value, false) + ' ' + fn.parameterNames[i]).join(', ')}) {
        ${!fn.result.callback && unit(fn.result.node) ? '' : 'return '}_CallableGraphRuntime.callJava${fn.index}(${fn.parameterNames.join(', ')});
    }`).join('\n')}
}
`, true);
	add(kotlin + '/_KotlinCallableGraphApiCalls.kt', `package ${quoted(ns)}
internal object _KotlinCallableGraphApiCalls {
${model.functions.map(fn => `    @kotlin.jvm.JvmSynthetic fun call${fn.index}(${fn.parameters.map((value, i) => 'arg' + i + ': ' + (value.callback ? quoted(ns + '.' + value.callback.kotlinJavaName) : model.kotlin.publicTypes[value.node.id])).join(', ')}) =
        _CallableGraphRuntime.callKotlin${fn.index}(${fn.parameters.map((_, i) => 'arg' + i).join(', ')})`).join('\n')}
}
`);
	add(kotlin + '/kotlin/Api.kt', `package ${quoted(ns + '.kotlin')}
class Api private constructor() {
    companion object {
${model.functions.map(fn => `        @kotlin.jvm.JvmStatic
        fun ${quoted(fn.publicName)}(${fn.parameters.map((value, i) => quoted(fn.parameterNames[i]) + ': ' + (value.callback ? quoted(ns + '.' + value.callback.kotlinJavaName) : model.kotlin.publicTypes[value.node.id])).join(', ')})${fn.result.callback ? '' : ': ' + (unit(fn.result.node) ? 'kotlin.Unit' : model.kotlin.publicTypes[fn.result.node.id])} =
            ${quoted(ns)}._KotlinCallableGraphApiCalls.call${fn.index}(${fn.parameterNames.map(quoted).join(', ')})`).join('\n')}
    }
}
`, true);
	files['binding-manifest.json'] = JSON.stringify({
		schemaVersion: 1
		, generator: 'jvm-copied-graph-v1'
		, target: 'jvm'
		, namespace: ns
		, bindingIrSha256: hashBindingIr(ir)
		, component: ir.component.id
		, publicFiles
		, internalFiles
		, files: Object.keys(files)
		, kotlin: { namespace: ns + '.kotlin', metadataVersion: '2.2.0' }
	});
	if(Object.values(files).reduce((size, value) => size + value.length, 0) > 16 * 1024 * 1024) throw new TypeError('JVM callable sources exceed 16 MiB');
	return { ...model, files, publicFiles, internalFiles };
};
