import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson, sha256 } from '../src/capsule/node.mjs';
import { assertFinLateReport } from '../tests/helpers/fin-container-late-report.mjs';
const [path, python] = process.argv.slice(2);
const report = JSON.parse(await readFile(path));
const records = new Map(await Promise.all(Object.keys(report.recordFiles).map(async name=>[name,await readFile(join(path+'.records',name))])));
const options={glibc:'2.36',...(python?{python}:{}),read:async name=>records.get(name)};
await assertFinLateReport(report,report.profiles,options);
let rejected=0;
for(let i=0;i<report.reports.length;i++) {
 for(const field of ['checks','consumerSha256','modelSha256','receiptSha256','bindingIrSha256','sourceTreeSha256','fixtureSha256','installedFilesSha256','installedReceiptSha256','offlineInstall','compilerFreePath','sourceRemovedBeforeInstallation','relocatedInstallation','repeatExecution','installedFilesUnchanged']) {
  const changed=structuredClone(report);delete changed.reports[i][field];
  await assert.rejects(assertFinLateReport(changed,report.profiles,options));rejected++;
 }
 for(const mutate of [x=>{x.lateInputs.rejections--;},x=>{x.lateInputs.recoveries--;},x=>{x.lateInputs.inputTreesCompared.pop();},x=>{x.lateInputs.snapshotMutationControls=0;},x=>{x.lateInputs.additionalChecks--;},x=>{x.dispatch.observed=true;},x=>{x.refinements['FinContainers.label'].parameters[1].arguments[0].bound='5';},x=>{x.packages[0].artifacts[0].sha256='0'.repeat(64);}]) {
  const changed=structuredClone(report);mutate(changed.reports[i]);
  await assert.rejects(assertFinLateReport(changed,report.profiles,options));rejected++;
 }
}
for(const name of records.keys()) {
 for(const action of ['missing','corrupt']) {
  const read=async n=>{if(n===name){if(action==='missing')throw Object.assign(new Error('missing original'),{code:'ENOENT'});return Buffer.from('corrupt');}return records.get(n);};
  await assert.rejects(assertFinLateReport(report,report.profiles,{...options,read}));rejected++;
 }
}
for(const name of ['author-1/FinContainers.lean','author-1/lean-bridge.exports.json',...report.profiles.flatMap(p=>[p+'.source',p+'.before.stdout',p+'.relocated.stdout'])]) {
 const changed=structuredClone(report), bytes=Buffer.concat([records.get(name),Buffer.from('unknown')]);
 changed.recordFiles[name]={bytes:bytes.length,sha256:sha256(bytes)};
 await assert.rejects(assertFinLateReport(changed,report.profiles,{...options,read:async n=>n===name?bytes:records.get(n)}));rejected++;
}
const result={reportSha256:sha256(await readFile(path)),profiles:report.profiles,records:records.size,rejectedControls:rejected};
await writeFile(path+'.mutations.json',canonicalJson(result),{flag:'wx'});
process.stdout.write(canonicalJson(result));
