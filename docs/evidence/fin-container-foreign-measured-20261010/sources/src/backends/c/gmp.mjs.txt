/**
 * Authenticated GMP source supplied to C producers and prepared consumers.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { sha256 } from "../../capsule/node.mjs";

export const gmpIdentity = Object.freeze({ version: "6.3.0"
	, sha256: "a3c2b80201b89e68616f4ad30bc66aee4927c3ce50e33929ca819d5c43538898"
	, source: "https://ftp.gnu.org/gnu/gmp/gmp-6.3.0.tar.xz"
	, signingKey: "343C2FF0FBEE5EC2EDBEF399F3599FF828C67298"
	, license: "LGPL-3.0-or-later OR GPL-2.0-or-later" });

/** Return the exact upstream archive, without network or system GMP access. */
export const gmpSource = async () => {
	const bytes = await readFile(new URL("./gmp.source.tar.xz", import.meta.url));
	if(bytes.length !== 2094196 || sha256(bytes) !== gmpIdentity.sha256) throw new Error("Pinned GMP source identity differs");
	return bytes;
};
