/**
 * Promote the independently archived zero-payload browser, PHP, Python, Ruby,
 * Perl and WIT lanes without inferring PHP-Wasm or any other host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadBrowserEvidence, zeroPayloadBrowserEvidence
	, zeroPayloadBrowserEvidenceSha256
} from "./zero-payload-checked-record-browser-evidence.mjs";
import {
	checkZeroPayloadPhpEvidence, zeroPayloadPhpEvidence
	, zeroPayloadPhpEvidenceSha256
} from "./zero-payload-checked-record-php-evidence.mjs";
import {
	checkZeroPayloadPythonEvidence, zeroPayloadPythonEvidence
	, zeroPayloadPythonEvidenceSha256
} from "./zero-payload-checked-record-python-evidence.mjs";
import {
	checkZeroPayloadRubyEvidence, zeroPayloadRubyEvidence
	, zeroPayloadRubyEvidenceSha256
} from "./zero-payload-checked-record-ruby-evidence.mjs";
import {
	checkZeroPayloadPerlEvidence, zeroPayloadPerlEvidence
	, zeroPayloadPerlEvidenceSha256
} from "./zero-payload-checked-record-perl-evidence.mjs";
import {
	checkZeroPayloadWitEvidence, zeroPayloadWitEvidence
	, zeroPayloadWitEvidenceSha256
} from "./zero-payload-checked-record-wit-evidence.mjs";

export const zeroPayloadHostedPromotionParent
	= "e434aaffaeda338c7abbb13c439466a4f7fb4a17";

const routes = Object.freeze([
	"ordinary-source", "reviewed-ir"
	, "result-only-ordinary-source", "result-only-reviewed-ir"
]);
const route = (name, count, digest, artifacts) => Object.freeze({
	name, count, digest, artifacts: Object.freeze(artifacts)
});
const hostTypes = (profiles, parameter, result = parameter) => {
	const values = {};
	for(const profile of profiles)
		values[profile] = Object.freeze({ parameter, result });
	return Object.freeze(values);
};

const producer = "736ce9d03fc324ed6004aa77de534cd9885bfa83";
const sharedLimitation = label => `Hosted zero-payload ${label} acceptance covers only the retained Witness, Token, Marker, Option, Array and Mark fixtures at copied parameter and result sites in four ordinary/reviewed full/result-only packages. It does not promote checked-record fields, callbacks, owned positions, other zero-payload shapes, PHP-Wasm or another host. External Lean, consumer-language, package-manager and operating-system toolchains remain trusted recorded inputs.`;

export const zeroPayloadHostedPromotionLanes = Object.freeze([
	Object.freeze({
		key: "browser", label: "npm/browser"
		, profiles: Object.freeze([
			"node-javascript", "node-typescript", "browser-javascript"
			, "browser-react", "browser-worker"
		])
		, root: zeroPayloadBrowserEvidence
		, indexSha256: zeroPayloadBrowserEvidenceSha256
		, check: checkZeroPayloadBrowserEvidence
		, revisions: Object.freeze([producer, producer, producer, producer])
		, run: 39588425879, artifact: 12342149147
		, command: "bash scripts/run-zero-payload-checked-record-browser-ci.sh"
		, validators: Object.freeze([
			".github/workflows/zero-payload-checked-record-browser.yml"
			, "scripts/check-zero-payload-checked-record-browser-ci.mjs"
			, "scripts/run-zero-payload-checked-record-browser-ci.sh"
			, "tests/helpers/zero-payload-checked-record-browser-evidence.mjs"
		])
		, conversion: "Proof-only Witness crosses as an owned JavaScript object with no payload properties and as Readonly<Record<PropertyKey, never>> in TypeScript. Token keeps its Unit field, plain empty Marker remains distinct, Option presence, array length and active or inactive Mark branches remain explicit. Full packages validate the nullary checked constructor and exact rejection and recovery; result-only packages project Lean-produced proof-erased values without input-constructor metadata."
		, limitation: sharedLimitation("npm/Node/browser")
		, hostTypes: hostTypes([
			"node-javascript", "node-typescript", "browser-javascript"
			, "browser-react", "browser-worker"
		], "Owned empty JavaScript Witness object; TypeScript exposes Readonly<Record<PropertyKey, never>>, Token keeps tag: undefined and Marker remains a distinct empty object")
		, contracts: Object.freeze([
			route("ordinary-source", 2496, "81cac90f2c75e55f51895dd3f2e92bde2a51dcc6c6a72f9899c8a7183602a3b7", [["handoff/lean-bridge-runtime-0.0.0-abi2.446d9ad743b2e3671888b7eefe4f53805b0fb4d42d0b0f9a0c8045696ece4b7f.tgz", "7585d5f74f6eda97aca2e77bdb06c0abd6534225d577a0d6e5816971ff516df4"], ["handoff/zeropayloadcheckedrecords-1.0.0.tgz", "7ad3b865762976a41d7ce6d46dac100ed6b59daf788633007044cb87cbce479d"]])
			, route("reviewed-ir", 2496, "79a537f84fffaeefa64ae17b9ed4d426444472213a56f20f7e8d10a986a8d0d3", [["handoff/lean-bridge-runtime-0.0.0-abi2.446d9ad743b2e3671888b7eefe4f53805b0fb4d42d0b0f9a0c8045696ece4b7f.tgz", "7585d5f74f6eda97aca2e77bdb06c0abd6534225d577a0d6e5816971ff516df4"], ["handoff/zeropayloadcheckedrecords-1.0.0.tgz", "1141ad5eeb16b10a1a101b1dfc7617e4546d31a23f0c77760c078402c7400a22"]])
			, route("result-only-ordinary-source", 2496, "70b242eeb24a2236fd3d663867bccda26ee79aaa086e8065977bb94a656a6083", [["handoff/lean-bridge-runtime-0.0.0-abi2.446d9ad743b2e3671888b7eefe4f53805b0fb4d42d0b0f9a0c8045696ece4b7f.tgz", "7585d5f74f6eda97aca2e77bdb06c0abd6534225d577a0d6e5816971ff516df4"], ["handoff/zeropayloadcheckedrecords-1.0.0.tgz", "9d7062b1fa3db32eb31196e0f09857eab044694d79f6a66c86af3c161c1a741e"]])
			, route("result-only-reviewed-ir", 2496, "78d901f5643521a2a1fd3b8b143f5de06bb4640c779e1a4c648308963530c4a7", [["handoff/lean-bridge-runtime-0.0.0-abi2.446d9ad743b2e3671888b7eefe4f53805b0fb4d42d0b0f9a0c8045696ece4b7f.tgz", "7585d5f74f6eda97aca2e77bdb06c0abd6534225d577a0d6e5816971ff516df4"], ["handoff/zeropayloadcheckedrecords-1.0.0.tgz", "18ac13895fa66637896251ccba0af722dc9dd6ac53da3032ac202571c853ea96"]])
		])
	})
	, Object.freeze({
		key: "php", label: "native PHP", profiles: Object.freeze(["php-native"])
		, root: zeroPayloadPhpEvidence, indexSha256: zeroPayloadPhpEvidenceSha256
		, check: checkZeroPayloadPhpEvidence
		, revisions: Object.freeze([producer, producer, producer, "ae553edc16c9ee5606d8375414946b497351f672"])
		, run: 39588427478, artifact: 12342822535
		, command: "bash scripts/run-zero-payload-checked-record-php-ci.sh"
		, validators: Object.freeze([".github/workflows/zero-payload-checked-record-php.yml", "scripts/check-zero-payload-checked-record-php-ci.mjs", "scripts/run-zero-payload-checked-record-php-ci.sh", "tests/helpers/zero-payload-checked-record-php-evidence.mjs"])
		, conversion: "Proof-only Witness crosses as a guarded zero-argument readonly PHP class. Token retains its null Unit field, Marker remains a distinct readonly class, and Option presence, list length and both Mark branches remain distinct. Full Composer packages validate the nullary checked constructor, exact-class failures and recovery; result-only packages project Lean-produced proof-erased values without input-constructor metadata."
		, limitation: sharedLimitation("native PHP")
		, hostTypes: hostTypes(["php-native"], "Guarded zero-argument readonly PHP Witness object; Token keeps its null Unit field and Marker remains a distinct readonly object")
		, contracts: Object.freeze([
			route("ordinary-source", 1740, "5dc50842b9c4915807b10317a4479845ac5f31129efb9425ba39c5074822d2e2", [["handoff/archives/example-zeropayloadcheckedrecords-1.0.0-linux-x86_64.zip", "4f10d1fd03545ffc84304bf21fadfe97c73ac2fc0898ea7d5431af9078edf935"]])
			, route("reviewed-ir", 1742, "411bc7e7fca5e444427540b3cdb80e440505e700da9f3ff454fab296ac3c5f32", [["handoff/archives/example-zeropayloadcheckedrecords-1.0.0-linux-x86_64.zip", "12e3c05eb64dbe0ffd05d857e6195597a66a88668216d00b361403300082827b"]])
			, route("result-only-ordinary-source", 1740, "15848826bf7d3dd10160668e45e005ac1a76b65ac31325f2d776d7b1a221ba6e", [["handoff/archives/example-zeropayloadcheckedrecords-1.0.0-linux-x86_64.zip", "c7d570006e0874ac32bb93786a6fcfc5553454dbeae189c6429d2b43570e9287"]])
			, route("result-only-reviewed-ir", 1742, "94025c838d7a9ed3015be3af667c368390b9a0855fd21bdf9f0aed7798357ff4", [["handoff/archives/example-zeropayloadcheckedrecords-1.0.0-linux-x86_64.zip", "68b1478d94bc31a76965ae953271e21d342afd92251f00cc19d9b8abb7ecf6df"]])
		])
	})
	, Object.freeze({
		key: "python", label: "Python", profiles: Object.freeze(["python"])
		, root: zeroPayloadPythonEvidence
		, indexSha256: zeroPayloadPythonEvidenceSha256
		, check: checkZeroPayloadPythonEvidence
		, revisions: Object.freeze([producer, producer, producer, "ae553edc16c9ee5606d8375414946b497351f672"])
		, run: 39588425854, artifact: 12343095184
		, command: "bash scripts/run-zero-payload-checked-record-python-ci.sh"
		, validators: Object.freeze([".github/workflows/zero-payload-checked-record-python.yml", "scripts/check-zero-payload-checked-record-python-ci.mjs", "scripts/run-zero-payload-checked-record-python-ci.sh", "tests/helpers/zero-payload-checked-record-python-evidence.mjs"])
		, conversion: "Proof-only Witness crosses as a frozen, slotted Python dataclass with no fields. Token retains tag: None, Marker remains a distinct frozen dataclass, Some(Witness()) stays distinct from None, and sequences retain their length and Mark branch. Full wheels validate exact classes, the nullary constructor and recovery; result-only wheels project Lean-produced proof-erased values without input-constructor metadata."
		, limitation: sharedLimitation("Python")
		, hostTypes: hostTypes(["python"], "Frozen slotted zero-field Python Witness dataclass; Token keeps tag: None and Marker remains a distinct frozen dataclass")
		, contracts: Object.freeze([
			route("ordinary-source", 1728, "6e5af4462d6722316f6f51c041f6c24e3cc26767a7d74d63f3301762fe3fdf2c", [["handoff/archives/zeropayloadcheckedrecords-1.0.0-py3-none-manylinux_2_38_x86_64.whl", "c6e6af53bd8e5430376ad39af5f21178be625f2feef354c694cbed54cdd07aaa"]])
			, route("reviewed-ir", 1730, "08c889a9327b1302bb4e8066a41a47b2b0db2504d3c03f60b2bc6ae8bdc64bf2", [["handoff/archives/zeropayloadcheckedrecords-1.0.0-py3-none-manylinux_2_38_x86_64.whl", "4d280bae75af89624192ccb7fc24f7ba297b31286cef4f50a3b1e85ba67e465b"]])
			, route("result-only-ordinary-source", 1728, "7f9b90710664e816e19c69c610f0eccdbe9cd920bc960952fcbe3deb2cb6c573", [["handoff/archives/zeropayloadcheckedrecords-1.0.0-py3-none-manylinux_2_38_x86_64.whl", "e829564918134e1a67925dd74c649fc56eaf44c8e93c618a5b7a6656dcdcc878"]])
			, route("result-only-reviewed-ir", 1730, "769d1d25a3a29ca934445328f50b83b766b8ca3af1a1fbb3cd58a80080968e96", [["handoff/archives/zeropayloadcheckedrecords-1.0.0-py3-none-manylinux_2_38_x86_64.whl", "7e90fbf4f8ceca905a53654d58cbce87cd6d6fac69264299e9ca993c8e17c6f4"]])
		])
	})
	, Object.freeze({
		key: "ruby", label: "Ruby", profiles: Object.freeze(["ruby"])
		, root: zeroPayloadRubyEvidence, indexSha256: zeroPayloadRubyEvidenceSha256
		, check: checkZeroPayloadRubyEvidence
		, revisions: Object.freeze([producer, producer, producer, "ae553edc16c9ee5606d8375414946b497351f672"])
		, run: 39588425786, artifact: 12343731732
		, command: "bash scripts/run-zero-payload-checked-record-ruby-ci.sh"
		, validators: Object.freeze([".github/workflows/zero-payload-checked-record-ruby.yml", "scripts/check-zero-payload-checked-record-ruby-ci.mjs", "scripts/run-zero-payload-checked-record-ruby-ci.sh", "tests/helpers/zero-payload-checked-record-ruby-evidence.mjs"])
		, conversion: "Proof-only Witness crosses as a frozen Ruby exact-class value with a nullary initializer and no fields. Token retains its UNIT value, Marker remains a distinct frozen class, nil and Some(Witness) remain distinct, arrays retain length, and Mark keeps its branch. Full gems validate exact classes, the nullary constructor and recovery; result-only gems project Lean-produced proof-erased values without input-constructor metadata."
		, limitation: sharedLimitation("Ruby")
		, hostTypes: hostTypes(["ruby"], "Frozen nullary Ruby Witness exact-class value; Token keeps UNIT and Marker remains a distinct frozen exact class")
		, contracts: Object.freeze([
			route("ordinary-source", 1730, "b864643935947d954693f361705f44d091ac577c410a34a94b1161b5927174a7", [["handoff/archives/zeropayloadcheckedrecords-1.0.0-x86_64-linux.gem", "19c82a068ad9714da16347b03b4b3308e143b8c70294926fd90e2c1690b75935"]])
			, route("reviewed-ir", 1732, "64a67a5a2bc37b9d7832e85f9b12706ff12b45b6df16ef682e739096184664dc", [["handoff/archives/zeropayloadcheckedrecords-1.0.0-x86_64-linux.gem", "ec06a2e66c192918dfe7ce394f0c98540278b16b4ff377cb635af9046590716d"]])
			, route("result-only-ordinary-source", 1730, "aceea4af3e37f658252a24dcbe1726adaaa95e235b46033fbf796d5d5ea573a9", [["handoff/archives/zeropayloadcheckedrecords-1.0.0-x86_64-linux.gem", "88e192fac9ea5bcd0d3b3a286305b03505704da3b32892d5370c155c1a6a7704"]])
			, route("result-only-reviewed-ir", 1732, "e203f13d4f85956e7a98623e46c631eb8650a524c1a46811364580d6f01c79ab", [["handoff/archives/zeropayloadcheckedrecords-1.0.0-x86_64-linux.gem", "5ada759b8012c034dafe7da37e4d571cda25da8e30f45ce97262c23e9d65465f"]])
		])
	})
	, Object.freeze({
		key: "perl", label: "Perl", profiles: Object.freeze(["perl"])
		, root: zeroPayloadPerlEvidence, indexSha256: zeroPayloadPerlEvidenceSha256
		, check: checkZeroPayloadPerlEvidence
		, revisions: Object.freeze([producer, producer, producer, "3c7d0e55c81ab352561592ff6456ac26f59896bc"])
		, run: 39588425122, artifact: 12344196352
		, command: "bash scripts/run-zero-payload-checked-record-perl-ci.sh"
		, validators: Object.freeze([".github/workflows/zero-payload-checked-record-perl.yml", "scripts/check-zero-payload-checked-record-perl-ci.mjs", "scripts/run-zero-payload-checked-record-perl-ci.sh", "tests/helpers/zero-payload-checked-record-perl-evidence.mjs"])
		, conversion: "Proof-only Witness crosses as an exact blessed Perl class backed by a plain empty hash. Token retains its Unit value, Marker remains a distinct blessed class, undef stays distinct from a present Witness, arrays retain length, and Mark keeps its branch. Full CPAN packages validate exact classes across four ABI interpreters, the nullary constructor and recovery; result-only packages project Lean-produced proof-erased values without input-constructor metadata."
		, limitation: sharedLimitation("Perl/XS")
		, hostTypes: hostTypes(["perl"], "Exact blessed Perl Witness class backed by a plain empty hash; Token keeps Unit and Marker remains a distinct blessed class")
		, contracts: Object.freeze([
			route("ordinary-source", 1870, "1ae07e538abaf908a0d3036912bfb933012e160d55e9465481e6d194b27d5c6f", [["handoff/archives/LeanBridge-Runtime-0.0020130180835253351074425099676719723942806298898514237203907626409680523998624031.tar.gz", "c228af9110ba0b81d73a1fdf58d4435a68ab6c6ab0913382435ce0a2ee22de80"], ["handoff/archives/LeanBridge-ZeroPayloadCheckedRecords-1.000.tar.gz", "9cc3d3ff5a2b7a8af65783068192e1ada162ad05c7c3c7cfe0d4045acd0aa9ab"]])
			, route("reviewed-ir", 1872, "beea4b6c316b926520a37e18811771c9239ab3ec227fae7b4632f373a2642264", [["handoff/archives/LeanBridge-Runtime-0.0020130180835253351074425099676719723942806298898514237203907626409680523998624031.tar.gz", "c228af9110ba0b81d73a1fdf58d4435a68ab6c6ab0913382435ce0a2ee22de80"], ["handoff/archives/LeanBridge-ZeroPayloadCheckedRecords-1.000.tar.gz", "09a44021972bc87e74d6ad9071fbe53bb1005d26a55271bf87a6ba6f33cf3c35"]])
			, route("result-only-ordinary-source", 1870, "056a32dd0a67b41d1b39499768a172d6ea06ca6017b6abe4ca973c782428b35e", [["handoff/archives/LeanBridge-Runtime-0.0020130180835253351074425099676719723942806298898514237203907626409680523998624031.tar.gz", "c228af9110ba0b81d73a1fdf58d4435a68ab6c6ab0913382435ce0a2ee22de80"], ["handoff/archives/LeanBridge-ZeroPayloadCheckedRecords-1.000.tar.gz", "b2b04ecdd1f082731b41137d3410989416e68f8ef1f3dc6da984e4168b1edb34"]])
			, route("result-only-reviewed-ir", 1872, "b39880fbae1fccada117d8310b73407267aa27f319531002f472d58e11016f3a", [["handoff/archives/LeanBridge-Runtime-0.0020130180835253351074425099676719723942806298898514237203907626409680523998624031.tar.gz", "c228af9110ba0b81d73a1fdf58d4435a68ab6c6ab0913382435ce0a2ee22de80"], ["handoff/archives/LeanBridge-ZeroPayloadCheckedRecords-1.000.tar.gz", "9adb2844f53f6b2beac55ae867da34c39edd54976832036aa9b6b08e8f6053d6"]])
		])
	})
	, Object.freeze({
		key: "wit", label: "WIT/WASI", profiles: Object.freeze(["wit-wasi"])
		, root: zeroPayloadWitEvidence, indexSha256: zeroPayloadWitEvidenceSha256
		, check: checkZeroPayloadWitEvidence
		, revisions: Object.freeze([producer, producer, producer, "e92c68019fb78e3add2d506af7719dc40db6e462"])
		, run: 39588427412, artifact: 12344107815
		, command: "bash scripts/run-zero-payload-checked-record-wit-ci.sh"
		, validators: Object.freeze([".github/workflows/zero-payload-checked-record-wit.yml", "scripts/check-zero-payload-checked-record-wit-ci.mjs", "scripts/run-zero-payload-checked-record-wit-ci.sh", "tests/helpers/zero-payload-checked-record-wit-evidence.mjs"])
		, conversion: "Proof-only Witness follows the generator's WIT empty-carrier convention as enum witness { empty }; this is a representation choice, not a Lean semantic distinction. Token remains record token { tag: unit }, Marker uses its own empty enum, option presence, list length and Mark branches remain explicit. Full component packages validate the nullary checked constructor and recovery; result-only packages project Lean-produced proof-erased values without input-constructor metadata."
		, limitation: sharedLimitation("WIT/WASI")
		, hostTypes: hostTypes(["wit-wasi"], "WIT enum witness { empty } following the generator empty-carrier convention; Token keeps tag: unit and Marker remains a distinct empty enum")
		, contracts: Object.freeze([
			route("ordinary-source", 1837, "794aec49970242a60b837503fff74b5a70a9cc1239b085c9f9d8077a8676424a", [["handoff/archives/zeropayloadcheckedrecords-1.0.0-wit-wasi.tar.gz", "9b9ac829cdc76fc4589d66d71cd172d6fdf399f6bc130c541958fe06ac8c9fe4"]])
			, route("reviewed-ir", 1839, "28f8f63b00aeb3effefe78d84a05e310c9469fd49a9b0f4f9fa154c94aabda72", [["handoff/archives/zeropayloadcheckedrecords-1.0.0-wit-wasi.tar.gz", "4f0a36fb6f3bceb2216a68a297f3ddaecd8230a1edb59b908c26da84e4b46310"]])
			, route("result-only-ordinary-source", 1837, "a676cf3c9d0b15069e49f03fc236d020d42fe9aadf75d94c4a9d68b51c70e1ba", [["handoff/archives/zeropayloadcheckedrecords-1.0.0-wit-wasi.tar.gz", "0ce22a6ce6dc8617048b1107721b6594eb282492b8304bd8d2dc3c098ce0adf4"]])
			, route("result-only-reviewed-ir", 1839, "662c51a38a4b4687406fe20acf011c1335dd351ccceef33f848d55c0711661e0", [["handoff/archives/zeropayloadcheckedrecords-1.0.0-wit-wasi.tar.gz", "fdb0ae70713371c01d6c1e3b520dd3efa98befbd209c9eafa83efa73e7568412"]])
		])
	})
]);

export const zeroPayloadHostedPromotionProfiles = Object.freeze(
	zeroPayloadHostedPromotionLanes.flatMap(lane => lane.profiles));
export const zeroPayloadHostedPromotionIds = Object.freeze(
	zeroPayloadHostedPromotionLanes.flatMap(lane => routes.map(name =>
		`zero-payload-${lane.key}-${name}-hosted-installed`)));
export const zeroPayloadHostedPromotionPinPaths = Object.freeze([
	"docs/consume/perl.md", "docs/consume/python.md", "docs/consume/ruby.md"
	, "docs/consume/wit-wasi.md", "docs/lean/existing-package.md", "docs/php.md"
	, "docs/lean/export-decisions.md", "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs", "src/analyze/NativeExports.lean"
	, "src/analyze/semantic-model.mjs", "src/backends/rust/package-audit.mjs"
	, "tests/native-fin-containers.test.mjs", "tests/type-surface.test.mjs"
]);

const parse = bytes => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value));
	return value;
};
const sourcePath = name => name.replace(/^result-only-/u, "");

const referencesFromLane = async (lane, checked, read) => {
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.deepEqual([
		checked.producer, checked.consumer, checked.checker, checked.archiver
	], lane.revisions);
	const indexPath = `${lane.root}/index.json`;
	const index = parse(Buffer.from(await read(indexPath)));
	assert.equal(index.hostedRun.runId, lane.run);
	assert.equal(index.hostedRun.artifact.id, lane.artifact);
	const references = [];
	for(const contract of lane.contracts)
	{
		const run = index.runs.find(item => item.route === contract.name);
		assert.ok(run, contract.name);
		const files = index.files.filter(file =>
			file.path.startsWith(`${contract.name}/`)
			|| file.path.startsWith("sources/") || file.path.startsWith("hosted/"));
		assert.equal(files.length, contract.count, `${lane.key}/${contract.name}`);
		assert.equal(sha256(JSON.stringify(files)), contract.digest
			, `${lane.key}/${contract.name}`);
		const artifacts = contract.artifacts.map(([path, expected]) => {
			const file = index.files.find(item =>
				item.path === `${contract.name}/records/${path}`);
			assert.ok(file, `${lane.key}/${contract.name}/${path}`);
			assert.equal(file.sha256, expected, path);
			return { path, sha256: file.sha256 };
		});
		const resultOnly = contract.name.startsWith("result-only-");
		const verb = resultOnly
			? "projects proof-erased Witness, Token, Marker, Option, Array and Mark values without checked-input metadata"
			: "runs the selected nullary Witness constructor at every checked input, keeps rejected values unchanged, recovers on the next valid call and projects proof-erased results";
		const evidenceFiles = files.map(file => ({
			path: `${lane.root}/${file.path}`, sha256: file.sha256
		}));
		references.push({
			id: `zero-payload-${lane.key}-${contract.name}-hosted-installed`
			, lane: lane.key, route: contract.name
			, sourcePath: sourcePath(contract.name)
			, mode: resultOnly ? "result-only" : "full"
			, profiles: [...lane.profiles]
			, positions: resultOnly ? ["result"] : ["parameter", "result"]
			, revision: lane.revisions[0], command: lane.command
			, scope: `Hosted GitHub Actions run ${lane.run} rebuilt the ${contract.name} ${lane.label} selection on Ubuntu 24.04. Two independent author roots reproduced the complete prepared package before author removal, source-free offline installation and unchanged replay after physical relocation. The package ${verb}. The retained archive authenticates every original artifact byte, route result, caller observation and exact producer, consumer, checker and archiver source closure. ${lane.limitation}`
			, files: [{ path: indexPath, sha256: lane.indexSha256 }
				, ...evidenceFiles]
			, artifacts
		});
	}
	return references;
};

let cachedReferences;

/**
 * Authenticate all six retained hosted archives and derive 24 exact references.
 *
 * @param read - Repository-relative evidence reader.
 */
export const zeroPayloadHostedPromotionReferences = async (read = readFile) => {
	const derive = async () => (await Promise.all(zeroPayloadHostedPromotionLanes
		.map(async lane => referencesFromLane(lane, await lane.check(read), read)))).flat();
	if(read !== readFile) return derive();
	cachedReferences ??= derive();
	return structuredClone(await cachedReferences);
};

/**
 * Advance exactly the mutable source pins exposed by this promotion.
 *
 * @param original - Exact inventory before reconciliation.
 */
export const reconcileZeroPayloadHostedPromotionPins = async original => {
	const digests = new Map();
	for(const path of zeroPayloadHostedPromotionPinPaths)
		digests.set(path, sha256(await readFile(path)));
	const seen = new Set();
	const evidence = original.evidence.map(item => {
		let changed = false;
		const files = item.files.map(file => {
			if(digests.has(file.path))
			{
				seen.add(file.path);
				changed = changed || file.sha256 !== digests.get(file.path);
				return { ...file, sha256: digests.get(file.path) };
			}
			return file;
		});
		return changed ? { ...item, files } : item;
	});
	assert.deepEqual([...seen].sort(), [...zeroPayloadHostedPromotionPinPaths].sort());
	return { ...original, evidence };
};

/**
 * Promote exactly 40 copied parameter/result cells authenticated by six lanes.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Twenty-four independently authenticated selections.
 */
export const promoteZeroPayloadHosted = async (original, references) => {
	const authenticated = await zeroPayloadHostedPromotionReferences();
	assert.equal(sha256(canonicalJson(references))
		, sha256(canonicalJson(authenticated)));
	const inventory = await reconcileZeroPayloadHostedPromotionPins(original);
	const promotedProfiles = new Set(zeroPayloadHostedPromotionProfiles);
	inventory.observations = original.observations.map(item => {
		if(!promotedProfiles.has(item.profiles[0])
			|| !["ordinary-source", "reviewed-ir"].includes(item.path)
			|| !item.shapes.includes("checked-record")
			|| !item.positions.some(position => ["parameter", "result"].includes(position)))
			return item;
		const stages = {};
		for(const [name, stage] of Object.entries(item.stages))
			stages[name] = { ...stage, evidence: [...stage.evidence] };
		return {
			...item, hostTypes: {
				...item.hostTypes
				, "checked-record": { ...item.hostTypes["checked-record"] }
			}
			, conversionNotes: { ...item.conversionNotes }
			, limitations: [...item.limitations], stages
		};
	});
	for(const lane of zeroPayloadHostedPromotionLanes)
	{
		const validatorFiles = [];
		for(const path of lane.validators)
			validatorFiles.push({ path, sha256: sha256(await readFile(path)) });
		for(const reference of references.filter(item => item.lane === lane.key))
		{
			assert.ok(!inventory.evidence.some(item => item.id === reference.id)
				, `Already promoted: ${reference.id}`);
			inventory.evidence.push({
				id: reference.id, kind: "installed", revision: reference.revision
				, command: reference.command, scope: reference.scope
				, files: [...validatorFiles, ...reference.files]
				, artifacts: reference.artifacts.map(item => ({
					...item, path: `${reference.id}/${item.path}`
				}))
			});
		}
	}
	let changed = 0;
	for(const lane of zeroPayloadHostedPromotionLanes)
		for(const profile of lane.profiles)
			for(const path of ["ordinary-source", "reviewed-ir"])
				for(const position of ["parameter", "result"])
				{
					const matches = inventory.observations.filter(item =>
						item.profiles.includes(profile) && item.path === path
						&& item.shapes.includes("checked-record")
						&& item.positions.includes(position));
					assert.equal(matches.length, 1
						, `Missing or overlapping cell: ${profile}/${path}/${position}`);
					const observation = matches[0];
					const selected = references.filter(item => item.lane === lane.key
						&& item.sourcePath === path && item.positions.includes(position));
					assert.equal(selected.length, position === "result" ? 2 : 1);
					const ids = selected.map(item => item.id);
					const addition = selected.map(item => item.scope).join(" ");
					observation.scope += ` Additional hosted zero-payload ${lane.label} acceptance: ${addition}`;
					observation.hostTypes["checked-record"][position]
						+= `; ${lane.hostTypes[profile][position]}`;
					observation.conversionNotes["checked-record"] += ` ${lane.conversion}`;
					observation.limitations.push(lane.limitation);
					for(const stage of Object.values(observation.stages))
					{
						assert.equal(stage.state, "passed");
						stage.evidence.push(...ids);
						assert.equal(stage.evidence.length, new Set(stage.evidence).size);
						stage.note += ` Additional hosted zero-payload ${lane.label} acceptance: ${addition}`;
					}
					changed += 1;
				}
	assert.equal(changed, 40);
	return inventory;
};
