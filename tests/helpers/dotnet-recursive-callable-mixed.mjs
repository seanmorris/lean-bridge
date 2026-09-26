/**
 * Combine recursive values with primitive callbacks and sixteen-argument delegates.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativeRecursiveCallableReviewedIr, nativeRecursiveCallableExports, nativeRecursiveCallableArities } from './native-recursive-callable-fixture.mjs';
import { callableReviewedIr } from './callable-fixture.mjs';
import { dotnetCallableSignatures, dotnetCallableArities, dotnetCallableConsumer } from './dotnet-callable-fixture.mjs';

/**
 * Keep the documented recursive exports beside every primitive callable shape.
 *
 * @param documentedSource - Complete Lean fixture containing the published definitions.
 */
export const dotnetRecursiveMixedFixture = async documentedSource => {
	const wide = { callback: { parameters: Array(16).fill('uint32'), result: 'unit' } };
	const signatures = [...dotnetCallableSignatures
		, { name: 'Callables.wideUnit', parameters: [wide], result: 'unit' }
		, { name: 'Callables.makeWideUnit', parameters: ['unit'], result: wide }
	].map(signature => ({ ...signature, name: signature.name.replace('Callables.', 'Structured.') }));
	const ir = nativeRecursiveCallableReviewedIr(), primitive = callableReviewedIr(signatures);
	for(const type of primitive.types)
	{ assert.ok(!ir.types.some(previous => previous.id === type.id)); ir.types.push(type); }
	ir.producers.push(...primitive.producers); ir.declarations.push(...primitive.declarations);
	const sources = [documentedSource];
	for(const name of ['tests/fixtures/onboarding/callables/Callables.lean', ...['Lifetimes', 'Python', 'Dotnet'].map(name => 'tests/fixtures/callable-consumers/' + name + '.lean')]) sources.push((await readFile(name, 'utf8')).replaceAll('namespace Callables', 'namespace Structured').replaceAll('end Callables', 'end Structured'));
	const args = Array.from({ length: 16 }, (_, i) => 'a' + i);
	sources.push('namespace Structured\ndef wideUnit (callback : ' + Array(16).fill('UInt32').concat('Unit').join(' → ') + ') : Unit := callback ' + Array.from({ length: 16 }, (_, i) => i + 1).join(' ') + '\ndef makeWideUnit (_ : Unit) : ' + Array(16).fill('UInt32').concat('Unit').join(' → ') + ' := fun ' + Array(16).fill('_').join(' ') + ' => ()\nend Structured\n');
	let consumer = dotnetCallableConsumer().replace('using LeanBridge.Callables;', 'using LeanBridge.Structured;').replace('static class Program', 'static class MixedCases').replace('static void Main()', 'internal static void Run()');
	// Recursive copied input and limit errors are ArgumentException; keep the
	// primitive fixture's boundary cases while asserting this profile's exact
	// native reentry bound. Exhausting the native identity arena reports its
	// allocation failure through OutOfMemoryException, as in the graph probes.
	consumer = consumer.replaceAll('ArgumentOutOfRangeException', 'ArgumentException').replaceAll('EncoderFallbackException', 'ArgumentException');
	consumer = consumer.replace('static uint Reenter(int depth) => depth == 0 ? 42 : Api.CallUint32((uint)depth, _ => Reenter(depth - 1));', 'static int nesting;\n    static uint Reenter(int depth) => depth == 0 ? 42 : Api.CallUint32((uint)depth, _ => { ++nesting; return Reenter(depth - 1); });');
	consumer = consumer.replace('var depthError = Reject<LeanBridgeException>(() => Reenter(80)); Check(depthError.Status == 5 && depthError.Message.Contains("reentry limit (64)"));', 'nesting = 0; var depthError = Reject<ArgumentException>(() => Reenter(80)); Check(depthError.Message == "Native copied graph limit exceeded" && nesting == 64);');
	consumer = consumer.replace('catch (LeanBridgeException) { ++checks; }', 'catch (OutOfMemoryException error) { Check(error.Message == "Native copied graph allocation failed"); }');
	consumer = consumer.replace('Reject<LeanBridgeException>(() => Api.MakeUint32(1));', 'Check(Reject<OutOfMemoryException>(() => Api.MakeUint32(1)).Message == "Native copied graph allocation failed");');
	consumer = consumer.replace('        Check(Api.WordBits() == 64);', '        int unitWideCalls = 0;\n        Api.WideUnit((' + args.join(', ') + ') => { ' + args.map((name, i) => 'Check(' + name + ' == ' + (i + 1) + ');').join(' ') + ' ++unitWideCalls; });\n        Check(unitWideCalls == 1);\n        using (var action = Api.MakeWideUnit(default)) { action.Invoke(' + Array(16).fill('0').join(', ') + '); action.Dispose(); Reject<ObjectDisposedException>(() => action.Invoke(' + Array(16).fill('0').join(', ') + ')); }\n        Check(Api.WordBits() == 64);');
	return {
		ir
		, source: sources.join('\n')
		, exports: [...nativeRecursiveCallableExports, ...signatures.map(signature => signature.name)]
		, arities: { ...nativeRecursiveCallableArities, ...Object.fromEntries(Object.entries(dotnetCallableArities).map(([name, value]) => [name.replace('Callables.', 'Structured.'), value])), 'Structured.makeWideUnit': 1 }
		, consumer
	};
};
