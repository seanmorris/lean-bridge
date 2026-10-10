/**
 * Original audit failure and corrected declaration-located refusals, with tamper controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertFinNominalRefusalArchive } from "./fin-nominal-refusal-archive.mjs";

const archives = [
	{ revision: "1840da12d270045b1340b16e98a2a8085f002337", outcome: "failed"
		, digest: "09e944dac340d1508fc2c48b9a3a7ccf9397ad3c92ab68e347d8e0f1ee14c7b4" }
	, { revision: "4d65922df96dd297c36f9c369651d5a2ec05e330", outcome: "passed"
		, digest: "092c365b9ac3a660fb29f5edec736a361e049094d14c4416eac1dd31008165fd" }
];

test("nominal refusal archives retain the failed diagnostic and the clean-commit repair", async () => {
	for(const archive of archives) await assertFinNominalRefusalArchive(archive);
});

test("nominal refusal archives reject altered indexes, sources, diagnostics and execution records", async () => {
	for(const archive of archives)
	{
		const index = await assertFinNominalRefusalArchive(archive);
		for(const path of ["index.json", ...index.files.map(file => file.path)])
			await assert.rejects(() => assertFinNominalRefusalArchive(archive, async filename => {
				const bytes = await readFile(filename);
				return filename.endsWith(`/${path}`) ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
			}));
		await assert.rejects(() => assertFinNominalRefusalArchive({ ...archive, outcome: archive.outcome === "passed" ? "failed" : "passed" }));
	}
});
