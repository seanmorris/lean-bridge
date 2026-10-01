/**
 * Independent original-owner assertions for receiver calls across WIT.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { ownedWitBorrowProbe } from "./wit-owned-borrow-probe.mjs";

/**
 * Exercise every member, including a remaining parameter as the result anchor.
 *
 * @param generated - Generated public names, never private ownership state.
 * @param installed - Run without allocator or dispatch instrumentation.
 */
export const ownedWitReceiverProbe = async (generated, installed = false) => {
	const base = await ownedWitBorrowProbe(generated, installed);
	const extra = (await readFile("tests/fixtures/structured-types/owned-receiver-parameter.c", "utf8"))
		.replaceAll("owned_aggregates", generated.values.prefix)
		.replaceAll("OWNED_AGGREGATES", generated.values.prefix.toUpperCase());
	const entry = installed ? "int main(void) {" : "static int consumer_main(void) {";
	return base.replace(entry, extra + "\n" + entry)
		.replace("wit_borrowed_moves();", "wit_borrowed_moves(); receiver_parameter_anchor();")
		.replaceAll("owned-borrows-installed", "owned-receivers-installed");
};
