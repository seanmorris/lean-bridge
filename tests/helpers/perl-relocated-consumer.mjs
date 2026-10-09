/**
 * Move one installed CPAN consumer tree after its first full run and rerun the unchanged full consumer in
 * the moved tree, so repeat execution and installed-tree relocation are both observed rather than inferred
 * from a relocated handoff.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";

/**
 * Rename root to a fresh sibling, require the old tree to be gone, and rerun consumer.pl with PERL5LIB at the
 * moved prefix only. The rerun must print exactly the first run's success line, and must not recreate or
 * reach the old tree.
 *
 * @param root0 - The first run's installed tree and its accepted result.
 * @param root0.root - Installed consumer root holding consumer.pl and installed/lib/perl5.
 * @param root0.command - Selected Perl interpreter.
 * @param root0.success - The consumer's success label.
 * @param root0.checks - Checks the first run reported.
 */
export const relocatePerlConsumer = async ({ root, command, success, checks }) => {
	assert.ok(Number.isSafeInteger(checks) && checks > 0, "the first run reported its checks");
	const relocated = `${root}-relocated`, consumer = join(root, "consumer.pl");
	assert.equal(existsSync(relocated), false, "the relocation target is fresh");
	const consumerSha256 = sha256(await readFile(consumer));
	await rename(root, relocated);
	assert.equal(existsSync(root), false, "the old installed tree is gone");
	assert.equal(sha256(await readFile(join(relocated, "consumer.pl"))), consumerSha256, "the consumer is unchanged");
	const library = join(relocated, "installed/lib/perl5");
	const repeated = await runCopied(command, ["consumer.pl"], relocated, { ...copiedCleanEnvironment, PERL5LIB: library });
	assert.equal(repeated.stderr, "");
	assert.equal(repeated.stdout, `${success}:${checks}\n`, "the moved consumer repeats the first run's output");
	assert.equal(existsSync(root), false, "the moved consumer neither recreated nor needed its old tree");
	return { installed: relocated, library, consumerSha256, relocatedInstallation: true, repeatExecution: true };
};
