/**
 * Independently observe the exact native host/toolchain identity.
 *
 * @file
 */
import { execFileSync } from "node:child_process";

const firstLine = (command, args) => execFileSync(command, args, {
	encoding: "utf8", env: {}
}).split("\n")[0];

/** Return the identity recorded before, during and after native acceptance. */
export const observeCheckedRecordValueIndexNativeRuntime = () => ({
	platform: process.platform, arch: process.arch
	, glibc: firstLine("/usr/bin/getconf", ["GNU_LIBC_VERSION"])
		.replace(/^glibc /u, "")
	, cc: firstLine("/usr/bin/cc", ["--version"])
	, cpp: firstLine("/usr/bin/c++", ["--version"])
});
