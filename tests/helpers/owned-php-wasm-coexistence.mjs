/**
 * Independently compiled owned and copied PHP-Wasm components share one host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildPhpWasmCopiedComponent } from "../../src/build/php-wasm-copied-component.mjs";
import { readVerifiedPhpWasmCopiedComponent } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { buildPhpWasmCopiedPackages } from "../../src/release/php-wasm-copied-package.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

/**
 * Reuse Lean declaration names to detect accidental cross-component interposition.
 *
 * @param options - Test-owned author root and pinned compiler/runtime inputs.
 */
export const buildOwnedPhpWasmPeer = async options => {
	const { author, leanPrefix, runtimeRoot, emsdkRoot, phpSource, runtimeIdentity } = options;
	const projectRoot = join(author, "peer-source"), componentRoot = join(author, "peer-component");
	const sources = {
		"lakefile.toml": 'name = "owned-peer"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Owned"\n'
		, "lean-toolchain": await readFile("tests/fixtures/onboarding/owned-dotnet-callables/lean-toolchain", "utf8")
		, "Owned.lean": "namespace Owned\ndef serial (value : Nat) : Nat := value + 100\nend Owned\n"
		, "lean-bridge.exports.json": canonicalJson({ schemaVersion: 1, modules: ["Owned"], exports: ["Owned.serial"] }) };
	for(const [path, bytes] of Object.entries(sources)) await saveLakeFile(projectRoot, path, bytes);
	const before = await lakeInputState(projectRoot);
	await buildPhpWasmCopiedComponent({ projectRoot, outputRoot: componentRoot, leanPrefix, runtimeRoot, emsdkRoot, phpSource });
	assert.deepEqual(await lakeInputState(projectRoot), before);
	const component = await readVerifiedPhpWasmCopiedComponent(componentRoot, runtimeIdentity);
	assert.equal(component.model.ownedGraph, undefined);
	assert.equal(component.model.exports.length, 1);
	const release = await buildPhpWasmCopiedPackages({ componentRoot, runtimeRoot
		, leanPrefix
		, outputRoot: join(author, "peer-release")
		, npmSettings: { name: "@lean-bridge-test/owned-peer", version: "1.0.0" }
		, composerSettings: { name: "lean-bridge-test/owned-peer", version: "1.0.0" } });
	return { release, component
		, sourceFiles: Object.fromEntries(Object.entries(sources).map(([path, bytes]) => [path, sha256(bytes)])) };
};

const runnerSource = `import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {PhpNode} from 'php-wasm/PhpNode';
import owned from '@lean-bridge-test/owned-php-wasm';
import peer from '@lean-bridge-test/owned-peer';
process.setUncaughtExceptionCaptureCallback(error=>{console.error(error.stack);process.exit(1);});
const [arrangement,ownedMode,peerMode,order]=process.argv.slice(2),libraries=[];
const entries=[[ownedMode==='lazy'?owned.lazy:owned,ownedMode],[peerMode==='lazy'?peer.lazy:peer,peerMode]];
if(order==='peer-first')entries.reverse();
const descriptors=mode=>entries.filter(entry=>entry[1]===mode).map(([api])=>arrangement==='composer'?api.extensions:api);
const php=new PhpNode({version:'8.4',autoTransaction:false,sharedLibs:descriptors('startup'),dynamicLibs:[...descriptors('lazy'),{name:'observer.so',url:new URL('./observer.so',import.meta.url),ini:false}],
  locateFile:name=>{if(name.startsWith('php8.4-lb_')||name.startsWith('liblean_bridge_php_wasm_copied_'))libraries.push(name);}});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');});php.addEventListener('error',event=>{stderr+=event.detail.join('');});
const run=async source=>{const status=await php.run(source);if(status||stderr)throw Error(JSON.stringify({status,stdout,stderr}));};
await php.binary;
const startups=entries.filter(entry=>entry[1]==='startup').length,initial=startups?startups+1:0;
assert.equal(libraries.length,initial);
const mount=async(source,target)=>{await php.mkdir(target);for(const file of await readdir(source,{withFileTypes:true})){
  if(file.isDirectory())await mount(join(source,file.name),target+'/'+file.name);
  else await php.writeFile(target+'/'+file.name,await readFile(join(source,file.name)));}};
if(arrangement==='composer')await mount('vendor','/app-vendor');
const autoload=arrangement==='composer'?"require '/app-vendor/autoload.php';":entries.map(([api])=>"require '"+api.autoload+"';").join('');
await run('<?php '+autoload);
assert.equal(libraries.length,initial);
await run("<?php try { LeanOwnedAggregates\\\\new_ticket(42,'invalid'); throw new Exception('Missing rejection'); } catch(TypeError $error) {}");
assert.equal(libraries.length,initial);
let coldCallbackRejections=0;
const preparePeer=async()=>{if(peerMode!=='lazy')return;
  const before=libraries.length;
  await run("<?php try { LeanOwnedAggregates\\\\via_nat(fn($value)=>LeanOwnedPeer\\\\serial($value),Brick\\\\Math\\\\BigInteger::of(11)); throw new Exception('Missing cold callback rejection'); } "+
    "catch(Throwable $error) { if(!str_contains($error->getMessage(),'synchronous Lean callback'))throw $error; }");
  assert.equal(libraries.length,Math.max(before,2));coldCallbackRejections++;
  await run("<?php if((string)LeanOwnedPeer\\\\serial(Brick\\\\Math\\\\BigInteger::of(0))!=='100')throw new Exception('Lazy peer did not recover');");
};
await preparePeer();
const calls="$ticket=LeanOwnedAggregates\\\\new_ticket(Brick\\\\Math\\\\BigInteger::of(77),'owned'); "+
  "try { LeanOwnedPeer\\\\serial($ticket); throw new Exception('Missing peer rejection'); } catch(TypeError $error) {} "+
  "$reply=LeanOwnedAggregates\\\\via_nat(fn($value)=>LeanOwnedPeer\\\\serial($value),Brick\\\\Math\\\\BigInteger::of(11)); "+
  "if((string)$reply!=='111'||(string)LeanOwnedAggregates\\\\serial($ticket)!=='77')throw new Exception('Component interposition'); "+
  "$copy=$ticket->retain();$ticket->close();if((string)LeanOwnedPeer\\\\serial(Brick\\\\Math\\\\BigInteger::of(5))!=='105')throw new Exception('Peer changed'); "+
  "if((string)LeanOwnedAggregates\\\\serial($copy)!=='77')throw new Exception('Retained identity changed');$copy->close();echo 'ok';";
await run('<?php '+calls);assert.equal(stdout,'ok');assert.equal(libraries.length,3);assert.equal(new Set(libraries).size,3);
assert.equal(libraries.filter(name=>name.startsWith('liblean_bridge_php_wasm_copied_')).length,1);
const snapshot=async()=>{stdout='';stderr='';await run("<?php if(!function_exists('owned_installed_snapshot'))dl('observer.so'); gc_collect_cycles(); echo json_encode(owned_installed_snapshot());");
  const value=JSON.parse(stdout);assert.equal(value.runtimeState,2);assert.equal(value.runtimeInitRuns,1);assert.equal(value.componentInitRuns,2);assert.equal(value.liveIdentities,0);return value;};
const cleaned=await snapshot();
await php.refresh();stdout='';stderr='';await run('<?php '+autoload);await preparePeer();await run('<?php '+calls);assert.equal(stdout,'ok');assert.equal(libraries.length,3);
const refreshed=await snapshot();
console.log(JSON.stringify({arrangement,ownedMode,peerMode,order,libraries,initial,coldCallbackRejections,callbackAcrossPackages:true,requestRecovery:true,cleaned,refreshed}));
`;

/**
 * Exercise both load orders, both autoload arrangements and every mode pairing.
 *
 * @param deployment - Original archives installed offline, with author tree removed.
 * @param diagnostic - Progress reporter.
 */
export const checkOwnedPhpWasmCoexistence = async (deployment, diagnostic) => {
	await saveLakeFile(deployment, "coexist.mjs", runnerSource);
	const executions = [];
	for(const arrangement of ["embedded", "composer"])
	for(const ownedMode of ["startup", "lazy"])
	for(const peerMode of ["startup", "lazy"])
	for(const order of ["owned-first", "peer-first"])
	{
		diagnostic(`coexistence: ${arrangement}/${ownedMode}/${peerMode}/${order}`);
		const result = await runCopied(process.execPath, ["coexist.mjs", arrangement, ownedMode, peerMode, order], deployment, copiedCleanEnvironment);
		assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
		assert.equal(observed.callbackAcrossPackages, true);
		assert.equal(observed.coldCallbackRejections, peerMode === "lazy" ? 2 : 0);
		assert.equal(observed.requestRecovery, true); executions.push(observed);
	}
	return { executions, sourceSha256: sha256(runnerSource) };
};
