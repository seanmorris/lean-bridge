/**
 * Verify the private GMP dependency staged for generated owned Perl packages.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { gmpIdentity } from "../backends/c/gmp.mjs";
import { nativeArtifactPaths, validateNativeElf, verifyNativeFiles } from "./native-artifacts.mjs";

/**
 * Accept only the closed, source-bound, checked private GMP build.
 *
 * @param root - Completed private-GMP staging directory.
 */
export const readOwnedPerlGmp = async root => {
	const library = "libgmp-lean-bridge.so.10";
	const paths = ["include/gmp.h", `lib/${library}`, "share/lean-bridge/gmp.json"
		, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
		, ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"].map(name => `share/lean-bridge/licenses/GMP-${name}`)];
	const receipt = JSON.parse(await readFile(join(root, "share/lean-bridge/gmp.json"), "utf8"));
	await verifyNativeFiles(root, receipt.files);
	if(Object.entries(gmpIdentity).some(([key, value]) => receipt[key] !== value)
		|| receipt.soname !== library || receipt.binding !== "local-symbols" || receipt.checked !== true
		|| !receipt.configure?.includes("LIBGMP_LDFLAGS=-release lean-bridge -Wl,-Bsymbolic")
		|| !receipt.configure?.some(flag => flag.startsWith("CFLAGS=") && flag.split(" ").includes("-fPIC"))
		|| canonicalJson(Object.keys(receipt.files).sort()) !== canonicalJson(paths.filter(path =>
			!["share/lean-bridge/gmp.json", "share/lean-bridge/sources/gmp-6.3.0.tar.xz"].includes(path)).sort())
		|| canonicalJson(await nativeArtifactPaths(root)) !== canonicalJson([...paths].sort())
		|| sha256(await readFile(join(root, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"))) !== gmpIdentity.sha256)
		throw new Error("Owned Perl GMP differs from its isolated checked source build");
	validateNativeElf(await readFile(join(root, "lib", library)));
	return { library, receipt, paths, sha256: receipt.files[`lib/${library}`].sha256 };
};
