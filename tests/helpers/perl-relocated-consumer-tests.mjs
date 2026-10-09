/**
 * Stand-in controls for the moved-tree CPAN rerun: a relocatable tree passes, while a tree that depends on its
 * install-time path, a consumer that recreates the old tree, a different result and an occupied target fail.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { saveLakeFile } from "./lake-workspace.mjs";
import { relocatePerlConsumer } from "./perl-relocated-consumer.mjs";

const perl = process.env.LEAN_BRIDGE_CORPUS_PERL ?? "/usr/bin/perl";

/**
 * One installed stand-in tree: a module under installed/lib/perl5 and a consumer printing its checks.
 *
 * @param root - Installed consumer root to create.
 * @param module - Module body after its package line.
 * @param consumer - Optional extra consumer statements before the success line.
 */
const standIn = async (root, module, consumer = "") => {
	await saveLakeFile(join(root, "installed/lib/perl5/StandIn"), "Moved.pm", `package StandIn::Moved;\nuse strict;\nuse warnings;\n${module}\n1;\n`);
	await saveLakeFile(root, "consumer.pl", `use strict;\nuse warnings;\nuse StandIn::Moved;\n${consumer}print "standin-ok:" . StandIn::Moved::checks() . "\\n";\n`);
	return root;
};

test("a moved CPAN consumer tree reruns unchanged and refuses install-path dependence, old-tree use, other output and occupied targets", { skip: existsSync(perl) ? false : `no Perl at ${perl}` }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-relocated-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const relocatable = await standIn(join(directory, "relocatable/perl"), "sub checks { return 3 }");
	const moved = await relocatePerlConsumer({ root: relocatable, command: perl, success: "standin-ok", checks: 3 });
	assert.deepEqual([moved.installed, moved.library, moved.relocatedInstallation, moved.repeatExecution]
		, [`${relocatable}-relocated`, join(`${relocatable}-relocated`, "installed/lib/perl5"), true, true]);
	assert.deepEqual(await readdir(join(directory, "relocatable")), ["perl-relocated"]);
	// A module that reads a sibling through its install-time absolute path fails once that path is gone.
	const pinned = join(directory, "pinned/perl");
	await saveLakeFile(join(pinned, "installed/lib/perl5/StandIn"), "checks.txt", "3\n");
	await standIn(pinned, `sub checks { open my $in, "<", ${JSON.stringify(join(pinned, "installed/lib/perl5/StandIn/checks.txt"))} or die "missing install-time data\\n"; my $n = <$in>; chomp $n; return $n }`);
	await assert.rejects(() => relocatePerlConsumer({ root: pinned, command: perl, success: "standin-ok", checks: 3 }), /missing install-time data/u);
	// A consumer that recreates the old tree is refused even when its output is right.
	const recreating = join(directory, "recreating/perl");
	await standIn(recreating, "sub checks { return 3 }", `mkdir ${JSON.stringify(recreating)} or die "mkdir: $!\\n";\n`);
	await assert.rejects(() => relocatePerlConsumer({ root: recreating, command: perl, success: "standin-ok", checks: 3 }), /neither recreated nor needed its old tree/u);
	// Output that differs from the first run is refused.
	const other = await standIn(join(directory, "other/perl"), "sub checks { return 3 }");
	await assert.rejects(() => relocatePerlConsumer({ root: other, command: perl, success: "standin-ok", checks: 4 }), /repeats the first run's output/u);
	// An occupied target is refused before anything moves.
	const occupied = await standIn(join(directory, "occupied/perl"), "sub checks { return 3 }");
	await saveLakeFile(`${occupied}-relocated`, ".keep", "");
	await assert.rejects(() => relocatePerlConsumer({ root: occupied, command: perl, success: "standin-ok", checks: 3 }), /the relocation target is fresh/u);
	assert.ok(existsSync(join(occupied, "consumer.pl")), "the refused tree stays in place");
});
