/**
 * Independent array and record contracts shared by installed consumer profiles.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { arraySignatures } from "./array-fixture.mjs";
import { recordSignatures } from "./record-fixture.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const renamed = (signatures, prefix) => signatures.map(signature => ({ ...signature
	, name: `Collections.${prefix}${signature.name.split(".").at(-1).replace(/^./, c => c.toUpperCase())}` }));
let deep = "uint32";
for(let i = 0; i < 24; i++) deep = { array: deep };
export const collectionSignatures = [
	...renamed(arraySignatures, "array")
	, ...renamed(recordSignatures, "record")
	, { name: "Collections.deep", parameters: [deep], result: deep }
	, { name: "Collections.generate", parameters: ["nat"], result: { array: "unit" } }];

/** The reviewed input never derives from compiler metadata or generated bindings. */
export const collectionReviewedIr = () => corpusReviewedIr({ id: "collections" }, collectionSignatures);

/**
 * Compose the existing independent Lean fixtures without changing their sources.
 *
 * @param root - Task-owned author directory.
 */
export const writeCollectionProject = async root => {
	for(const [file, source] of [["Arrays.lean", "onboarding/npm-arrays/Arrays.lean"]
		, ["Records.lean", "onboarding/npm-records/Records.lean"]
		, ["Collections.lean", "collection-consumers/Collections.lean"]
		, ["lean-toolchain", "onboarding/npm-arrays/lean-toolchain"]
		, ["LICENSE", "onboarding/npm-arrays/LICENSE"]])
		await saveLakeFile(root, file, await readFile(`tests/fixtures/${source}`));
	await saveLakeFile(root, "lakefile.toml", 'name = "collections"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Arrays"\n[[lean_lib]]\nname = "Records"\n[[lean_lib]]\nname = "Collections"\n');
	await saveLakeFile(root, "package.json", JSON.stringify({ name: "collections", version: "1.0.0", license: "MIT", description: "Copied array and record acceptance fixture." }));
};
