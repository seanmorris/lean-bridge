/**
 * Borrowed-reply ownership checks and independent missing-retirement mutations.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile, cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { copiedCleanEnvironment, runCopied } from './copied-fixture-install.mjs';
import { saveLakeFile } from './lake-workspace.mjs';
import { captureCorpusCompiler } from './type-corpus-compiler.mjs';
import { sha256 } from '../../src/capsule/node.mjs';

/**
 * Prove the probes detect premature reply release and missing retirement.
 *
 * @param options - Isolated instrumented copies and original type layouts.
 * @param options.root - Task-owned directories for the baseline and mutations.
 * @param options.source - Previously measured allocation-fault source copies.
 * @param options.model - Checked C# layouts and callable signatures.
 * @param options.dotnet - Absolute .NET SDK driver.
 * @param options.nativeAssets - Matching isolated instrumented native assets.
 */
export const checkDotnetRecursiveOwnership = async ({ root, source, model, dotnet, nativeAssets }) => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const methods = [];
	for(const node of model.types)
	{
		const field = (field, member) => {
			const child = nodes.get(field.type), pointer = field.storage === 'pointer';
			return `${pointer ? `if (!global::FaultProbe.Allocations.Contains(${member})) return false; ` : ''}if (!Own${child.index}(${pointer ? `(${child.raw}*)${member}` : `&${member}`},depth+1)) return false;`;
		};
		const lines = ['if(value==null || depth>128)return false;'];
		if(node.kind === 'primitive')
		{
			if(['string', 'nat', 'int', 'bytes'].includes(node.ref.name)) lines.push('if(value->Length!=0 && !global::FaultProbe.Allocations.Contains(value->Data))return false;');
		} else if(node.element)
		{
			const child = nodes.get(node.element);
			lines.push('if(value->Length!=0 && !global::FaultProbe.Allocations.Contains(value->Data))return false;', `for(nuint i=0;i<value->Length;++i)if(!Own${child.index}(&(((${child.raw}*)value->Data)[i]),depth+1))return false;`);
		} else if(node.kind === 'variant')
		{
			lines.push('switch(value->Kind){', ...node.cases.map((branch, j) => `case ${j}: ${branch.fields.map((f, k) => field(f, `value->Cases.Case${j}.Field${k}`)).join(' ')} break;`), 'default:return false;', '}');
		} else if(node.kind === 'option') lines.push(`if(value->Flag!=0){${field(node.fields[0], 'value->Field0')}}`);
		else if(node.kind === 'result') lines.push(`if(value->Flag!=0){${field(node.fields[0], 'value->Field0')}}else{${field(node.fields[1], 'value->Field1')}}`);
		else lines.push(...node.fields.map((f, j) => field(f, `value->Field${j}`)));
		methods.push(`private static bool Own${node.index}(${node.raw}* value,int depth=0){${lines.join('\n')} return true;}`);
	}
	const shapes = ['Array', 'List', 'Option', 'Result', 'Tuple', 'Record', 'Variant', 'Alias', 'Recursive'];
	for(const shape of shapes)
	{
		const fn = model.functions.find(fn => fn.publicName === 'Call' + shape), node = fn.parameters[0].node, cb = fn.parameters[1].callback;
		assert.equal(cb.parameters.length, 1); assert.equal(cb.result.id, node.id);
		methods.push(`internal static ${node.publicType} Ownership${shape}(${node.publicType} value) {
   using var inputScope=new GraphScope(); var input=GraphRuntime.Write${node.index}(value,inputScope);
   using var replyScope=new GraphScope(); using var frame=new CallbackFrame(replyScope);
   var callback=Borrow${cb.index}(item=>item,frame); var output=default(${node.raw});
   var status=((delegate* unmanaged[Cdecl]<nint,${node.raw}*,${node.raw}*,uint>)callback.Call)(callback.Context,&input,&output);
   frame.Finish(status);
   if(!Own${node.index}(&output))throw new global::System.InvalidOperationException("Callback owners released before native copying: ${shape}");
   using var outputScope=new GraphScope(); return GraphRuntime.Read${node.index}(&output,outputScope);
  }`);
	}
	const ownership = `using _V=global::LeanBridge.Structured;\nnamespace LeanBridge.Structured.Interop;\ninternal static unsafe partial class GraphCalls {\n${methods.join('\n')}\n}`;
	const program = `using System;\nusing LeanBridge.Structured;\nusing LeanBridge.Structured.Interop;\ninternal static class OwnershipProgram {\nprivate static int Main(string[] args){ try {\nusing(var init=Api.MakeRecursive(new TreeLeaf(1))){}\nvar mutant=args.Length!=0; var errors=new System.Collections.Generic.List<string>(); var checks=0;\n${shapes.map(shape => `try{GraphCalls.Ownership${shape}(${shape === 'Recursive' ? 'RecursiveCases.Value(1)' : `StructuredValues.${shape === 'Alias' ? 'Record' : shape}(${['Option', 'Result'].includes(shape) ? 2 : 1})`}); ++checks;}catch(InvalidOperationException error)when(mutant && error.Message=="Callback owners released before native copying: ${shape}"){errors.Add("${shape}");}`).join('\n')}
FaultProbe.Clean(); if(mutant ? errors.Count!=8 || checks!=1 : errors.Count!=0 || checks!=9)throw new Exception("ownership coverage mismatch");\nConsole.WriteLine(System.Text.Json.JsonSerializer.Serialize(new {checks,errors,checkedBeforeDecode=true}));return 0;\n}catch(Exception error){Console.Error.WriteLine(error);return 32;} } }\n`;
	const results = {};
	for(const mode of ['baseline', 'reply-scope', 'retirement'])
	{
		const work = join(root, 'ownership-' + mode), files = {};
		for(const file of ['Values.cs', 'Runtime.cs', 'Api.cs', 'Calls.cs', 'NativeProbe.cs', 'FaultNative.cs', 'Faults.cs', 'RecursiveCases.cs', 'StructuredValues.cs', 'NuGet.Config']) files[file] = await readFile(join(source, file), 'utf8');
		const previous = JSON.stringify(join(source, 'out/runtimes/linux-x64/native', 'lib' + model.prefix + '.so'));
		const selected = JSON.stringify(join(work, 'out/runtimes/linux-x64/native', 'lib' + model.prefix + '.so'));
		for(const file of ['NativeProbe.cs', 'FaultNative.cs'])
		{
			assert.equal(files[file].split(previous).length, 2);
			files[file] = files[file].replace(previous, selected);
		}
		files['Calls.cs'] = files['Calls.cs'].replace('internal static unsafe class GraphCalls', 'internal static unsafe partial class GraphCalls');
		if(mode === 'reply-scope')
		{
			const pattern = /\*output = GraphRuntime\.(Write\d+)\(([^\n]+), frame.Replies\);/g;
			assert.equal([...files['Calls.cs'].matchAll(pattern)].length, model.callbacks.size);
			files['Calls.cs'] = files['Calls.cs'].replace(pattern, 'using (var premature = new GraphScope()) { *output = GraphRuntime.$1($2, premature); }');
		}
		if(mode === 'retirement')
		{
			const pattern = /lifecycle\.Poison\(\);/g;
			assert.equal([...files['Calls.cs'].matchAll(pattern)].length, model.functions.length + model.callbacks.size);
			files['Calls.cs'] = files['Calls.cs'].replace(pattern, '/* missing retirement mutation */');
		}
		files['Ownership.cs'] = ownership; files['OwnershipProgram.cs'] = program;
		files['Ownership.csproj'] = '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings><AllowUnsafeBlocks>true</AllowUnsafeBlocks><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableNETAnalyzers>false</EnableNETAnalyzers><EnableDefaultCompileItems>false</EnableDefaultCompileItems><StartupObject>' + (mode === 'retirement' ? 'FaultProgram' : 'OwnershipProgram') + '</StartupObject></PropertyGroup><ItemGroup>' + Object.keys(files).filter(name => name.endsWith('.cs')).map(name => '<Compile Include="' + name + '"/>').join('') + '</ItemGroup></Project>\n';
		for(const [name, content] of Object.entries(files)) await saveLakeFile(work, name, content);
		const managed = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(dotnet), DOTNET_CLI_HOME: join(work, 'home'), DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', NUGET_PACKAGES: join(work, 'packages') };
		await runCopied(dotnet, ['build', 'Ownership.csproj', '--disable-build-servers', '-p:UseSharedCompilation=false', '-o', 'out'], work, managed);
		await cp(nativeAssets, join(work, 'out/runtimes'), { recursive: true });
		console.log('fresh NuGet ownership: ' + mode);
		let result;
		if(mode === 'retirement')
		{
			const run = await captureCorpusCompiler(dotnet, ['out/Ownership.dll', 'poison'], work, managed);
			assert.equal(run.code, 32, run.stderr); assert.equal(run.stdout, ''); assert.match(run.stderr, /retirement missing after malformed output/);
			result = { rejected: true, exitCode: run.code, stderr: run.stderr };
		}
		else
		{
			const run = await runCopied(dotnet, ['out/Ownership.dll', ...mode === 'reply-scope' ? ['mutant'] : []], work, managed);
			assert.equal(run.stderr, ''); result = JSON.parse(run.stdout);
			assert.deepEqual(result.errors, mode === 'reply-scope' ? shapes.filter(shape => shape !== 'Option') : []);
		}
		results[mode] = { ...result, sources: Object.fromEntries(Object.entries(files).map(([name, text]) => [name, sha256(text)])) };
		console.log(JSON.stringify(result));
	}
	return results;
};
