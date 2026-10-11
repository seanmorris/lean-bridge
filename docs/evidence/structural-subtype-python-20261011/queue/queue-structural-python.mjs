import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(revision,'f68b3200138e475bc605bd692e6ad06be57390a6');
const base='build/vo1444-structural-python-remaining-r1';
await writeFile(base+'.start.json',JSON.stringify({revision,started:new Date().toISOString(),selections:[['3.11','reviewed'],['3.12','ordinary'],['3.12','reviewed']]},null,2)+'\n',{flag:'wx'});
for(const [minor,route] of [['3.11','reviewed'],['3.12','ordinary'],['3.12','reviewed']]){
 console.log(JSON.stringify({starting:{minor,route},time:new Date().toISOString()}));
 const child=spawn(process.execPath,['build/run-structural-subtype-python.mjs',minor,route,'r1'],{stdio:'inherit'});
 const result=await new Promise(resolve=>{child.on('error',error=>resolve({error:String(error)}));child.on('close',(code,signal)=>resolve({code,signal}));});
 console.log(JSON.stringify({finished:{minor,route},...result,time:new Date().toISOString()}));
 assert.equal(result.code,0);assert.equal(result.signal,null);
 const report=JSON.parse(await readFile(`build/vo1444-structural-python-${minor.replace('.','')}-${route}-r1-${revision.slice(0,7)}-records/${route}/report.json`));
 assert.equal(report.minor,minor);assert.equal(report.route,route);assert.equal(report.producerCommit,revision);
}
await writeFile(base+'.end.json',JSON.stringify({revision,finished:new Date().toISOString(),code:0},null,2)+'\n',{flag:'wx'});
