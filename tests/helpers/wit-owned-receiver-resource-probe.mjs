/**
 * Use the same independently authored resource caller before and after install.
 *
 * @file
 */
import { readFile } from "node:fs/promises";

/**
 * Select optional public API assertions, without reading generated function bodies.
 *
 * @param generated - Generated public package names.
 * @param kind - Plain, consuming or unanchored callback configuration.
 * @param installed - Omit private allocation and dispatch counters.
 */
export const ownedWitReceiverResourceProbe = async (generated, kind, installed = false) => {
	const source = await readFile("tests/fixtures/structured-types/owned-wit-resource-receivers.c", "utf8");
	return `${installed ? "#define RECEIVER_INSTALLED 1\n" : ""}#define RECEIVER_CALLBACKS ${Number(kind === "unanchored")}\n#define RECEIVER_CONSUMING ${Number(kind !== "plain")}\n`
		+ source.replaceAll("owned_aggregates", generated.values.prefix)
			.replaceAll("OWNED_AGGREGATES", generated.values.prefix.toUpperCase());
};
