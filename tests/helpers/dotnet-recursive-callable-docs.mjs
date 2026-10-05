/**
 * Compile documented Lean definitions and execute their exact C# consumer.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativeRecursiveCallableSource } from './native-recursive-callable-fixture.mjs';

/** Return checked publisher definitions, export choices and exact consumer text. */
export const dotnetRecursiveCallableDocumentation = async () => {
	const publisher = await readFile('docs/publish/nuget.md', 'utf8');
	const text = publisher.split('### Export recursive callbacks and closures\n')[1]?.split(/\n#{1,3} /)[0];
	assert.ok(text);
	const guide = await readFile('docs/consume/dotnet.md', 'utf8');
	const author = text.match(/```lean\n([\s\S]*?)\n```/u)?.[1];
	const configuration = text.match(/```json\n([\s\S]*?)\n```/u)?.[1];
	const consumer = guide.match(/### Recursive callback values\n[\s\S]*?```csharp\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(author && configuration && consumer);
	assert.match(author, /^namespace Structured\n[\s\S]*\nend Structured$/u);
	assert.deepEqual(JSON.parse(configuration), {
		schemaVersion: 1
		, modules: ['Structured']
		, exports: ['Structured.callRecursive', 'Structured.makeRecursive']
		, arities: { 'Structured.makeRecursive': 1 }
		, targets: { nuget: { name: 'Lean.Structured' } }
	});
	let source = await nativeRecursiveCallableSource();
	for(const definition of [
		'inductive Tree where\n  | leaf (value : Nat)\n  | branch (children : Array Tree)\n'
		, 'def callRecursive (value : Tree) (callback : Tree → Tree) := callback value\n'
		, 'def makeRecursive (captured : Tree) : Bool → Tree → Tree := fun selected value => if selected then captured else value\n'
	]) {
		assert.equal(author.split(definition).length, 2);
		assert.equal(source.split(definition).length, 2);
		source = source.replace(definition, '');
	}
	return { author, configuration, consumer, source: author + '\n\n' + source };
};
