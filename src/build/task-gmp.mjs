/**
 * Stage a source-built or explicitly digest-pinned public GMP kit for task packages.
 *
 * @file
 */
import { constants } from "node:fs";
import { mkdir, open, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { gmpIdentity, gmpSource } from "../backends/c/gmp.mjs";
import { sha256 } from "../capsule/node.mjs";
import { buildNativeGmp } from "./native-gmp.mjs";
import { validateNativeElf } from "./native-artifacts.mjs";

const manifest = "share/lean-bridge/gmp.json", source = "share/lean-bridge/sources/gmp-6.3.0.tar.xz";
const payload = ["include/gmp.h", "lib/libgmp.so.10", ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"].map(n => "share/lean-bridge/licenses/GMP-" + n)];
const read = async (root, name, bound) => {
	const path = join(root, name);
	if(await realpath(path) !== path) throw new Error("Unexpected link in GMP kit: " + name);
	const fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try
	{
		const stat = await fd.stat();
		if(!stat.isFile() || stat.size < 1 || stat.size > bound) throw new Error("Invalid GMP kit file: " + name);
		const bytes = Buffer.alloc(stat.size);
		let size = 0;
		while(size < bytes.length)
		{
			const { bytesRead } = await fd.read(bytes, size, bytes.length - size, size);
			if(!bytesRead) throw new Error("Truncated GMP kit file: " + name);
			size += bytesRead;
		}
		if((await fd.stat()).size !== size) throw new Error("GMP kit changed while reading");
		return bytes;
	} finally
	{ await fd.close(); }
};

/**
 * No automatic discovery of host libraries or self-authenticating cache receipts.
 *
 * @param options - Private kit directory, producer environment and cancellation signal.
 * @param options.root - Empty private dependency staging directory.
 * @param options.environment - Producer environment and optional trusted kit pin.
 * @param options.signal - Optional producer cancellation signal.
 */
export const taskGmpKit = async ({ root, environment, signal }) => {
	const external = environment.LEAN_BRIDGE_TASK_GMP_ROOT, pin = environment.LEAN_BRIDGE_TASK_GMP_SHA256;
	if((external !== undefined || pin !== undefined) && (!external || !isAbsolute(external) || !/^[a-f0-9]{64}$/u.test(pin ?? ""))) throw new Error("A prepared task GMP kit requires an absolute root and independently pinned receipt SHA-256");
	if(!external) await buildNativeGmp({ root, environment, signal });
	const from = await realpath(external ?? root), bytes = await read(from, manifest, 65536), identity = sha256(bytes);
	if(external && identity !== pin) throw new Error("Task GMP kit receipt digest mismatch");
	const doc = JSON.parse(bytes);
	if(doc.checked !== true || doc.soname || doc.binding || !Array.isArray(doc.configure)
		|| !["ABI=64", "--enable-shared", "--host=x86_64-pc-linux-gnu"].every(v => doc.configure.includes(v))
		|| Object.entries(gmpIdentity).some(([key, value]) => doc[key] !== value)
		|| Object.keys(doc.files ?? {}).sort().join() !== [...payload].sort().join()) throw new Error("Unsupported public GMP kit identity or contents");
	const files = new Map([[manifest, bytes]]);
	for(const path of payload)
	{
		const file = await read(from, path, 16 * 1024 * 1024), record = doc.files[path];
		if(record?.bytes !== file.length || record.sha256 !== sha256(file)) throw new Error("Task GMP kit payload differs: " + path);
		if(path === "lib/libgmp.so.10") validateNativeElf(file);
		files.set(path, file);
	}
	const upstream = await gmpSource();
	if(!(await read(from, source, upstream.length)).equals(upstream)) throw new Error("Task GMP corresponding source differs");
	files.set(source, upstream);
	if(external) for(const [path, contents] of files)
	{
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), contents, { flag: "wx" });
	}
	return { root, files, identity };
};
