import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { installCheckedRecordPerl, checkedRecordPerlExecutables } from '../tests/helpers/checked-record-perl-install.mjs';
const root = await mkdtemp('/tmp/lean-bridge-checked-record-perl-identity-probe-');
const handoff = '/tmp/lean-bridge-checked-record-perl-rgRTAb/consumer/handoff';
const receipt = JSON.parse(await readFile(join(handoff, 'package-set-receipt.json')));
console.log(JSON.stringify({ root, handoff, scope: 'Diagnostic only. Original frozen producer failed before installation; current helper is a worktree draft.' }));
for(const mode of ['prebuilt-only', 'build-xs']) {
  const report = await installCheckedRecordPerl({
    configuration: '5.36.3-threaded', command: checkedRecordPerlExecutables()['5.36.3-threaded']
    , mode, route: 'ordinary-source', consumer: root, handoff, packages: receipt.packages
    , output: join(root, 'records', mode)
  });
  await writeFile(join(root, 'records', mode, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ mode, checks: report.checks }));
}
