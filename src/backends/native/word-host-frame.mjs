/** @file Specialize the synchronous frame without changing an existing owner's source identity. */
import { readFile } from "node:fs/promises";

/**
 * CLR registry fingerprints include these exact bytes; PHP has its own diagnostic labels.
 *
 * @param target - Native owner profile.
 */
export const wordHostFrame = async target => {
	const label = target === "dotnet" ? "CLR" : target === "php" ? "PHP" : null;
	if(!label) throw new TypeError("Unknown native host frame");
	const source = await readFile(new URL("./word-host-frame.c.in", import.meta.url), "utf8");
	return Buffer.from(source.replaceAll("@LB_HOST@", label));
};
