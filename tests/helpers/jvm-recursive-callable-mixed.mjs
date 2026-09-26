/**
 * All primitive signatures and wide Unit callbacks beside recursive JVM values.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativeRecursiveCallableReviewedIr, nativeRecursiveCallableSource, nativeRecursiveCallableExports, nativeRecursiveCallableArities } from './native-recursive-callable-fixture.mjs';
import { callableReviewedIr } from './callable-fixture.mjs';
import { jvmCallableSignatures, jvmCallableArities, jvmCallableConsumer, jvmCallableRejections } from './jvm-callable-fixture.mjs';
import { jvmStructuredCallableConsumer, jvmStructuredCallableRejections } from './jvm-structured-callable-fixture.mjs';

/**
 * Combine the recursive author with all nineteen primitive callback families.
 *
 * @param documentedSource - Exact documented Lean definitions combined with the remaining fixture.
 */
export const jvmRecursiveMixedFixture = async (documentedSource) => {
	const wide = { callback: { parameters: Array(16).fill('uint32'), result: 'unit' } };
	const signatures = [...jvmCallableSignatures
		, { name: 'Callables.wideUnit', parameters: [wide], result: 'unit' }
		, { name: 'Callables.makeWideUnit', parameters: ['unit'], result: wide }].map(signature => ({ ...signature, name: signature.name.replace('Callables.', 'Structured.') }));
	const ir = nativeRecursiveCallableReviewedIr(), primitive = callableReviewedIr(signatures);
	for(const type of primitive.types)
	{ assert.ok(!ir.types.some(previous => previous.id === type.id)); ir.types.push(type); }
	ir.producers.push(...primitive.producers); ir.declarations.push(...primitive.declarations);
	const source = [documentedSource ?? await nativeRecursiveCallableSource()];
	for(const path of ['tests/fixtures/onboarding/callables/Callables.lean', ...['Lifetimes', 'Python', 'Dotnet', 'Jvm'].map(name => 'tests/fixtures/callable-consumers/' + name + '.lean')])
		source.push((await readFile(path, 'utf8')).replaceAll('namespace Callables', 'namespace Structured').replaceAll('end Callables', 'end Structured'));
	source.push('namespace Structured\ndef wideUnit (callback : ' + Array(16).fill('UInt32').concat('Unit').join(' → ') + ') : Unit := callback ' + Array.from({ length: 16 }, (_, i) => i + 1).join(' ') + '\ndef makeWideUnit (_ : Unit) : ' + Array(16).fill('UInt32').concat('Unit').join(' → ') + ' := fun ' + Array(16).fill('_').join(' ') + ' => ()\nend Structured\n');
	return {
		ir
		, source: source.join('\n')
		, exports: [...nativeRecursiveCallableExports, ...signatures.map(signature => signature.name)]
		, arities: { ...nativeRecursiveCallableArities, ...Object.fromEntries(Object.entries(jvmCallableArities).map(([name, value]) => [name.replace('Callables.', 'Structured.'), value])), 'Structured.makeWideUnit': 1 }
	};
};

/**
 * Exercise original primitive contracts beside recursive copied data.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmRecursiveMixedConsumer = profile => {
	let source = jvmCallableConsumer(profile).replaceAll('org.leanbridge.callables', 'org.leanbridge.structured').replace('"Callables"', '"Structured"');
	const args = Array.from({ length: 16 }, (_, i) => 'a' + i), zeros = Array(16).fill('0L').join(', ');
	if(profile === 'java')
	{
		source = source.replace('reject(LeanBridgeException.class, () -> reenter(80))', 'reject(IllegalArgumentException.class, () -> reenter(80))')
			.replace('contains("reentry limit (64)")', 'contains("Lean callable reentry limit exceeded")')
			.replace('catch (LeanBridgeException full)', 'catch (OutOfMemoryError full)')
			.replace('reject(LeanBridgeException.class, () -> Api.makeUint32(1))', 'reject(OutOfMemoryError.class, () -> Api.makeUint32(1))');
		source = source.replace('        check(Api.wordBits() == 64);', `        int[] unitWideCalls = {0};
        Api.wideUnit((${args.join(', ')}) -> { ${args.map((name, i) => 'check(' + name + ' == ' + (i + 1) + 'L);').join(' ')} ++unitWideCalls[0]; });
        check(unitWideCalls[0] == 1);
        var unitWide = Api.makeWideUnit(Unit.INSTANCE);
        try { unitWide.invoke(${zeros}); unitWide.close(); reject(IllegalStateException.class, () -> unitWide.invoke(${zeros})); }
        finally { unitWide.close(); }
        check(Api.wordBits() == 64);`);
	} else
	{
		source = source.replace('import org.leanbridge.structured.*', 'import org.leanbridge.structured.*\nimport org.leanbridge.structured.kotlin.Api')
			.replace('reject(LeanBridgeException::class.java) { reenter(80) }', 'reject(IllegalArgumentException::class.java) { reenter(80) }')
			.replace('contains("reentry limit (64)")', 'contains("Lean callable reentry limit exceeded")')
			.replace('reject(LeanBridgeException::class.java) { Api.makeUint32(1) }', 'reject(OutOfMemoryError::class.java) { Api.makeUint32(1) }');
		// Kotlin's metadata API rejects null at compile time. Use its Java companion
		// only for the established platform-type runtime null checks.
		source = source.replace(/Api\.(call\w+)\(values\[0\], null\)/g, 'org.leanbridge.structured.Api.$1(values[0], null)')
			.replace(/Api\.(call\w+)\(([^\n]+)\) \{ null \}/g, 'org.leanbridge.structured.Api.$1($2) { null }');
		source = source.replace('    verify(Api.wordBits() == 64L)', `    var unitWideCalls = 0
    Api.wideUnit { ${args.join(', ')} -> ${args.map((name, i) => 'verify(' + name + ' == ' + (i + 1) + 'L)').join('; ')}; ++unitWideCalls }
    verify(unitWideCalls == 1)
    Api.makeWideUnit(LeanUnit.INSTANCE).use { owned ->
        owned.invoke(${zeros}); owned.close()
        reject(IllegalStateException::class.java) { owned.invoke(${zeros}) }
    }
    verify(Api.wordBits() == 64L)`);
	}
	return source;
};

/**
 * Keep primitive and acyclic compile-time rejections in the mixed package.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmRecursiveMixedRejections = profile => [
	...jvmCallableRejections(profile).map(entry => ({
		...entry
		, source: entry.source
			.replaceAll('org.leanbridge.callables', 'org.leanbridge.structured')
			.replace('import org.leanbridge.structured.*;', profile === 'kotlin' ? 'import org.leanbridge.structured.*;\nimport org.leanbridge.structured.kotlin.Api;' : 'import org.leanbridge.structured.*;')
	}))
	, ...jvmStructuredCallableRejections(profile)
];

/**
 * Execute the complete acyclic consumer without top-level helper collisions.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmRecursiveAcyclicExample = profile => {
	let source = jvmStructuredCallableConsumer(profile);
	const count = profile === 'java' ? 257978 : 177270;
	const stdout = JSON.stringify({ profile, acyclicChecks: count }) + '\n';
	if(profile === 'java') source = source.replace(/\bConsumer\b/g, 'AcyclicExample')
		.replace(/ {8}Wire.result\([^\n]*\);\n/g, '')
		.replace(/ {8}Wire.finish\([^\n]*\);/, '        System.out.print(' + JSON.stringify(stdout) + ');');
	else
	{
		const imports = source.match(/^import .+$/gm).join('\n');
		source = source.replace(/^import .+\n/gm, '')
			.replace('fun main() {', '@JvmStatic fun main(args: Array<String>) {')
			.replace(/ {4}Wire.result\([^\n]*\)\n/g, '')
			.replace(/ {4}Wire.finish\([^\n]*\)/, '    print(' + JSON.stringify(stdout) + ')');
		source = imports + '\nobject AcyclicExample {\n' + source + '\n}\n';
	}
	// Keep the independently measured assertion count, not just a fixed message.
	source = source.replace(profile === 'java' ? 'System.out.print(' : 'print(', profile === 'java' ? 'if(checks != ' + count + ') throw new AssertionError(checks); System.out.print(' : 'check(checks == ' + count + '); print(');
	return { id: 'mixed-acyclic-public-consumer', file: 'AcyclicExample.' + (profile === 'java' ? 'java' : 'kt'), main: 'AcyclicExample', source, stdout };
};
