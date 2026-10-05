/**
 * Reuse the independent member assertions through an installed gem's public API.
 *
 * @file
 */
import { readFile } from "node:fs/promises";

/** Exercise members before the unchanged installed owner and callback checks. */
export const ownedRubyInstalledReceiverProbe = async () => {
	const prior = await readFile("tests/fixtures/structured-types/owned-installed-ruby-borrows.rb", "utf8");
	const receivers = await readFile("tests/fixtures/structured-types/owned-ruby-receivers.rb", "utf8");
	const marker = "  root = ticket\n";
	if(prior.split(marker).length !== 2) throw new Error("Expected one installed Ruby owner probe");
	return prior.replace(marker, receivers + marker);
};
