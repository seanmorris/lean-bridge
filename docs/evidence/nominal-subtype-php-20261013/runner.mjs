import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {open,readFile,writeFile,access} from "node:fs/promises";
import {resolve} from "node:path";
import {canonicalJson,sha256} from "../src/capsule/node.mjs";
import {waitNominalSubtypeDotnetResources} from "../tests/helpers/nominal-subtype-dotnet-resources.mjs";

const [route,mode,attempt,producerCommit]=process.argv.slice(2);
assert.ok(["ordinary","reviewed"].includes(route));
assert.ok(["full","result-only"].includes(mode));
assert.match(attempt,/^r[1-9][0-9]*$/);assert.match(producerCommit,/^[a-f0-9]{40}$/);
const git=args=>execFileSync("git",args,{encoding:"utf8",maxBuffer:16*1024**2});
assert.equal(git(["rev-parse","HEAD"]).trim(),producerCommit);
execFileSync("git",["diff","--quiet","HEAD","--","src","scripts","tests"]);
const list=()=>[...new Set(git(["ls-files","-z","--cached","--others","--exclude-standard","--","src","scripts","tests"]).split("\0").filter(Boolean))].sort();
const paths=list(),sources={};
for(const path of paths)sources[path]=sha256(await readFile(path));
const prefix=`build/vo1466-nominal-php-installed-${route}-${mode}-${attempt}`;
const output=resolve(prefix+"-output");
await assert.rejects(access(output),{code:"ENOENT"});
const environment={LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_TEST:"1"
 ,LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_ROUTES:route,LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_MODES:mode
 ,LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_OUTPUT:output
 ,LEAN_BRIDGE_PHP:"/usr/bin/php",LEAN_BRIDGE_COMPOSER:"/usr/bin/composer"
 ,LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION:"8.2.33"
 ,LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION:"2.5.5"
 ,LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR:"2.36"
 ,LEAN_NUM_THREADS:"1",OMP_NUM_THREADS:"1",MAKEFLAGS:"-j1",NO_COLOR:"1"};
const args=["--test","--test-concurrency=1","--test-reporter=tap","tests/helpers/nominal-subtype-php-installed-tests.mjs"];
const env={...process.env,...environment};delete env.FORCE_COLOR;delete env.NODE_OPTIONS;
const resources=await waitNominalSubtypeDotnetResources("build",{notify:console.log});
assert.deepEqual(list(),paths);
for(const path of paths)assert.equal(sha256(await readFile(path)),sources[path],path);
const start={schemaVersion:1,route,mode,producerCommit,command:process.execPath,args,cwd:process.cwd(),environment,sources,resources,started:new Date().toISOString(),runnerSha256:sha256(await readFile(new URL(import.meta.url)))};
await writeFile(prefix+"-start.json",canonicalJson(start),{flag:"wx"});
const fd=await open(prefix+".tap","wx");console.log(JSON.stringify({started:start.started,route,mode,producerCommit,output,log:prefix+".tap"}));
let result;
try{
 result=await new Promise((done,fail)=>{const child=spawn(start.command,args,{env,stdio:["ignore",fd.fd,fd.fd]});child.once("error",fail);child.once("close",(code,signal)=>done({code,signal}));});
}finally{await fd.close();}
const tap=await readFile(prefix+".tap");
const changes=[];
for(const path of paths)if(sha256(await readFile(path))!==sources[path])changes.push(path);
const finalPaths=list();
const end={schemaVersion:1,route,mode,producerCommit,...result,started:start.started,finished:new Date().toISOString(),tapSha256:sha256(tap),tapBytes:tap.length,sourcesChecked:paths.length,changed:changes,added:finalPaths.filter(path=>!paths.includes(path)),removed:paths.filter(path=>!finalPaths.includes(path)),head:git(["rev-parse","HEAD"]).trim()};
await writeFile(prefix+"-end.json",canonicalJson(end),{flag:"wx"});console.log(JSON.stringify(end));
assert.deepEqual(changes,[]);assert.deepEqual(end.added,[]);assert.deepEqual(end.removed,[]);assert.equal(end.head,producerCommit);
if(result.code!==0||result.signal){console.log(tap.toString().slice(-12000));process.exitCode=1;}
else{
 for(const line of ["# tests 1","# pass 1","# fail 0","# skipped 0","# cancelled 0"])
  assert.ok(tap.toString().split("\n").includes(line),line);
 console.log("Original installed selection passed with no skips; retained its report and complete package handoff.");
}
