/**
 * Record the sources checked by build.sh before compiling the certificate.
 *
 * @file
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const sourceFiles = {};
let combined = "";
for(const name of ["TutteCore.lean", "Tutte.lean"])
{
	const bytes = await readFile(new URL(name, import.meta.url));
	sourceFiles[name] = { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
	combined += bytes.toString("utf8");
}
const theorems = [...combined.matchAll(/\btheorem\s+([A-Za-z][A-Za-z0-9_]*)/gu)].map(match => match[1]);
if(/\b(?:sorry|admit|axiom|unsafe)\b/u.test(combined)) throw new Error("Unchecked declaration in proof sources");
const version = (await readFile(new URL("../../lean-toolchain", import.meta.url), "utf8")).trim().replace("leanprover/lean4:", "");
await writeFile(new URL("runtime/proof-audit.json", import.meta.url), `${JSON.stringify({ schemaVersion: 1
	, checker: `Lean ${version}`
	, assurance: "Exact integer-coordinate tiling, electrical equations, simplicity and vertex connectivity"
	, sourceFiles, theorems }, null, 2)}\n`);
