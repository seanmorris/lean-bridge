/**
 * Independent compile-time rejection cases for recursive JVM callbacks.
 *
 * @file
 */
import { nativeRecursiveCallableReviewedIr } from './native-recursive-callable-fixture.mjs';

/**
 * Return source-located invalid recursive callers for the selected JVM language.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmRecursiveCallableRejections = profile => {
	const ir = nativeRecursiveCallableReviewedIr(), make = ir.declarations.find(fn => fn.name === 'makeRecursive');
	const callback = 'Fn' + ir.types.find(type => type.id === make.result.type.id).name;
	const java = profile === 'java';
	const cases = java ? [
		['leaf-payload', 'new TreeLeaf("wrong");', 'compiler.err.cant.apply.symbol']
		, ['branch-collection', 'new TreeBranch(java.util.List.<Tree>of());', 'compiler.err.cant.apply.symbol']
		, ['callback-parameter', 'Api.callRecursive(new TreeLeaf(BigInteger.ZERO), (String value) -> new TreeLeaf(BigInteger.ZERO));', 'compiler.err.cant.apply.symbol']
		, ['callback-result', 'Api.callRecursive(new TreeLeaf(BigInteger.ZERO), value -> new PacketEmpty());', 'compiler.err.cant.apply.symbol']
		, ['async-result', 'Api.callRecursive(new TreeLeaf(BigInteger.ZERO), value -> java.util.concurrent.CompletableFuture.completedFuture(value));', 'compiler.err.cant.apply.symbol']
		, ['closure-argument', 'Api.makeRecursive(new TreeLeaf(BigInteger.ZERO)).invoke(1, new TreeLeaf(BigInteger.ZERO));', 'compiler.err.cant.apply.symbol']
		, ['closure-result', 'String result = Api.makeRecursive(new TreeLeaf(BigInteger.ZERO)).invoke(true, new TreeLeaf(BigInteger.ZERO));', 'compiler.err.prob.found.req']
		, ['cross-language', 'Api.callRecursive(new org.leanbridge.structured.kotlin.TreeLeaf(BigInteger.ZERO), value -> value);', 'compiler.err.cant.apply.symbol']
		, ['alias-callback', 'Api.callNestedAlias(null, value -> new Payload[0]);', 'compiler.err.cant.apply.symbol']
		, ['closure-constructor', 'new ' + callback + '.LeanClosure(null);', 'compiler.err.not.def.public.cant.access']
	] : [
		['leaf-payload', 'TreeLeaf("wrong")', 'ARGUMENT_TYPE_MISMATCH']
		, ['branch-collection', 'TreeBranch(listOf<Tree>())', 'ARGUMENT_TYPE_MISMATCH']
		, ['callback-parameter', 'Api.callRecursive(TreeLeaf(BigInteger.ZERO)) { value: String -> TreeLeaf(BigInteger.valueOf(value.length.toLong())) }', 'ARGUMENT_TYPE_MISMATCH']
		, ['callback-result', 'Api.callRecursive(TreeLeaf(BigInteger.ZERO)) { PacketEmpty() }', ['RETURN_TYPE_MISMATCH', 'TYPE_MISMATCH']]
		, ['async-result', 'Api.callRecursive(TreeLeaf(BigInteger.ZERO)) { java.util.concurrent.CompletableFuture.completedFuture(it) }', ['RETURN_TYPE_MISMATCH', 'TYPE_MISMATCH']]
		, ['closure-argument', 'Api.makeRecursive(TreeLeaf(BigInteger.ZERO)).invoke(1, TreeLeaf(BigInteger.ZERO))', 'ARGUMENT_TYPE_MISMATCH']
		, ['closure-result', 'val result: String = Api.makeRecursive(TreeLeaf(BigInteger.ZERO)).invoke(true, TreeLeaf(BigInteger.ZERO)); println(result)', ['INITIALIZER_TYPE_MISMATCH', 'TYPE_MISMATCH']]
		, ['cross-language', 'Api.callRecursive(org.leanbridge.structured.TreeLeaf(BigInteger.ZERO)) { it }', 'ARGUMENT_TYPE_MISMATCH']
		, ['alias-callback', 'Api.callNestedAlias(Payload("", emptyArray(), BigInteger.ZERO, Option.none())) { emptyArray<Payload>() }', ['RETURN_TYPE_MISMATCH', 'TYPE_MISMATCH']]
		, ['closure-constructor', 'org.leanbridge.structured.Kotlin' + callback + '.LeanClosure(null)', 'INVISIBLE_REFERENCE']
		, ['null-tree', 'Api.callRecursive(null) { it }', 'NULL_FOR_NONNULL_TYPE']
		, ['null-callback', 'Api.callRecursive(TreeLeaf(BigInteger.ZERO), null)', 'NULL_FOR_NONNULL_TYPE']
	];
	return cases.map(([name, expression, diagnostic]) => ({
		id: 'recursive/' + name
		, expectation: { diagnostic }
		, source: 'import org.leanbridge.structured' + (java ? '' : '.kotlin') + '.*;\nimport java.math.BigInteger;\n' + (java ? 'class Invalid { static void rejected() {' : 'fun rejected() {') + '\n' + expression + '\n}' + (java ? ' }' : '') + '\n'
	}));
};
