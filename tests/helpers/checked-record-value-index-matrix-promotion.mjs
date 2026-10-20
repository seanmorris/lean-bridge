/**
 * Promote the remaining hosted C/C++, .NET and JVM value-index cells from
 * their immutable archives without widening fields, callbacks or ownership.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexNativeEvidence
	, checkedRecordValueIndexNativeEvidence
	, checkedRecordValueIndexNativeEvidenceSha256
} from "./checked-record-value-index-native-evidence.mjs";
import {
	checkCheckedRecordValueIndexDotnetEvidence
	, checkedRecordValueIndexDotnetEvidence
	, checkedRecordValueIndexDotnetEvidenceSha256
} from "./checked-record-value-index-dotnet-evidence.mjs";
import {
	checkCheckedRecordValueIndexJvmEvidence
	, checkedRecordValueIndexJvmEvidence
	, checkedRecordValueIndexJvmEvidenceSha256
} from "./checked-record-value-index-jvm-evidence.mjs";

export const checkedRecordValueIndexMatrixPromotionParent
	= "fc1a0c8bae218192482acf0a82c88b6e5b86a974";
export const checkedRecordValueIndexMatrixProfiles = Object.freeze([
	"c", "cpp", "dotnet", "java", "kotlin"
]);
export const checkedRecordValueIndexMatrixConversion
	= "Closed Bool, String and Nat indices remain authenticated type metadata rather than host fields. The generated C/GMP, C++ multiprecision, C# BigInteger, Java BigInteger and Kotlin BigInteger records expose only proof-free payloads. Full packages validate all eight indexed inputs through the exact selected Lean constructors, preserve rejected caller values, recover on the next valid call and return all eight proof-free results. Standalone result-only packages expose the same results without checked-input metadata.";
export const checkedRecordValueIndexMatrixLimit
	= "Hosted value-index acceptance covers only the retained top-level copied checked-record parameter and result sites with closed Bool, String and Nat indices. Full packages cover parameters and results; standalone result-only packages cover results only. Open or opaque indices; Int, Char, fixed-width and platform-width integers, Fin, functions, proofs, instances and other index kinds; checked-record fields, callbacks and owned positions; value-carrying dependent payloads; and zero-payload checked records remain unreviewed here. The archives retain original hosted records, complete packages, reports, caller observations and exact source closures. External Lean, C/C++, .NET, Java, Kotlin, linker and operating-system toolchains remain trusted recorded inputs.";

const laneDefinitions = Object.freeze([
	{
		lane: "native", profiles: ["c", "cpp"]
		, root: checkedRecordValueIndexNativeEvidence
		, indexSha256: checkedRecordValueIndexNativeEvidenceSha256
		, check: checkCheckedRecordValueIndexNativeEvidence
		, selections: checked => checked.accepted
		, command: "bash scripts/run-checked-record-value-index-native-ci.sh"
		, artifact: /\/handoff\/archives\/[^/]+-(?:c|cpp)\.tar\.gz$/u
		, validators: [
			".github/workflows/checked-record-value-index-native.yml"
			, "scripts/check-checked-record-value-index-native-ci.mjs"
			, "scripts/run-checked-record-value-index-native-ci.sh"
			, "tests/helpers/checked-record-value-index-native-evidence.mjs"
		]
	}
	, {
		lane: "dotnet", profiles: ["dotnet"]
		, root: checkedRecordValueIndexDotnetEvidence
		, indexSha256: checkedRecordValueIndexDotnetEvidenceSha256
		, check: () => checkCheckedRecordValueIndexDotnetEvidence(
			readFile, { controls: "none" })
		, selections: checked => checked.selections
		, command: "bash scripts/run-checked-record-value-index-dotnet-ci.sh"
		, artifact: /\/handoff\/archives\/[^/]+\.nupkg$/u
		, validators: [
			".github/workflows/checked-record-value-index-dotnet.yml"
			, "scripts/check-checked-record-value-index-dotnet-ci.mjs"
			, "scripts/run-checked-record-value-index-dotnet-ci.sh"
			, "tests/helpers/checked-record-value-index-dotnet-evidence.mjs"
		]
	}
	, {
		lane: "jvm", profiles: ["java", "kotlin"]
		, root: checkedRecordValueIndexJvmEvidence
		, indexSha256: checkedRecordValueIndexJvmEvidenceSha256
		, check: checkCheckedRecordValueIndexJvmEvidence
		, selections: checked => checked.accepted
		, command: "bash scripts/run-checked-record-value-index-jvm-ci.sh"
		, artifact: /\/handoff\/archives\/[^/]+\.(?:jar|pom)$/u
		, validators: [
			".github/workflows/checked-record-value-index-jvm.yml"
			, "scripts/check-checked-record-value-index-jvm-ci.mjs"
			, "scripts/run-checked-record-value-index-jvm-ci.sh"
			, "tests/helpers/checked-record-value-index-jvm-evidence.mjs"
		]
	}
]);
const promotionPaths = Object.freeze([
	".github/workflows/checked-record-value-index-matrix.yml"
	, "docs/evidence/README.md"
	, "docs/evidence/checked-record-value-index-matrix-promotion-20261020.md"
	, "docs/consume/c.md", "docs/consume/cpp.md", "docs/consume/dotnet.md"
	, "docs/consume/java.md", "docs/consume/kotlin.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/reference/types.md", "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "scripts/promote-checked-record-value-index-matrix.mjs"
	, "tests/checked-record-value-index-matrix.test.mjs"
	, "tests/checked-record-value-index-matrix-inventory.test.mjs"
	, "tests/helpers/checked-record-value-index-matrix-promotion.mjs"
	, "tests/helpers/checked-record-value-index-matrix-promotion-tests.mjs"
	, "tests/type-surface.test.mjs"
]);
const promotionValidators = Object.freeze([
	".github/workflows/checked-record-value-index-matrix.yml"
	, "scripts/promote-checked-record-value-index-matrix.mjs"
	, "tests/checked-record-value-index-matrix.test.mjs"
	, "tests/checked-record-value-index-matrix-inventory.test.mjs"
	, "tests/helpers/checked-record-value-index-matrix-promotion.mjs"
	, "tests/helpers/checked-record-value-index-matrix-promotion-tests.mjs"
]);
const sourcePath = route => route.replace(/^result-only-/u, "");
const resultOnly = route => route.startsWith("result-only-");
const referenceContract = Object.freeze([
	{
		lane: "native", profiles: ["c", "cpp"]
		, revision: "0e2283a4f4c0db48b7bdc7a85d119598a981324b"
		, archiver: "bf5441a82f1420b9b4490497c38a9cda3bd14937"
		, run: 39287533848, artifact: 12205716190
		, routes: [
			["ordinary-source", 1605
				, "1447558b7dcca6fef51f970838b5d1f1add0642a2773cec55fbfb19c08d97b65"
				, [["handoff/archives/checkedrecordvalueindices-1.0.0-c.tar.gz", "436ce5fb5f780d6482e8d7a0f556a6046d51b5da1375d486959ac73f5c884cc5"], ["handoff/archives/checkedrecordvalueindices-1.0.0-cpp.tar.gz", "5b033f8c3a6ca187a00f5a7467bb8f57192d62cf25779c2f6274a7d62cbda411"]]]
			, ["reviewed-ir", 1607
				, "ccd3e86a5a50c00281c33ba3771e2df95dfec9df8fa212d134b07ed7214fec29"
				, [["handoff/archives/checkedrecordvalueindices-1.0.0-c.tar.gz", "aab98558f90f7bf1d9ff638c4be41dff439c0db72f6aee75266c2558703dfe4e"], ["handoff/archives/checkedrecordvalueindices-1.0.0-cpp.tar.gz", "c582a4369d8baa2cd4cbc58265d59fa1ba263bedd9bcb4ae70f604eefd84060d"]]]
			, ["result-only-ordinary-source", 1605
				, "71180ddc6229d416eaf024dc900e3a75a7c049b89a0b7e80e11e8ef36eb66b2b"
				, [["handoff/archives/checkedrecordvalueindices-1.0.0-c.tar.gz", "e5389f2dd8bea08894841db01838b1a38013a557f3e958ae9b36514b89441cac"], ["handoff/archives/checkedrecordvalueindices-1.0.0-cpp.tar.gz", "cce06eddbd2765a965f0ff79d083e1b9c76f5ab424719a1fc0c3178bbd148f37"]]]
			, ["result-only-reviewed-ir", 1607
				, "9bf6aa6b1280288ebc01b7b709eddd4076c4bf6c7a168bb89df5e4161f041491"
				, [["handoff/archives/checkedrecordvalueindices-1.0.0-c.tar.gz", "5d667667c4f1a989e220f3b72d2b228acba937fb4b0664a47bb75546ab264071"], ["handoff/archives/checkedrecordvalueindices-1.0.0-cpp.tar.gz", "39624157a08bcf77f000eb24cceee44478a3949aef497636dee91dde5c67f226"]]]
		]
	}
	, {
		lane: "dotnet", profiles: ["dotnet"]
		, revision: "59d50c538589be9f2fd2460a7e4a1d383130ff00"
		, archiver: "48bf81cd13da3c526d6ad7f37cb968e5a5a4a948"
		, run: 39134609046, artifact: 12139408925
		, routes: [
			["ordinary-source", 850
				, "9b8a2cffc94e6b86ceee4a1f94625332eae5d342db46e3b556815c3af818b34b"
				, [["handoff/archives/Checkedrecordvalueindices.Api.1.0.0.nupkg", "0ca9bf456c0c580b74270f1333c8acebef0aac4ac10668e54e35d7a968033d12"]]]
			, ["reviewed-ir", 852
				, "33b6200ca20d681a56a7d252fececd75676a5da251dd61554d347e17e9ee5d81"
				, [["handoff/archives/Checkedrecordvalueindices.Api.1.0.0.nupkg", "7cddac614d2df8706eb2c4f2b7ef479d2d758b5065b873268091638857e00927"]]]
			, ["result-only-ordinary-source", 849
				, "25cb4f57711e098a6ba991028f85e19014f9b56b8e07d6243f241183a2ae5afa"
				, [["handoff/archives/Checkedrecordvalueindices.Api.1.0.0.nupkg", "acdf948241783b97093f5a327a3e3a01babf6f7ae766cd973bd58a30db0cda3b"]]]
			, ["result-only-reviewed-ir", 851
				, "c19838aa3cc6d300268e1c22ca21bed7fab6e2fc0255e2885bdfdc37bd28f6b9"
				, [["handoff/archives/Checkedrecordvalueindices.Api.1.0.0.nupkg", "c6ddd098051981b7897237c8aa3b2449772a6aeac472789f886ae8d9fcf56cab"]]]
		]
	}
	, {
		lane: "jvm", profiles: ["java", "kotlin"]
		, revision: "df22aa02bea72c3de550f15ab00b2a89b70f279e"
		, archiver: "02d4347ee26bfc06eecee3f00ba4faf4be427a9a"
		, run: 39213054169, artifact: 12169642246
		, routes: [
			["ordinary-source", 1654
				, "2f021739b02ca9d75e2940cae94fa28eb64b595c04d6d6ece4b31ae6598252ad"
				, [["handoff/archives/checkedrecordvalueindices-1.0.0.jar", "f4ed78ef108a59a219cf8ba432ca63d8f3e1ccf4b4673e4431a8ad75ed5b4022"], ["handoff/archives/checkedrecordvalueindices-1.0.0.pom", "5de9407e972da0eb0368a1648a201a6af60564467e5640b23322f599518a7056"]]]
			, ["reviewed-ir", 1656
				, "890b108b851d7215f1d7b26640fe77b695f535e1c157af456c8bbbaea8fc4242"
				, [["handoff/archives/checkedrecordvalueindices-1.0.0.jar", "7c2bbb9031d04c11943a3621314b660afd84529dadb8d8c2f9384d03e872cc9b"], ["handoff/archives/checkedrecordvalueindices-1.0.0.pom", "5de9407e972da0eb0368a1648a201a6af60564467e5640b23322f599518a7056"]]]
			, ["result-only-ordinary-source", 1643
				, "e9ee0774e7c286fba563bf245deae9f7aca499bf96e2a80cbf83a7685567260f"
				, [["handoff/archives/checkedrecordvalueindices-1.0.0.jar", "db8d23c8664ea4fe284bb6840c316fc6c42b7cd095623a5922b283baa61355bc"], ["handoff/archives/checkedrecordvalueindices-1.0.0.pom", "5de9407e972da0eb0368a1648a201a6af60564467e5640b23322f599518a7056"]]]
			, ["result-only-reviewed-ir", 1645
				, "4945c9ec5137eb239bf04944fc64ebfd6889b0c34bf9bf8348da7a50ddcf98ec"
				, [["handoff/archives/checkedrecordvalueindices-1.0.0.jar", "6f43e66ef862024bcff5fcc52193891b7576402661ea1adfd8e0628b283a56d1"], ["handoff/archives/checkedrecordvalueindices-1.0.0.pom", "5de9407e972da0eb0368a1648a201a6af60564467e5640b23322f599518a7056"]]]
		]
	}
]);

/** Refuse missing, reordered or forged route/reference metadata. */
export const assertCheckedRecordValueIndexMatrixPromotionReferences
	= references => {
		assert.ok(Array.isArray(references));
		assert.equal(references.length, 12);
		let index = 0;
		for(const contract of referenceContract)
			for(const [route, fileCount, filesSha256, artifacts] of contract.routes)
			{
				const reference = references[index++];
				assert.equal(reference.id
					, `checked-record-value-index-${contract.lane}-${route}-hosted-installed`);
				assert.equal(reference.lane, contract.lane);
				assert.equal(reference.route, route);
				assert.equal(reference.sourcePath, sourcePath(route));
				assert.equal(reference.mode
					, resultOnly(route) ? "result-only" : "full");
				assert.deepEqual(reference.profiles, contract.profiles);
				assert.deepEqual(reference.positions, resultOnly(route)
					? ["result"] : ["parameter", "result"]);
				assert.equal(reference.revision, contract.revision);
				assert.equal(reference.consumerRevision, contract.revision);
				assert.equal(reference.checkerRevision, contract.revision);
				assert.equal(reference.archiverRevision, contract.archiver);
				assert.equal(reference.hostedRun, contract.run);
				assert.equal(reference.artifact, contract.artifact);
				assert.equal(reference.files.length, fileCount);
				assert.equal(sha256(JSON.stringify(reference.files)), filesSha256);
				assert.deepEqual(reference.artifacts, artifacts.map(
					([path, digest]) => ({ path, sha256: digest })));
				assert.ok(reference.scope.includes(
					checkedRecordValueIndexMatrixLimit));
			}
		return references;
	};

/** Authenticate all twelve remaining hosted route records. */
export const checkedRecordValueIndexMatrixPromotionReferences = async () => {
	const references = [];
	for(const definition of laneDefinitions)
	{
		const checked = await definition.check();
		assert.equal(checked.hostedAcceptance, true);
		assert.equal(checked.supportPromoted, false);
		const selections = definition.selections(checked);
		assert.deepEqual(selections.map(item => item.route), [
			"ordinary-source", "reviewed-ir"
			, "result-only-ordinary-source", "result-only-reviewed-ir"
		]);
		for(const accepted of selections)
		{
			const route = accepted.route;
			const selected = checked.files.filter(file =>
				file.path.startsWith(`${route}/`)
				|| file.path.startsWith("sources/")
				|| file.path.startsWith("hosted/"));
			const artifacts = selected.filter(file =>
				definition.artifact.test(file.path));
			assert.ok(artifacts.length > 0, `${definition.lane}/${route}`);
			const mode = resultOnly(route) ? "result-only" : "full";
			const scope = `Hosted GitHub Actions run ${checked.hostedRun.runId} rebuilt the ${mode} ${sourcePath(route)} ${definition.profiles.join("/")} package selection on Ubuntu 24.04. Two author roots reproduce the complete package, remove author sources, install without network access, relocate the installed tree and replay unchanged typed callers. ${resultOnly(route) ? "The standalone result-only API exposes all eight proof-free indexed results without checked-input metadata." : "The full API exercises all eight checked inputs, exact constructor failures, unchanged rejected values, recovery and all eight proof-free indexed results."} The retained archive authenticates every original artifact byte, route result, package, caller observation and selected source. ${checkedRecordValueIndexMatrixLimit}`;
			references.push({
				id: `checked-record-value-index-${definition.lane}-${route}-hosted-installed`
				, lane: definition.lane, route, mode
				, sourcePath: sourcePath(route)
				, profiles: [...definition.profiles]
				, positions: resultOnly(route)
					? ["result"] : ["parameter", "result"]
				, revision: checked.producer, consumerRevision: checked.consumer
				, checkerRevision: checked.checker
				, archiverRevision: checked.archiver
				, hostedRun: checked.hostedRun.runId
				, artifact: checked.hostedRun.artifact.id
				, command: definition.command, counts: accepted, scope
				, files: [
					{ path: `${definition.root}/index.json`
						, sha256: definition.indexSha256 }
					, ...selected.map(file => ({
						path: `${definition.root}/${file.path}`
						, sha256: file.sha256
					}))
				]
				, artifacts: artifacts.map(file => ({
					path: file.path.slice(`${route}/records/`.length)
					, sha256: file.sha256
				}))
			});
		}
	}
	return assertCheckedRecordValueIndexMatrixPromotionReferences(references);
};

/** Promote exactly twenty cells from the authenticated native/managed lanes. */
export const promoteCheckedRecordValueIndexMatrix = async (
	original, references
) => {
	assertCheckedRecordValueIndexMatrixPromotionReferences(references);
	const inventory = structuredClone(original);
	const sourcesByLane = new Map();
	for(const definition of laneDefinitions)
		sourcesByLane.set(definition.lane, await Promise.all(
			[...definition.validators, ...promotionValidators].map(async path => ({
				path, sha256: sha256(await readFile(path))
			}))));
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, "Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...sourcesByLane.get(reference.lane), ...reference.files]
			, artifacts: reference.artifacts.map(item => ({
				...item, path: `${reference.id}/${item.path}`
			}))
		});
	}
	for(const profile of checkedRecordValueIndexMatrixProfiles)
		for(const path of ["ordinary-source", "reviewed-ir"])
			for(const position of ["parameter", "result"])
			{
				const matches = references.filter(reference =>
					reference.profiles.includes(profile)
					&& reference.sourcePath === path
					&& reference.positions.includes(position));
				assert.equal(matches.length, position === "result" ? 2 : 1);
				const observations = inventory.observations.filter(item =>
					item.profiles.length === 1 && item.profiles[0] === profile
					&& item.shapes.length === 1
					&& item.shapes[0] === "checked-record"
					&& item.path === path && item.positions.length === 1
					&& item.positions[0] === position);
				assert.equal(observations.length, 1
					, `Missing or overlapping matrix cell: ${profile}/${path}/${position}`);
				const observation = observations[0];
				const ids = matches.map(item => item.id);
				const scope = matches.map(item => item.scope).join(" ");
				observation.scope += " Additional hosted closed-index acceptance: "
					+ scope;
				observation.conversionNotes["checked-record"] += " "
					+ checkedRecordValueIndexMatrixConversion;
				observation.limitations.push(checkedRecordValueIndexMatrixLimit);
				for(const stage of Object.values(observation.stages))
				{
					assert.equal(stage.state, "passed");
					stage.evidence.push(...ids);
					assert.equal(new Set(stage.evidence).size, stage.evidence.length);
					stage.note += " Additional hosted closed-index acceptance: "
						+ scope;
				}
			}
	const pins = new Map(await Promise.all(promotionPaths.map(async path => [
		path, sha256(await readFile(path))
	])));
	for(const evidence of inventory.evidence) for(const file of evidence.files)
		if(pins.has(file.path)) file.sha256 = pins.get(file.path);
	return inventory;
};

/** Read the exact inventory preceding the final matrix promotion. */
export const checkedRecordValueIndexMatrixPromotionBaseline = () => JSON.parse(
	execFileSync("git", ["show"
		, `${checkedRecordValueIndexMatrixPromotionParent}:docs/type-surface.v1.json`]
	, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 })
);
