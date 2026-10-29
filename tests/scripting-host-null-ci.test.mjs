/**
 * Hosted scripting HostNull producer contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hosted scripting HostNull runs once on the pinned Perl lane and preserves verified evidence", async () => {
	const workflow = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	const runner = await readFile("scripts/run-host-null-scripting-ci.sh", "utf8");
	const checker = await readFile("scripts/check-host-null-scripting-ci.mjs", "utf8");
	assert.match(workflow, /name: Install Python for scripting HostNull acceptance[\s\S]*if: matrix\.configuration == '5\.38\.2-threaded'[\s\S]*python-version: '3\.11\.16'/u);
	assert.match(workflow, /name: Install Ruby for scripting HostNull acceptance[\s\S]*if: matrix\.configuration == '5\.38\.2-threaded'[\s\S]*ruby-version: '3\.3\.12'/u);
	assert.match(workflow, /name: Qualify HostNull in prepared scripting packages[\s\S]*id: host_null_scripting[\s\S]*bash scripts\/run-host-null-scripting-ci\.sh/u);
	assert.match(workflow, /name: Preserve HostNull scripting acceptance[\s\S]*host-null-scripting-\$\{\{ github\.sha \}\}[\s\S]*build\/host-null-scripting-ci\/[\s\S]*if-no-files-found: error/u);
	assert.match(workflow, /name: Enforce scripting HostNull support[\s\S]*steps\.host_null_scripting\.outcome != 'success'[\s\S]*run: exit 1/u);
	assert.match(runner, /LEAN_BRIDGE_HOST_NULL_SCRIPTING_ROUTES=ordinary,reviewed/u);
	assert.match(runner, /--test-name-pattern='\^installed scripting HostNull preserves all five positions on both author routes\$'/u);
	assert.match(runner, /node scripts\/check-host-null-scripting-ci\.mjs/u);
	assert.match(checker, /verifyPackageSetReceipt/u);
	assert.match(checker, /sourceRemovedBeforeInstallation/u);
	assert.match(checker, /installationHandoffRemovedBeforeRelocatedExecution/u);
	assert.match(checker, /installedBytesUnchanged/u);
	assert.match(checker, /sourceUnchangedAfterReplay/u);
	assert.match(checker, /checks: summary\.routes\.length \* hostNullScriptingProfiles\.length\s*\* hostNullScriptingChecks \* 2/u);
});
