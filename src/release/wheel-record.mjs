/**
 * Close a wheel with standard installation hashes one file at a time.
 *
 * @file
 */
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const field = path => /[",\r\n]/u.test(path) ? `"${path.replaceAll('"', '""')}"` : path;

/**
 * Record each staged regular file; the RECORD row itself has no hash or size.
 *
 * @param wheelRoot - Private wheel staging directory.
 * @param distInfo - Metadata directory relative to the root.
 */
export const writeWheelRecord = async (wheelRoot, distInfo) => {
	const lines = [];
	const visit = async (directory, prefix) => {
		const entries = await readdir(directory, { withFileTypes: true });
		for(const entry of entries.sort((a, b) => a.name.localeCompare(b.name)))
		{
			const path = prefix + entry.name, file = join(directory, entry.name);
			if(entry.isDirectory()) await visit(file, path + "/");
			else if(entry.isFile())
			{
				const bytes = await readFile(file);
				const digest = createHash("sha256").update(bytes).digest("base64url");
				lines.push(`${field(path)},sha256=${digest},${bytes.length}`);
			}
			else throw new TypeError(`Non-regular wheel input: ${path}`);
		}
	};
	await visit(wheelRoot, "");
	lines.push(`${field(distInfo + "/RECORD")},,`);
	await writeFile(join(wheelRoot, distInfo, "RECORD"), `${lines.join("\n")}\n`, { flag: "wx" });
};
