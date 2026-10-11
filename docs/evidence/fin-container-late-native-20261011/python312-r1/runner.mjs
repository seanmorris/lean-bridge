import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { open, readFile, statfs, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const [revision, selection, label, python] = process.argv.slice(2);
assert.match(revision ?? '', /^[a-f0-9]{40}$/);
assert.match(label ?? '', /^[a-z0-9-]+$/);
const profiles = selection.split(',').sort();
assert.equal(new Set(profiles).size, profiles.length);
assert.ok(profiles.length && profiles.every(p => ['c','cpp','python','rust','ruby','java','kotlin','dotnet','php-native'].includes(p)));
if(profiles.includes('python')) assert.ok(['3.11','3.12'].includes(python));
else assert.equal(python, undefined);
const git = args => execFileSync('git', args, {cwd:'/app',encoding:'utf8'}).trim();
const free = async () => {const s=await statfs('/app');return Math.floor(s.bavail*s.bsize/1048576);};
const hash = b => createHash('sha256').update(b).digest('hex');
assert.equal(git(['rev-parse','HEAD']),revision);
assert.equal(git(['diff','HEAD','--name-only']),'');
let minimumMiB = await free(); assert.ok(minimumMiB >= 2048, `Only ${minimumMiB} MiB free`);
const prefix = `/app/build/vo1454-late-native-${label}-${revision.slice(0,7)}`;
const output = prefix + '/edges-' + profiles.join('-') + '.json';
const selectedEnv = {
 LEAN_BRIDGE_FIN_LATE_PROFILES: profiles.join(','), LEAN_BRIDGE_FIN_LATE_REPORT:output,
 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR:'2.36',
 LEAN_BRIDGE_LEAN_PREFIX:'/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2',
 LEAN_BRIDGE_PYTHON:`/app/.toolchains/python${(python ?? '3.11').replace('.','')}/bin/python3`,
 LEAN_BRIDGE_RUBY:'/app/.toolchains/ruby33/bin/ruby',
 LEAN_BRIDGE_PHP:'/app/.toolchains/php-8.5.10-ffi/bin/php',
 LEAN_BRIDGE_COMPOSER:'/usr/bin/composer',
 LEAN_NUM_THREADS:'1', OMP_NUM_THREADS:'1', MAKEFLAGS:'-j1'
};
const environment={...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('LEAN_BRIDGE_'))),...selectedEnv};
const args=['-c','3',process.execPath,'--test','--test-concurrency=1','tests/helpers/fin-container-late-installed-tests.mjs'];
await writeFile(prefix+'.start.json',JSON.stringify({revision,started:new Date().toISOString(),runnerSha256:hash(await readFile(import.meta.filename)),command:'/usr/bin/taskset',args,environment:selectedEnv,minimumMiB},null,2)+'\n',{flag:'wx'});
const log=await open(prefix+'.tap','wx');
const child=spawn('/usr/bin/taskset',args,{cwd:'/app',env:environment,stdio:['ignore',log.fd,log.fd],detached:true});
process.stdout.write(`Started ${child.pid}: ${selection}; ${minimumMiB} MiB free\n`);
let diskStop=false;
const timer=setInterval(async()=>{try{const mib=await free();minimumMiB=Math.min(minimumMiB,mib);if(mib<768&&!diskStop){diskStop=true;process.kill(-child.pid,'SIGTERM');}process.stdout.write(JSON.stringify({time:new Date().toISOString(),pid:child.pid,freeMiB:mib,diskStop})+'\n');}catch(error){process.stderr.write(String(error)+'\n');}},1000);
const end=await new Promise(resolve=>{child.once('error',error=>resolve({code:null,signal:null,error:String(error)}));child.once('close',(code,signal)=>resolve({code,signal}));});
clearInterval(timer);await log.close();minimumMiB=Math.min(minimumMiB,await free());
const result={...end,finished:new Date().toISOString(),minimumMiB,diskStop,tapSha256:hash(await readFile(prefix+'.tap'))};
await writeFile(prefix+'.end.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify(result)+'\n');
assert.deepEqual([end.code,end.signal,diskStop],[0,null,false]);
assert.equal(git(['rev-parse','HEAD']),revision);assert.equal(git(['diff','HEAD','--name-only']),'');
const checkArgs=['scripts/check-fin-late-native-report.mjs','--report',output,'--tap',prefix+'.tap','--profiles',selection,'--glibc','2.36',...(python?['--python',python]:[])];
const checked=execFileSync(process.execPath,checkArgs,{cwd:'/app',encoding:'utf8'});
await writeFile(prefix+'.checked.json',checked,{flag:'wx'});
process.stdout.write(checked);
