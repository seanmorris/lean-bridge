/** @file Build the single shared CLR reference domain for a verified Lean runtime. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";

/**
 * One SONAME per runtime, one symbol namespace per native and managed ABI.
 * A mismatched provider cannot create a second, silently divergent registry.
 *
 * @param options - Isolated publisher staging, verified runtime and compiler.
 */
export const compileDotnetHostDomain = async options => {
	const { app, runtimeRoot, leanPrefix, runtimeIdentity, cc, run } = options;
	if(!/^[a-f0-9]{64}$/u.test(runtimeIdentity)) throw new TypeError("Invalid CLR domain runtime identity");
	const parts = {};
	for(const name of ["host-domain.c", "host-domain.h", "host-frame.h", "host-frame.c", "host-frame.cs", "host-refs.cs"])
	{
		const bytes = await readFile(new URL("../backends/dotnet/" + name, import.meta.url));
		await writeFile(join(app, name), bytes, { flag: "wx" }); parts[name] = sha256(bytes);
	}
	const id = sha256(canonicalJson({ runtimeIdentity, parts }));
	const name = "liblb_dotnet_host_" + runtimeIdentity + ".so", flag = "-DLB_DN_DOMAIN_PREFIX=lb_dnd_" + id + "_";
	const includes = ["-I" + join(leanPrefix, "include")];
	await run(cc, ["-std=gnu11", "-O1", "-g0", "-DNDEBUG"
		, "-shared", "-fPIC", "-fvisibility=hidden"
		, flag, ...includes, "host-domain.c", "-L" + join(runtimeRoot, "lib")
		, "-lleanshared", "-Wl,-z,defs,-z,nodelete", "-Wl,--build-id=none"
		, "-Wl,-soname," + name, "-Wl,-rpath,$ORIGIN", "-o", name], app);
	return { id, name, flag, includes };
};
