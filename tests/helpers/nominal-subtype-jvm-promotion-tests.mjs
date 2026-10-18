/**
 * Keep Java/Kotlin nominal claims tied to original installed package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { nominalSubtypeJvmArchive, nominalSubtypeJvmReferences, promoteNominalSubtypeJvm, nominalSubtypeJvmConversion, nominalSubtypeJvmLimit } from "./nominal-subtype-jvm-promotion.mjs";
import { nominalSubtypeJvmPromotionHistoryPath } from "./nominal-subtype-jvm-promotion-history.mjs";
import { beforeNominalSubtypePhpPromotionSource, nominalSubtypePhpPromotionHistoryPath } from "./nominal-subtype-php-promotion-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins,
	withHistorySourcePins
} from "./source-history-test-source.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", "58777508091f0e6b9b574cbfa2561c2c019b1570:docs/type-surface.v1.json"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("nominal JVM promotion authenticates all four selections and original Java/Kotlin execution records", async () => {
	const references = await nominalSubtypeJvmReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["java", "kotlin"]);
		assert.equal(reference.revision, "70285c8cfc5ae0251adec4ba55a70ea2386a9869");
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.executions, 6);
		assert.equal(reference.counts.checks, reference.mode === "full" ? 25338 : 12528);
		assert.equal(reference.counts.rejections, reference.mode === "full" ? 6192 : 0);
		assert.equal(reference.counts.hostRejections, reference.mode === "full" ? 33 : 6);
		assert.equal(reference.counts.snapshotControls, 48);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36");
		assert.match(reference.counts.javaVersion, /^openjdk 22\.0\.2 2024-07-16\n/u);
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.scope.includes(nominalSubtypeJvmLimit));
		assert.equal(reference.artifacts.length, 2);
		for(const suffix of [`/${reference.route}-${reference.mode}/run.tap`, "sources/src/analyze/NativeExports.lean", "checkers/package-records.mjs"])
			assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
	assert.equal(references.reduce((sum, item) => sum + item.counts.checks, 0), 75732);
});

test("nominal JVM promotion refuses missing originals, invented claims and mismatched shared observations", async () => {
	const original = predecessor(), references = await nominalSubtypeJvmReferences();
	const targets = ["index.json", "checkers/report.mjs"
		, "sources/src/analyze/NativeExports.lean"
		, ...references.flatMap(item => ["start.json", "end.json", "run.tap", "records/report.json", "records/installation.json"].map(path => `${item.route}-${item.mode}/${path}`))];
	for(const target of targets)
	{
		await assert.rejects(nominalSubtypeJvmReferences(path => {
			if(path === `${nominalSubtypeJvmArchive}/${target}`) throw new Error("Missing original");
			return readFile(path);
		}));
		await assert.rejects(nominalSubtypeJvmReferences(async path => path === `${nominalSubtypeJvmArchive}/${target}` ? Buffer.from("changed") : readFile(path)));
	}
	for(const altered of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalSubtypeJvm(original, altered));
	const changes = [item => { item.profiles.pop(); }
		, item => { item.profiles.push("php-native"); }
		, item => { item.route = "reviewed"; }
		, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }
		, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.counts.checks = 1; }
		, item => { item.counts.executions = 32; }
		, item => { item.counts.javaVersion = "java 17"; }
		, item => { item.counts.archiveSha256 = "0".repeat(64); }
	];
	for(const change of changes)
	{
		const changed = structuredClone(references); change(changed[0]);
		await assert.rejects(promoteNominalSubtypeJvm(original, changed));
	}
	const promoted = await promoteNominalSubtypeJvm(original, references);
	await assert.rejects(promoteNominalSubtypeJvm(promoted, references), /Already promoted/u);
	const mutations = [item => { item.profiles.push("dotnet"); }
		, item => { item.positions.push("field"); }
		, item => { item.shapes.push("checked-record"); }
		, item => { item.stages.installedExecution.state = "unreviewed"; }];
	for(const id of ["native-subtype-java-kotlin-ordinary-source", "reviewed-native-subtype-java", "reviewed-native-subtype-kotlin"])
	{
		for(const mutate of mutations)
		{
			const changed = structuredClone(original); mutate(changed.observations.find(item => item.id === id));
			await assert.rejects(promoteNominalSubtypeJvm(changed, references));
		}
		const missing = structuredClone(original);
		missing.observations = missing.observations.filter(item => item.id !== id);
		await assert.rejects(promoteNominalSubtypeJvm(missing, references), /Missing/u);
		const overlap = structuredClone(original);
		overlap.observations.push({ ...structuredClone(original.observations.find(item => item.id === id)), id: "unreviewed-overlap" });
		await assert.rejects(promoteNominalSubtypeJvm(overlap, references), /overlapping/u);
	}
});

test("nominal JVM promotion adds four field cells and supplements eight existing cells only", async () => {
	const original = predecessor(), references = await nominalSubtypeJvmReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nominalSubtypeJvmPromotionHistoryPath
		, await promoteNominalSubtypeJvm(original, references)
	);
	const { document: live, ...contracts } = await readTypeSurface();
	const document = JSON.parse(sourceAtHistoryMilestone(
		nominalSubtypeJvmPromotionHistoryPath, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(original.evidence.length, 500); assert.equal(proposed.evidence.length, 504);
	assert.equal(original.observations.length, 585); assert.equal(proposed.observations.length, 587);
	assert.deepEqual(withHistorySourcePins(
		nominalSubtypeJvmPromotionHistoryPath, proposed
	).evidence.slice(0, 500), original.evidence);
	assert.deepEqual(document, proposed);
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts);
	const changed = [], added = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.ok(["java", "kotlin"].includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-subtype-jvm-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
			assert.equal(before[index].stages[name].state, cell.position === "field" ? "unreviewed" : "passed");
		}
		assert.ok(cell.conversionNote.includes(nominalSubtypeJvmConversion));
		assert.ok(cell.limitations.includes(nominalSubtypeJvmLimit));
		if(cell.position === "field") added.push(cell.id);
		changed.push(cell.id);
	}
	const expected = ["java", "kotlin"].flatMap(profile => ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `${profile}/subtype/${path}/${position}`)));
	assert.deepEqual(changed.sort(), expected.sort()); assert.equal(added.length, 4);
	assert.deepEqual(original, predecessor());
});

test("nominal JVM documentation distinguishes verified Nat records from pending combinations", async () => {
	const authorPath = "docs/lean/existing-package.md";
	const author = beforeNominalSubtypePhpPromotionSource(
		authorPath, await sourceAtHistoryMilestone(
			nominalSubtypePhpPromotionHistoryPath, authorPath
		)
	);
	for(const prefix of ["| `Subtype` in acyclic", "| Lean-produced `Subtype` result without"])
	{
		const row = author.split("\n").find(line => line.startsWith(prefix));
		assert.ok(row.includes("Node installed; browser pending"));
		assert.equal((row.match(/Generated; pending/gu) ?? []).length, 1);
		assert.ok(row.includes("C/C++, Python, Ruby, Rust, C#, Java and Kotlin installed; other native hosts pending"));
		assert.ok(row.includes("All four ABIs installed"));
		assert.ok(row.includes("Node, C/C++, Perl, Python, Ruby, Rust, C#, Java and Kotlin ordinary/reviewed installed"));
	}
	for(const path of ["docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/consume/java.md", "docs/consume/kotlin.md", "docs/reference/types.md"])
		assert.ok((await sourceAtHistoryMilestone(
			nominalSubtypeJvmPromotionHistoryPath, path
		)).includes("nominal-subtype-jvm-20261013.md"), path);
	for(const profile of ["java", "kotlin"])
	{
		const source = await sourceAtHistoryMilestone(
			nominalSubtypeJvmPromotionHistoryPath, `docs/consume/${profile}.md`
		);
		assert.ok(source.includes("### Subtypes in copied records\n"));
		assert.ok(source.includes("Linux x64/glibc 2.36"));
		assert.ok(source.includes("JDK 22.0.2 and Kotlin 2.2.0"));
		assert.doesNotMatch(source, /Subtype fields in nominal records or variants, refined callback signatures and\nowned Subtypes remain unsupported/u);
		const row = source.split("\n").find(line => line.startsWith("| `Subtype /"));
		for(const route of ["Ordinary source", "Reviewed IR"])
			assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
		assert.ok(row.includes("Not audited (callback input, callback result)"));
		assert.ok(row.includes(nominalSubtypeJvmConversion));
		assert.ok(source.includes("dependent and broader generic Subtypes still need acceptance"));
	}
});
