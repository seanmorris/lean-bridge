/**
 * Bind exact published Java, Kotlin and Lean examples to installed acceptance.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativeRecursiveCallableSource } from './native-recursive-callable-fixture.mjs';

const block = (text, language) => {
	const source = text.match(new RegExp('```' + language + '\n([\\s\\S]*?)\n```'))?.[1];
	assert.ok(source, language + ' documentation block');
	return source + '\n';
};

/** Return published author definitions and unmodified standalone consumer examples. */
export const jvmRecursiveCallableDocumentation = async () => {
	const publisher = await readFile('docs/publish/maven.md', 'utf8');
	const section = publisher.split('## Recursive callback values\n')[1]?.split(/\n#{1,2} /)[0];
	assert.ok(section);
	const author = block(section, 'lean'), configuration = block(section, 'json');
	assert.deepEqual(JSON.parse(configuration), {
		schemaVersion: 1
		, modules: ['Structured']
		, exports: ['Structured.callRecursive', 'Structured.makeRecursive']
		, arities: { 'Structured.makeRecursive': 1 }
		, targets: { maven: { name: 'org.leanbridge:structured', version: '1.0.0' } }
	});
	assert.match(author, /^namespace Structured\n[\s\S]*\nend Structured\n$/u);
	let source = await nativeRecursiveCallableSource();
	const normalize = text => text.replace(/\s+/gu, ' ').trim();
	for(const definition of [
		'inductive Tree where\n  | leaf (value : Nat)\n  | branch (children : Array Tree)\n'
		, 'def callRecursive (value : Tree) (callback : Tree → Tree) := callback value\n'
		, 'def makeRecursive (captured : Tree) : Bool → Tree → Tree := fun selected value => if selected then captured else value\n'
	]) {
		assert.equal(normalize(author).split(normalize(definition)).length, 2);
		assert.equal(source.split(definition).length, 2);
		source = source.replace(definition, '');
	}
	const examples = {};
	for(const profile of ['java', 'kotlin'])
	{
		const guide = await readFile('docs/consume/' + profile + '.md', 'utf8');
		const text = guide.split('### Recursive callback values\n')[1]?.split(/\n#{1,3} /)[0];
		assert.ok(text);
		examples[profile] = {
			id: 'recursive-documentation'
			, main: 'RecursiveExample'
			, file: 'RecursiveExample.' + (profile === 'java' ? 'java' : 'kt')
			, source: block(text, profile)
			, stdout: '42\n20\n42\n'
		};
	}
	return { author, configuration, source: author + '\n' + source, examples };
};
