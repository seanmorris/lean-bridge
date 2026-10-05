/**
 * Exact negative C# callers against the original installed recursive assembly.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { runCopied } from './copied-fixture-install.mjs';
import { captureCorpusCompiler } from './type-corpus-compiler.mjs';
import { saveLakeFile } from './lake-workspace.mjs';
import { sha256 } from '../../src/capsule/node.mjs';

const cases = [
	['leaf-payload', 'new TreeLeaf("wrong");', ['CS1503']]
	, ['branch-collection', 'new TreeBranch(new System.Collections.Generic.List<Tree>());', ['CS1503']]
	, ['recursive-result', 'Api.CallRecursive(new TreeLeaf(0), value => new PacketEmpty());', ['CS0029', 'CS1662']]
	, ['nullable-tree', 'Api.CallRecursive(null, value => value);', ['CS8625']]
	, ['nullable-callback', 'Api.CallRecursive(new TreeLeaf(0), null);', ['CS8625']]
	, ['async-callback', 'Api.CallRecursive(new TreeLeaf(0), async value => { await System.Threading.Tasks.Task.Yield(); return value; });', ['CS4010']]
	, ['closure-input', 'using var owned=Api.MakeRecursive(new TreeLeaf(0)); owned.Invoke(1,new TreeLeaf(0));', ['CS1503']]
	, ['closure-result', 'using var owned=Api.MakeRecursive(new TreeLeaf(0)); Payload value=owned.Invoke(true,new TreeLeaf(0));', ['CS0029']]
	, ['nested-alias-callback', 'Api.CallNestedAlias(new Payload("",new Option<string>[0],0,Option<Result<(ulong,Unit),string>>.None), value => new Payload[0]);', ['CS0029', 'CS1662']]
	, ['closure-factory', 'new LeanClosure<System.Func<bool,Tree,Tree>>();', ['CS1729']]
];

const select = values => values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);

/**
 * Reject invalid typed consumers with exact source-located diagnostics.
 *
 * @param options - Original installed assembly and typed compiler inputs.
 * @param options.root - Task-owned negative-caller directory.
 * @param options.dotnet - Absolute .NET SDK driver.
 * @param options.assembly - Original installed public assembly.
 * @param options.environment - Offline managed compiler environment.
 * @param options.model - Checked public parameter names and signatures.
 */
export const checkDotnetRecursiveTypes = async ({ root: work, dotnet, assembly, environment, model }) => {
	const dotnetRoot = dirname(dotnet);
	const sdk = select((await runCopied(dotnet, ['--list-sdks'], work, environment)).stdout.split('\n').map(line => /^(8\.0\.\d+) \[/.exec(line)?.[1]).filter(Boolean));
	const compiler = join(dotnetRoot, 'sdk', sdk, 'Roslyn/bincore/csc.dll');
	const refs = join(dotnetRoot, 'packs/Microsoft.NETCore.App.Ref', select((await readdir(join(dotnetRoot, 'packs/Microsoft.NETCore.App.Ref'))).filter(v => v.startsWith('8.0.'))), 'ref/net8.0');
	const references = (await readdir(refs)).filter(file => file.endsWith('.dll')).sort().map(file => '/reference:' + join(refs, file));
	const rejected = [];
	const [first, second] = model.functions.find(fn => fn.publicName === 'CallRecursive').parameterNames;
	const named = 'using LeanBridge.Structured; static class Named { static Tree Call(Tree tree) => Api.CallRecursive(' + first + ': tree, ' + second + ': value => value); }\n';
	await saveLakeFile(work, 'named.cs', named);
	const accepted = await captureCorpusCompiler(dotnet, ['exec', compiler, '/nologo', '/noconfig', '/nostdlib+', '/target:library', '/langversion:12', '/nullable:enable', '/warnaserror+', ...references, '/reference:' + assembly, '/out:named.dll', 'named.cs'], work, environment);
	assert.equal(accepted.code, 0, accepted.stdout + accepted.stderr);
	for(const [name, statement, codes] of cases)
	{
		const source = 'using LeanBridge.Structured; static class Invalid { static void Test() { ' + statement + ' } }\n', file = 'reject-' + name + '.cs';
		await saveLakeFile(work, file, source);
		const result = await captureCorpusCompiler(dotnet, ['exec', compiler, '/nologo', '/noconfig', '/nostdlib+', '/target:library', '/langversion:12', '/nullable:enable', '/warnaserror+', ...references, '/reference:' + assembly, '/out:rejected.dll', file], work, environment);
		assert.equal(result.code, 1, result.stdout + result.stderr);
		assert.deepEqual([...result.stdout.matchAll(/error (CS\d+):/g)].map(m => m[1]), codes, result.stdout);
		assert.ok(result.stdout.includes(file + '(')); rejected.push({ name, codes, sourceSha256: sha256(source) });
	}
	return { sdk, rejected, namedArgumentSourceSha256: sha256(named), namedArgumentsCompile: true, assemblySha256: sha256(await readFile(assembly)) };
};
