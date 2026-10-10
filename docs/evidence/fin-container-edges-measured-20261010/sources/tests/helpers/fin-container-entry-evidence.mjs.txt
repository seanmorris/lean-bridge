/**
 * Authenticate the local installed native Fin container entry counters: every producer attempt, including the
 * failed e91543d and fd51318 JVM attempts kept with their actual failures, and the acceptances of every native
 * host on the ordinary and reviewed routes. Nothing here claims hosted acceptance, an installed-tree move or a
 * host-language raw-adapter caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";

export const containerEntryDirectory = "docs/evidence/fin-container-entry-20261009";
// Every producer applies the one reviewed root diff: e91543d on the Wasm initializer name, fd51318 on the native
// one (4021820), and 04dc924 (f737b2b plus a test-only follow-up) with its preload control kept out of GDB's own
// environment; fixDiffSha256 is that change from fd51318.
const rootDiffSha256 = "1398208d603c685a1b3dd08e95f0a9608b609010a4ac57da35e90877bcf5af3a";
const lineage = Object.freeze({
	"e91543d48c316ad3d5abd065c126838b5f0126a5": { parent: "23d5948" }
	, "fd51318cc01a8aae2b0f3fe4e6d0cf529d160001": { parent: "4021820" }
	, "04dc924f707b1ea85acb7792091fec5a0366bb25": { parent: "f737b2b", fixDiffSha256: "24cfc77b9b6137d588a157299e6c74b967e15877d9e6b417fd3a4aa348d46ab7" }
});
export const containerEntryRevisions = Object.freeze(Object.keys(lineage));
const failureReasons = Object.freeze({
	"failed-e91543d-cpp-php": "the raw C probe looked up the Wasm adapter-module initializer, so both routes refused with \"component initializer is not visible\" before any raw call"
	, "failed-fd51318-jvm": "the preloaded-copies control put the real Lean libraries into GDB's own environment, so GDB 13.1 aborted on its first internal exception while Java started on both routes; Kotlin never ran"
});
// fd51318 registered its two tests on 5466a96; main later registered others, so that source is rebuilt from main's
// history of the exact predecessor plus only these two names.
const registration = Object.freeze({
	path: "src/adoption/test-profiles.mjs"
	, predecessorSha256: "38087868aa2fbaf54695d160c84c21c1fdf294c7948deabad918f42af3398498"
	, sha256: "9dc4626bf623787591c390f6d9de8bcbe5c6ef618285663f70ab8aa53e9f763d"
	, anchor: "\t\t, \"native-fin-containers\"\n"
	, added: "\t\t, \"fin-container-entry-dispatch\"\n\t\t, \"cpp-fin-container-entry\"\n"
});
const archived = name => `${containerEntryDirectory}/${name}`;
const componentId = "fincontainers@1.0.0";
const sources = ["mirrorAll", "sumHuge", "orDefault", "present", "label"];
const columns = [...sources.map(name => `l_FinContainers_${name}`), ...sources.map(name => `lb_${sha256(`${componentId}\0FinContainers.${name}`).slice(0, 24)}`)];
const component = "libcomponent_3acdf22f1550490d7b06.so";
const componentSha256 = "9a0a98be48056cf243f74cda1d73f57f849e359f07fc6dda4e33e93a79042445";
// Probe and instrument sources as fd51318 generates them; each report must carry exactly these digests.
const digests = Object.freeze({
	cpp: "afbeffd65a4e81cc00c7b584744ae58f8ca03eff88fd406545c7a13722c89b58"
	, "php-native": "5dba33303f0a1bb49e1cbbcf8a0ad562456441f183a0bc37ff0aada220bfba6b"
	, "wit-wasi": "f98b03a1fdee7c21958487196543d7a047b4155ccbfec4fa6457967b71fb7711"
	, ruby: "a88f16ef9ced69e121c57882f90e80596963a743baa004375fae133b9d5de792"
	, dotnet: "b6794caa891100b39bdd375c6e7ed1ff15cc37e6a07a0fc869dcf23a617b8b5e"
	, java: "687c61078c6490d7bd9248ebd0ceeef814794faba014d229c1700b82440081f9"
	, kotlin: "8511403048a115e3b5529d6dbf4bb77922455ff9ca84078d5bee398ea1a2892e"
	, interposer: "5a1df2a6775b77b51066a514468ab31f7b77171cebf069720dd1ab046653f96e"
	, raw: "45980d909a6245e64762f781acb555298f5f291f258228273dae58c02edc5356"
	, strictScript: "3fb03752e58215696c3e738abbe08fa9e7253aa30f1b546ddcf88ec243781486"
	, extractedScript: "812688a768fd8d5f1ab220aca6156630f5b5e17ad2dbac0768545828b8ef7633"
});
const gdb = Object.freeze({ sha256: "762f9d48202dd341e170d8302543f35622417b4e39bfce9a270d06943702e754", version: "GNU gdb (Debian 13.1-3) 13.1" });
const trigger = "countNone([]) == 0: a public call outside the ten counted columns, after a record with nothing armed and no entries, and before a record with all ten armed and still no entries";
const rawCaller = "C raw-adapter probe of the same verified installed libraries; not a host-language call";
const preload = ["caller", "definers", "instrument", "interposerSha256", "missingInstrumentRefused", "observed", "probeSha256"];
const strict = ["breakpoints", "caller", "configSha256", "definers", "foreignRootRefused", "gdb", "instrument", "misplacedDefinersRefused", "missingInstrumentRefused", "observed", "probeSha256", "scriptSha256", "staleRecordRefused"];
const extracted = ["breakpoints", "caller", "configSha256", "definers", "gdb", "hashes", "instrument", "loadTrigger", "missingInstrumentRefused", "observed", "outsideRootRefused", "plantedParentRefused", "preloadedCopiesRefused", "probeSha256", "scriptSha256"];
const jvmCaller = language => `public ${language} calls of org.leanbridge.fincontainers.Api.mirrorAll, .sumHuge, .orDefault, .present and .label through the verified extracting RTLD_DEEPBIND JAR loader and FFM downcalls into the bundled C adapters`;
// Exact rows every host must print; generated from fin-container-entry-dispatch.mjs at fd51318.
const publicRows = Object.freeze([
	["start","ok",[0,0,0,0,0,0,0,0,0,0]]
	, ["invalid-array-first","rejected:arg0:10",[0,0,0,0,0,0,0,0,0,0]]
	, ["invalid-array-middle","rejected:arg0:10",[0,0,0,0,0,0,0,0,0,0]]
	, ["invalid-array-last","rejected:arg0:10",[0,0,0,0,0,0,0,0,0,0]]
	, ["invalid-list-wide","rejected:arg0:1180591620717411303424",[0,0,0,0,0,0,0,0,0,0]]
	, ["invalid-option-present","rejected:arg0:1",[0,0,0,0,0,0,0,0,0,0]]
	, ["invalid-nested-present","rejected:arg0:10",[0,0,0,0,0,0,0,0,0,0]]
	, ["invalid-label-late","rejected:arg1:4",[0,0,0,0,0,0,0,0,0,0]]
	, ["valid-array","ok:9,0",[1,0,0,0,0,1,0,0,0,0]]
	, ["valid-list-wide","ok:1180591620717411303424",[1,1,0,0,0,1,1,0,0,0]]
	, ["valid-option-absent","ok:7",[1,1,1,0,0,1,1,1,0,0]]
	, ["valid-option-present","ok:0",[1,1,2,0,0,1,1,2,0,0]]
	, ["valid-nested-present","ok:1,9",[1,1,2,1,0,1,1,2,1,0]]
	, ["valid-label","ok:a:1,b:3",[1,1,2,1,1,1,1,2,1,1]]
	, ["recovery-invalid-array","rejected:arg0:10",[1,1,2,1,1,1,1,2,1,1]]
	, ["recovery-invalid-list","rejected:arg0:1180591620717411303424",[1,1,2,1,1,1,1,2,1,1]]
	, ["recovery-invalid-option","rejected:arg0:1",[1,1,2,1,1,1,1,2,1,1]]
	, ["recovery-invalid-nested","rejected:arg0:10",[1,1,2,1,1,1,1,2,1,1]]
	, ["recovery-invalid-label","rejected:arg1:4",[1,1,2,1,1,1,1,2,1,1]]
	, ["recovery-valid-array","ok:",[2,1,2,1,1,2,1,2,1,1]]
	, ["recovery-valid-list","ok:0",[2,2,2,1,1,2,2,2,1,1]]
	, ["recovery-valid-option","ok:7",[2,2,3,1,1,2,2,3,1,1]]
	, ["recovery-valid-nested","ok:",[2,2,3,2,1,2,2,3,2,1]]
	, ["recovery-valid-label","ok:a:0",[2,2,3,2,2,2,2,3,2,2]]
]);
const rawRows = Object.freeze([
	["start","ok",[0,0,0,0,0,0,0,0,0,0]]
	, ["raw-invalid-mirrorAll","none",[0,0,0,0,0,1,0,0,0,0]]
	, ["raw-invalid-sumHuge","none",[0,0,0,0,0,1,1,0,0,0]]
	, ["raw-invalid-orDefault","none",[0,0,0,0,0,1,1,1,0,0]]
	, ["raw-invalid-present","none",[0,0,0,0,0,1,1,1,1,0]]
	, ["raw-invalid-label","none",[0,0,0,0,0,1,1,1,1,1]]
	, ["raw-valid-mirrorAll","some",[1,0,0,0,0,2,1,1,1,1]]
	, ["raw-valid-sumHuge","some",[1,1,0,0,0,2,2,1,1,1]]
	, ["raw-valid-orDefault","some",[1,1,1,0,0,2,2,2,1,1]]
	, ["raw-valid-present","some",[1,1,1,1,0,2,2,2,2,1]]
	, ["raw-valid-label","some",[1,1,1,1,1,2,2,2,2,2]]
]);
/** Exact identities of every producer attempt, generated from the original run directories. */
export const containerEntryAttempts = Object.freeze([
	{
		id: "failed-e91543d-cpp-php"
		, outcome: "failed"
		, revision: "e91543d48c316ad3d5abd065c126838b5f0126a5"
		, parent: "23d5948"
		, tree: "81485ab3fbadacbe1ed9e84629d3c484b2c3f876"
		, startedAt: "2026-10-09T06:18:21.505Z"
		, profiles: ["cpp", "php-native"]
		, failure: { count: 2, texts: ["component initializer is not visible"] }
		, reports: {}
		, files: {
			"queue.json": { original: "build/vo1438-container-entry-e91543d/queue.json", sha256: "35af60b6b44cbd593fa7e178704fc9741fa1fcf61fe2d4a399a9853ff923ab84" }
			, "end.json": { original: "build/vo1438-container-entry-e91543d/end.json", sha256: "324bc8cd7601dfa0c4aea337494ab28c1fe394322f6d04f3b521343a17cbb67e" }
			, "run.tap": { original: "build/vo1438-container-entry-e91543d/run.tap", sha256: "6bf628e02b018e9f7b6330a74bda34c7969ff7c7fc7a2ea0a46c1fa33d52df8c" }
			, "runner.mjs.txt": { original: "build/run-vo1438-container-entry-e91543d.mjs", sha256: "94c799ec4d77aff8b268c30d51efac7778efeffa003b6638d0cc6598127ec184" }
			, "runner-output.txt": { original: "build/vo1438-container-entry-e91543d.runner.log", sha256: "d84b09f1379aada8ff6139500586f2ca0679756bf93a59d00bcc521ae4288c24" }
		}
		, sources: {
			"tests/native-fin-containers.test.mjs": "1e5d74e43c7b74d1db9f735ee2485c9b24e1ee1a7c050a5449fdf65e9b6cd1d5"
			, "src/adoption/test-profiles.mjs": "9dc4626bf623787591c390f6d9de8bcbe5c6ef618285663f70ab8aa53e9f763d"
			, "tests/helpers/fin-container-entry-dispatch.mjs": "04299f075fd9217c63aa5538e3b8b18733862697e84b74370acbadd8979c1b9b"
			, "tests/helpers/fin-container-entry-probes.mjs": "41ecb420db1d1d76e8d8d79c70f7b0509b590334040dd985fc3ddb20cbb876b5"
			, "tests/helpers/fin-container-dispatch-gdb.mjs": "a392dc47bb0334e0896539ccbf616d4a88547de283df9c84601d7bd29d631ff7"
			, "tests/helpers/fin-container-dispatch-gdb-extracted.mjs": "dd0cd4187a5fc7e4a2e4361ba99a41f72d845e2578ddb4bd5e021d1e8ea2acb2"
			, "tests/helpers/cpp-fin-container-entry-probe.mjs": "445dcadac2d6caea4181457ad7a782732b716c0931ee5155518eda7edbbc0088"
			, "tests/fin-container-entry-dispatch.test.mjs": "97722fb158b674ba82a54f4fd56d306c36ad9d8e9d2d1117f7623ee4b6a0074e"
			, "tests/cpp-fin-container-entry.test.mjs": "e5f3cbc8fd0947dc180d20508eba86e6f9f514e76519b31702d28ce769b35dcc"
			, "tests/helpers/fin-container-install.mjs": "2024d6c6a44687293750c3ee5c25f092d689065e17beb8d535610963921c9329"
			, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
			, "tests/helpers/fin-container-dispatch.mjs": "b38adb2fb6026e8a8a6808d4a99247997d585344b6d20f7265c1639c671a09c9"
			, "tests/helpers/reviewed-fin-container-fixture.mjs": "5e4d92f9bb4ccff65fb9356cc3a6613f5102665e59dbe38b99868e4804c8a132"
			, "tests/fixtures/onboarding/native-fin-containers/FinContainers.lean": "f10a680c805bac2f8357b488c41d6f805cd394a9286e28bdcc7c356cedb014be"
			, "tests/fixtures/fin-container-consumers/cpp.cpp": "0b1b4a5454c9d7eabc7b9eb81fb6e84a43f9b561a57ed2743e46d3db56542fec"
			, "tests/fixtures/fin-container-consumers/php-native.php": "e75545085f2ca4da792ec6a9ed5a2198bef9745116bbf6840886f5749b9baac1"
			, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
			, "src/build/native-artifacts.mjs": "5fd01aa0ad402df7512b90a63a22b1cacb97ff0a06f2a44e1bd9a5089f7ffbc4"
			, "src/backends/native/runtime-broker.mjs": "1c9f030f998af5fb4d4641efad9ccb51822443fed7ad5b37635b98aac89287ed"
		}
	}
	, {
		id: "cpp-php"
		, outcome: "passed"
		, revision: "fd51318cc01a8aae2b0f3fe4e6d0cf529d160001"
		, parent: "4021820"
		, tree: "37dce6a7a5a93b6ebdd02df7e99e19439bcf58d8"
		, startedAt: "2026-10-09T06:40:39.724Z"
		, profiles: ["cpp", "php-native"]
		, reports: { "cpp-php-native.json": "ordinary-source", "reviewed-cpp-php-native.json": "reviewed-ir" }
		, files: {
			"queue.json": { original: "build/vo1438-container-entry-fd51318/queue.json", sha256: "4a7fc2292747528ea854e9635920dca63dd7c24983479345190ffe3c7bae46c7" }
			, "end.json": { original: "build/vo1438-container-entry-fd51318/end.json", sha256: "d34614b09844931523e09278a4dff73a860fcefdc7b6112a1a538bdc5c927b69" }
			, "run.tap": { original: "build/vo1438-container-entry-fd51318/run.tap", sha256: "8c1eb729259d396d3a87a34339290b63137b7d7093875a84bb153eab93837090" }
			, "cpp-php-native.json": { original: "build/vo1438-container-entry-fd51318/cpp-php-native.json", sha256: "e1b9de0a2f17d426b14140ebf55356fc2aae6dad656b91914d82b837b9991b78" }
			, "reviewed-cpp-php-native.json": { original: "build/vo1438-container-entry-fd51318/reviewed-cpp-php-native.json", sha256: "c9914a37ce4cf4294e36346ea47b49534481103e51caa7d0a7d1ed9c19543777" }
			, "runner.mjs.txt": { original: "build/run-vo1438-container-entry-fd51318.mjs", sha256: "d642a38ab273476ff70adb258ee11ef4a216bd3c9dbe1d576a170f693165d092" }
			, "runner-output.txt": { original: "build/vo1438-container-entry-fd51318.runner.log", sha256: "6e828b6a323df3706971ba3324f5b249270681912a58f6769e43879fbee270b8" }
		}
		, sources: {
			"tests/native-fin-containers.test.mjs": "1e5d74e43c7b74d1db9f735ee2485c9b24e1ee1a7c050a5449fdf65e9b6cd1d5"
			, "src/adoption/test-profiles.mjs": "9dc4626bf623787591c390f6d9de8bcbe5c6ef618285663f70ab8aa53e9f763d"
			, "tests/helpers/fin-container-entry-dispatch.mjs": "59f31125753bec3206f4cf1497c7bedb5bba4c1eb16d68e0ef18891957976c98"
			, "tests/helpers/fin-container-entry-probes.mjs": "41ecb420db1d1d76e8d8d79c70f7b0509b590334040dd985fc3ddb20cbb876b5"
			, "tests/helpers/fin-container-dispatch-gdb.mjs": "a392dc47bb0334e0896539ccbf616d4a88547de283df9c84601d7bd29d631ff7"
			, "tests/helpers/fin-container-dispatch-gdb-extracted.mjs": "dd0cd4187a5fc7e4a2e4361ba99a41f72d845e2578ddb4bd5e021d1e8ea2acb2"
			, "tests/helpers/cpp-fin-container-entry-probe.mjs": "445dcadac2d6caea4181457ad7a782732b716c0931ee5155518eda7edbbc0088"
			, "tests/fin-container-entry-dispatch.test.mjs": "d0793c60e616718b4aeefc4512371c82d45c5cdb4d69976d828d370a98632218"
			, "tests/cpp-fin-container-entry.test.mjs": "e5f3cbc8fd0947dc180d20508eba86e6f9f514e76519b31702d28ce769b35dcc"
			, "tests/helpers/fin-container-install.mjs": "2024d6c6a44687293750c3ee5c25f092d689065e17beb8d535610963921c9329"
			, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
			, "tests/helpers/fin-container-dispatch.mjs": "b38adb2fb6026e8a8a6808d4a99247997d585344b6d20f7265c1639c671a09c9"
			, "tests/helpers/reviewed-fin-container-fixture.mjs": "5e4d92f9bb4ccff65fb9356cc3a6613f5102665e59dbe38b99868e4804c8a132"
			, "tests/fixtures/onboarding/native-fin-containers/FinContainers.lean": "f10a680c805bac2f8357b488c41d6f805cd394a9286e28bdcc7c356cedb014be"
			, "tests/fixtures/fin-container-consumers/cpp.cpp": "0b1b4a5454c9d7eabc7b9eb81fb6e84a43f9b561a57ed2743e46d3db56542fec"
			, "tests/fixtures/fin-container-consumers/php-native.php": "e75545085f2ca4da792ec6a9ed5a2198bef9745116bbf6840886f5749b9baac1"
			, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
			, "src/build/native-artifacts.mjs": "5fd01aa0ad402df7512b90a63a22b1cacb97ff0a06f2a44e1bd9a5089f7ffbc4"
			, "src/backends/native/runtime-broker.mjs": "1c9f030f998af5fb4d4641efad9ccb51822443fed7ad5b37635b98aac89287ed"
		}
	}
	, {
		id: "ruby-wit"
		, outcome: "passed"
		, revision: "fd51318cc01a8aae2b0f3fe4e6d0cf529d160001"
		, parent: "4021820"
		, tree: "37dce6a7a5a93b6ebdd02df7e99e19439bcf58d8"
		, startedAt: "2026-10-09T06:54:11.783Z"
		, profiles: ["ruby", "wit-wasi"]
		, reports: { "ruby-wit-wasi.json": "ordinary-source", "reviewed-ruby-wit-wasi.json": "reviewed-ir" }
		, files: {
			"queue.json": { original: "build/vo1438-container-entry-fd51318-ruby-wit/queue.json", sha256: "9369d0a25b77d0401af2dd2a01b8fd409954fc91cf7b613e519b62db6b074ce9" }
			, "end.json": { original: "build/vo1438-container-entry-fd51318-ruby-wit/end.json", sha256: "ab6de08eadbd5124a28ec88f5d3fc5a85a0cafa1275f996dba11dc48235da7cb" }
			, "run.tap": { original: "build/vo1438-container-entry-fd51318-ruby-wit/run.tap", sha256: "aabdb606475ded6c6876113f8b62c091560bbc9f4d18964c45f5ca093a390091" }
			, "ruby-wit-wasi.json": { original: "build/vo1438-container-entry-fd51318-ruby-wit/ruby-wit-wasi.json", sha256: "1f82cd21c4bad984d1fdef5db02b7c9fd275672bf1e4c2eed85291851552b863" }
			, "reviewed-ruby-wit-wasi.json": { original: "build/vo1438-container-entry-fd51318-ruby-wit/reviewed-ruby-wit-wasi.json", sha256: "335d17966bd9509268e45cc00f3b44b353aed5600cb9a52daa355986f1ac271b" }
			, "runner.mjs.txt": { original: "build/run-vo1438-container-entry-fd51318-ruby-wit.mjs", sha256: "fc0c54535a9e814aa000d359e3e61b2f441641b48362be1855b49160284a7fc3" }
			, "runner-output.txt": { original: "build/vo1438-container-entry-fd51318-ruby-wit.runner.log", sha256: "85839e9f112f6544babbbf8e10cab750ab759f2e13077d51c75db260c6639a71" }
		}
		, sources: {
			"tests/native-fin-containers.test.mjs": "1e5d74e43c7b74d1db9f735ee2485c9b24e1ee1a7c050a5449fdf65e9b6cd1d5"
			, "src/adoption/test-profiles.mjs": "9dc4626bf623787591c390f6d9de8bcbe5c6ef618285663f70ab8aa53e9f763d"
			, "tests/helpers/fin-container-entry-dispatch.mjs": "59f31125753bec3206f4cf1497c7bedb5bba4c1eb16d68e0ef18891957976c98"
			, "tests/helpers/fin-container-entry-probes.mjs": "41ecb420db1d1d76e8d8d79c70f7b0509b590334040dd985fc3ddb20cbb876b5"
			, "tests/helpers/fin-container-dispatch-gdb.mjs": "a392dc47bb0334e0896539ccbf616d4a88547de283df9c84601d7bd29d631ff7"
			, "tests/helpers/fin-container-dispatch-gdb-extracted.mjs": "dd0cd4187a5fc7e4a2e4361ba99a41f72d845e2578ddb4bd5e021d1e8ea2acb2"
			, "tests/helpers/cpp-fin-container-entry-probe.mjs": "445dcadac2d6caea4181457ad7a782732b716c0931ee5155518eda7edbbc0088"
			, "tests/fin-container-entry-dispatch.test.mjs": "d0793c60e616718b4aeefc4512371c82d45c5cdb4d69976d828d370a98632218"
			, "tests/cpp-fin-container-entry.test.mjs": "e5f3cbc8fd0947dc180d20508eba86e6f9f514e76519b31702d28ce769b35dcc"
			, "tests/helpers/fin-container-install.mjs": "2024d6c6a44687293750c3ee5c25f092d689065e17beb8d535610963921c9329"
			, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
			, "tests/helpers/fin-container-dispatch.mjs": "b38adb2fb6026e8a8a6808d4a99247997d585344b6d20f7265c1639c671a09c9"
			, "tests/helpers/reviewed-fin-container-fixture.mjs": "5e4d92f9bb4ccff65fb9356cc3a6613f5102665e59dbe38b99868e4804c8a132"
			, "tests/fixtures/onboarding/native-fin-containers/FinContainers.lean": "f10a680c805bac2f8357b488c41d6f805cd394a9286e28bdcc7c356cedb014be"
			, "tests/fixtures/fin-container-consumers/cpp.cpp": "0b1b4a5454c9d7eabc7b9eb81fb6e84a43f9b561a57ed2743e46d3db56542fec"
			, "tests/fixtures/fin-container-consumers/php-native.php": "e75545085f2ca4da792ec6a9ed5a2198bef9745116bbf6840886f5749b9baac1"
			, "tests/fixtures/fin-container-consumers/ruby.rb": "839d25393174940365c5a6b4c88f744e8ab5b876bbb955cb4eaa4f83dd500343"
			, "tests/fixtures/fin-container-consumers/wit-wasi.c": "428e25d329d19a847e9a195226f0b7dd9775c658a128255bf18c1af371e7d9d6"
			, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
			, "src/build/native-artifacts.mjs": "5fd01aa0ad402df7512b90a63a22b1cacb97ff0a06f2a44e1bd9a5089f7ffbc4"
			, "src/backends/native/runtime-broker.mjs": "1c9f030f998af5fb4d4641efad9ccb51822443fed7ad5b37635b98aac89287ed"
		}
	}
	, {
		id: "dotnet"
		, outcome: "passed"
		, revision: "fd51318cc01a8aae2b0f3fe4e6d0cf529d160001"
		, parent: "4021820"
		, tree: "37dce6a7a5a93b6ebdd02df7e99e19439bcf58d8"
		, startedAt: "2026-10-09T07:06:04.269Z"
		, profiles: ["dotnet"]
		, reports: { "dotnet.json": "ordinary-source", "reviewed-dotnet.json": "reviewed-ir" }
		, files: {
			"queue.json": { original: "build/vo1438-container-entry-fd51318-dotnet/queue.json", sha256: "63f44a6f39c5d86977aa973abcbe3a4601d83710b651921804b64d8caf1d7e6a" }
			, "end.json": { original: "build/vo1438-container-entry-fd51318-dotnet/end.json", sha256: "7aa1e31f3569ee046b151d6ae1240708e3bf1ac313a2011d151b1fd32962bed1" }
			, "run.tap": { original: "build/vo1438-container-entry-fd51318-dotnet/run.tap", sha256: "cbbe92f3d74a2a68753937718db9135c30c11531e1943acaf05201902b0ca820" }
			, "dotnet.json": { original: "build/vo1438-container-entry-fd51318-dotnet/dotnet.json", sha256: "b8021203060d87586ebfb85beb072a8a63b1a88fa402e126f906d915c71db42f" }
			, "reviewed-dotnet.json": { original: "build/vo1438-container-entry-fd51318-dotnet/reviewed-dotnet.json", sha256: "2a87d5764e9e1338ff347296e9a331b583c00c2835ab01a0d6e3b9b4432b3adb" }
			, "runner.mjs.txt": { original: "build/run-vo1438-container-entry-fd51318-dotnet.mjs", sha256: "161320e615b523380d1bd6c28f12606ed41ccc5205b575b7e8f5e1653d22d9c7" }
			, "runner-output.txt": { original: "build/vo1438-container-entry-fd51318-dotnet.runner.log", sha256: "87e9919b8052a8b36f79d1f20a4c3b0fd948dfff32709bf2b25fc66a98699f43" }
		}
		, sources: {
			"tests/native-fin-containers.test.mjs": "1e5d74e43c7b74d1db9f735ee2485c9b24e1ee1a7c050a5449fdf65e9b6cd1d5"
			, "src/adoption/test-profiles.mjs": "9dc4626bf623787591c390f6d9de8bcbe5c6ef618285663f70ab8aa53e9f763d"
			, "tests/helpers/fin-container-entry-dispatch.mjs": "59f31125753bec3206f4cf1497c7bedb5bba4c1eb16d68e0ef18891957976c98"
			, "tests/helpers/fin-container-entry-probes.mjs": "41ecb420db1d1d76e8d8d79c70f7b0509b590334040dd985fc3ddb20cbb876b5"
			, "tests/helpers/fin-container-dispatch-gdb.mjs": "a392dc47bb0334e0896539ccbf616d4a88547de283df9c84601d7bd29d631ff7"
			, "tests/helpers/fin-container-dispatch-gdb-extracted.mjs": "dd0cd4187a5fc7e4a2e4361ba99a41f72d845e2578ddb4bd5e021d1e8ea2acb2"
			, "tests/helpers/cpp-fin-container-entry-probe.mjs": "445dcadac2d6caea4181457ad7a782732b716c0931ee5155518eda7edbbc0088"
			, "tests/fin-container-entry-dispatch.test.mjs": "d0793c60e616718b4aeefc4512371c82d45c5cdb4d69976d828d370a98632218"
			, "tests/cpp-fin-container-entry.test.mjs": "e5f3cbc8fd0947dc180d20508eba86e6f9f514e76519b31702d28ce769b35dcc"
			, "tests/helpers/fin-container-install.mjs": "2024d6c6a44687293750c3ee5c25f092d689065e17beb8d535610963921c9329"
			, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
			, "tests/helpers/fin-container-dispatch.mjs": "b38adb2fb6026e8a8a6808d4a99247997d585344b6d20f7265c1639c671a09c9"
			, "tests/helpers/reviewed-fin-container-fixture.mjs": "5e4d92f9bb4ccff65fb9356cc3a6613f5102665e59dbe38b99868e4804c8a132"
			, "tests/fixtures/onboarding/native-fin-containers/FinContainers.lean": "f10a680c805bac2f8357b488c41d6f805cd394a9286e28bdcc7c356cedb014be"
			, "tests/fixtures/fin-container-consumers/cpp.cpp": "0b1b4a5454c9d7eabc7b9eb81fb6e84a43f9b561a57ed2743e46d3db56542fec"
			, "tests/fixtures/fin-container-consumers/php-native.php": "e75545085f2ca4da792ec6a9ed5a2198bef9745116bbf6840886f5749b9baac1"
			, "tests/fixtures/fin-container-consumers/dotnet.cs": "9a8d0ccd0113f647fa80bd126a3c14ff15cf1600a29ffba395fda342641ec07a"
			, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
			, "src/build/native-artifacts.mjs": "5fd01aa0ad402df7512b90a63a22b1cacb97ff0a06f2a44e1bd9a5089f7ffbc4"
			, "src/backends/native/runtime-broker.mjs": "1c9f030f998af5fb4d4641efad9ccb51822443fed7ad5b37635b98aac89287ed"
		}
	}
	, {
		id: "failed-fd51318-jvm"
		, outcome: "failed"
		, revision: "fd51318cc01a8aae2b0f3fe4e6d0cf529d160001"
		, parent: "4021820"
		, tree: "37dce6a7a5a93b6ebdd02df7e99e19439bcf58d8"
		, startedAt: "2026-10-09T07:16:42.479Z"
		, profiles: ["java", "kotlin"]
		, failure: { count: 2, texts: ["/usr/bin/gdb exited with status null","terminate called after throwing an instance of 'gdb_exception_error'"] }
		, reports: {}
		, files: {
			"queue.json": { original: "build/vo1438-container-entry-fd51318-jvm/queue.json", sha256: "5a4a39decf4921fbbbf89e39b0d5b8c41d2292252d41551db4ce24b01c8512f2" }
			, "end.json": { original: "build/vo1438-container-entry-fd51318-jvm/end.json", sha256: "7f440e983dfa45a5b97a6cfb61b497051890880e9d9aadb20d7316dce29ede89" }
			, "run.tap": { original: "build/vo1438-container-entry-fd51318-jvm/run.tap", sha256: "c9c223f6255676b08f5162912b4758eb4a91aa14392387d160edc4dce1785717" }
			, "runner.mjs.txt": { original: "build/run-vo1438-container-entry-fd51318-jvm.mjs", sha256: "cd225293120544a739e23ded8ccd8ad196ad2806c0437ad8edba18db260e8d69" }
			, "runner-output.txt": { original: "build/vo1438-container-entry-fd51318-jvm.runner.log", sha256: "458034ec9a196d78d6a5bf97c1af6a805072e771d1da767663cf368f966e4e38" }
			, "reproducer/SHA256SUMS": { original: "build/vo1438-jvm-gdb-preload-repro/SHA256SUMS", sha256: "8a7ee27668fd59bac20c9d8ed63054566fa6ccf2578ebdcf2fb2a48ff0942db7" }
			, "reproducer/commands.txt": { original: "build/vo1438-jvm-gdb-preload-repro/commands.txt", sha256: "006e3834328c17aef78241e06822f0922eff1fa00c3edb5d7e1620d326c3670e" }
			, "reproducer/iex.txt": { original: "build/vo1438-jvm-gdb-preload-repro/iex.txt", sha256: "a65c02b6986d3b1086880627f7c1ec3d0f80bd983aa81bab34bc250967d25ddb" }
			, "reproducer/log1.txt": { original: "build/vo1438-jvm-gdb-preload-repro/log1.txt", sha256: "d6a160f96c1bef0b4ba184217834bd7f5f15c29378d7c3e4288b5533aa0bbcba" }
			, "reproducer/log2.txt": { original: "build/vo1438-jvm-gdb-preload-repro/log2.txt", sha256: "8ca39b57d8119bbffe97147396694c29b314da11d2d460064a630e051a851608" }
			, "reproducer/log3.txt": { original: "build/vo1438-jvm-gdb-preload-repro/log3.txt", sha256: "3163670d59350c1a7fc3bc23235a72b900b0fc654742f2ba78d577db292daeb1" }
			, "reproducer/pre.txt": { original: "build/vo1438-jvm-gdb-preload-repro/pre.txt", sha256: "a6f9f4d1646ab90388e799971f3cbd7004e71c389234a2d9f2f874e8684cd68b" }
			, "reproducer/r.py": { original: "build/vo1438-jvm-gdb-preload-repro/r.py", sha256: "6a03ddac2b71b2634d5616a2bc9b58d3dbe93ebf3e21433a8c7318b102604aa2" }
			, "reproducer/r2.py": { original: "build/vo1438-jvm-gdb-preload-repro/r2.py", sha256: "655bad20acfbb4dd63c4a071fbb018f722f315050d933158de05fcd6ecccd927" }
			, "reproducer/t.py": { original: "build/vo1438-jvm-gdb-preload-repro/t.py", sha256: "19a66ba222fbeb14595c35e778dc9eaec79d1595d9d5a58bc7a352238bcf7d70" }
			, "reproducer/t1.txt": { original: "build/vo1438-jvm-gdb-preload-repro/t1.txt", sha256: "838821aabf84d421f1e2481436a222bd66de57f30b6a7d3ebf044950431bf534" }
			, "reproducer/t2.txt": { original: "build/vo1438-jvm-gdb-preload-repro/t2.txt", sha256: "5f15b0658cdc02987d09b45c9eacd1eae6134ddd5d406576d6320ff766b7a339" }
			, "reproducer/tools.txt": { original: "build/vo1438-jvm-gdb-preload-repro/tools.txt", sha256: "cdbfb64160b639a6f9464e6ac727a4eb5003efdbbd068fd71e4366f6c99e2511" }
		}
		, sources: {
			"tests/native-fin-containers.test.mjs": "1e5d74e43c7b74d1db9f735ee2485c9b24e1ee1a7c050a5449fdf65e9b6cd1d5"
			, "src/adoption/test-profiles.mjs": "9dc4626bf623787591c390f6d9de8bcbe5c6ef618285663f70ab8aa53e9f763d"
			, "tests/helpers/fin-container-entry-dispatch.mjs": "59f31125753bec3206f4cf1497c7bedb5bba4c1eb16d68e0ef18891957976c98"
			, "tests/helpers/fin-container-entry-probes.mjs": "41ecb420db1d1d76e8d8d79c70f7b0509b590334040dd985fc3ddb20cbb876b5"
			, "tests/helpers/fin-container-dispatch-gdb.mjs": "a392dc47bb0334e0896539ccbf616d4a88547de283df9c84601d7bd29d631ff7"
			, "tests/helpers/fin-container-dispatch-gdb-extracted.mjs": "dd0cd4187a5fc7e4a2e4361ba99a41f72d845e2578ddb4bd5e021d1e8ea2acb2"
			, "tests/helpers/cpp-fin-container-entry-probe.mjs": "445dcadac2d6caea4181457ad7a782732b716c0931ee5155518eda7edbbc0088"
			, "tests/fin-container-entry-dispatch.test.mjs": "d0793c60e616718b4aeefc4512371c82d45c5cdb4d69976d828d370a98632218"
			, "tests/cpp-fin-container-entry.test.mjs": "e5f3cbc8fd0947dc180d20508eba86e6f9f514e76519b31702d28ce769b35dcc"
			, "tests/helpers/fin-container-install.mjs": "2024d6c6a44687293750c3ee5c25f092d689065e17beb8d535610963921c9329"
			, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
			, "tests/helpers/fin-container-dispatch.mjs": "b38adb2fb6026e8a8a6808d4a99247997d585344b6d20f7265c1639c671a09c9"
			, "tests/helpers/reviewed-fin-container-fixture.mjs": "5e4d92f9bb4ccff65fb9356cc3a6613f5102665e59dbe38b99868e4804c8a132"
			, "tests/fixtures/onboarding/native-fin-containers/FinContainers.lean": "f10a680c805bac2f8357b488c41d6f805cd394a9286e28bdcc7c356cedb014be"
			, "tests/fixtures/fin-container-consumers/cpp.cpp": "0b1b4a5454c9d7eabc7b9eb81fb6e84a43f9b561a57ed2743e46d3db56542fec"
			, "tests/fixtures/fin-container-consumers/php-native.php": "e75545085f2ca4da792ec6a9ed5a2198bef9745116bbf6840886f5749b9baac1"
			, "tests/fixtures/fin-container-consumers/java.java": "6c567c87f866dc91c714bcae35fbbbfeaed65f34530e62c456f872b7d752eefa"
			, "tests/fixtures/fin-container-consumers/kotlin.kt": "c32f3cc353d4225e7ccf2c39c07a77c06ab1b59d939aded1b4864e16bfa1a7a7"
			, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
			, "src/build/native-artifacts.mjs": "5fd01aa0ad402df7512b90a63a22b1cacb97ff0a06f2a44e1bd9a5089f7ffbc4"
			, "src/backends/native/runtime-broker.mjs": "1c9f030f998af5fb4d4641efad9ccb51822443fed7ad5b37635b98aac89287ed"
		}
	}
	, {
		id: "jvm"
		, outcome: "passed"
		, revision: "04dc924f707b1ea85acb7792091fec5a0366bb25"
		, parent: "f737b2b"
		, tree: "9ca17bad4f326c6124e9bc313f5519d78b1ec6ad"
		, startedAt: "2026-10-09T07:30:30.561Z"
		, profiles: ["java", "kotlin"]
		, reports: { "java-kotlin.json": "ordinary-source", "reviewed-java-kotlin.json": "reviewed-ir" }
		, files: {
			"queue.json": { original: "build/vo1438-container-entry-04dc924-jvm/queue.json", sha256: "2d1e091196f7b090915deb9268312f4d45a02e705f63bd33dad41819c3b0c8c0" }
			, "end.json": { original: "build/vo1438-container-entry-04dc924-jvm/end.json", sha256: "b904fa3181496640ea6dddebacfff95e5310d414362baef57bb76831bf1110c2" }
			, "run.tap": { original: "build/vo1438-container-entry-04dc924-jvm/run.tap", sha256: "bd0ffa3c56cb4cd4047c643931b04e3cee1cc04565d20680a680117fc528df63" }
			, "java-kotlin.json": { original: "build/vo1438-container-entry-04dc924-jvm/java-kotlin.json", sha256: "825b64306fc32e824c2f7b4522e3584d976d99ac3f60e176374aac35412056bf" }
			, "reviewed-java-kotlin.json": { original: "build/vo1438-container-entry-04dc924-jvm/reviewed-java-kotlin.json", sha256: "b6025142401056d0ceceb488649eeca417f4ac31b1ca1f7f233ef72a7e054793" }
			, "runner.mjs.txt": { original: "build/run-vo1438-container-entry-04dc924-jvm.mjs", sha256: "e835b9de93840a3913e0d213fbc1eb63e60fd2d1ced781bc57bee14c207f10b3" }
			, "runner-output.txt": { original: "build/vo1438-container-entry-04dc924-jvm.runner.log", sha256: "e5bf4abc5a82b72a259d1a5e0f6a726efd5f9903609f3cc4ec4fcaa59c5c2de8" }
		}
		, sources: {
			"tests/native-fin-containers.test.mjs": "1e5d74e43c7b74d1db9f735ee2485c9b24e1ee1a7c050a5449fdf65e9b6cd1d5"
			, "src/adoption/test-profiles.mjs": "9dc4626bf623787591c390f6d9de8bcbe5c6ef618285663f70ab8aa53e9f763d"
			, "tests/helpers/fin-container-entry-dispatch.mjs": "59f31125753bec3206f4cf1497c7bedb5bba4c1eb16d68e0ef18891957976c98"
			, "tests/helpers/fin-container-entry-probes.mjs": "41ecb420db1d1d76e8d8d79c70f7b0509b590334040dd985fc3ddb20cbb876b5"
			, "tests/helpers/fin-container-dispatch-gdb.mjs": "a392dc47bb0334e0896539ccbf616d4a88547de283df9c84601d7bd29d631ff7"
			, "tests/helpers/fin-container-dispatch-gdb-extracted.mjs": "1374c778c8ba45ab7076a6cfa3c4ce885b1154b66ddd34e1808c1de11d0b174c"
			, "tests/helpers/cpp-fin-container-entry-probe.mjs": "445dcadac2d6caea4181457ad7a782732b716c0931ee5155518eda7edbbc0088"
			, "tests/fin-container-entry-dispatch.test.mjs": "872066bd5e9cb48e92c14ea60797c4cf03cf214f6635fb1462d4d402957d3faa"
			, "tests/cpp-fin-container-entry.test.mjs": "e5f3cbc8fd0947dc180d20508eba86e6f9f514e76519b31702d28ce769b35dcc"
			, "tests/helpers/fin-container-install.mjs": "2024d6c6a44687293750c3ee5c25f092d689065e17beb8d535610963921c9329"
			, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
			, "tests/helpers/fin-container-dispatch.mjs": "b38adb2fb6026e8a8a6808d4a99247997d585344b6d20f7265c1639c671a09c9"
			, "tests/helpers/reviewed-fin-container-fixture.mjs": "5e4d92f9bb4ccff65fb9356cc3a6613f5102665e59dbe38b99868e4804c8a132"
			, "tests/fixtures/onboarding/native-fin-containers/FinContainers.lean": "f10a680c805bac2f8357b488c41d6f805cd394a9286e28bdcc7c356cedb014be"
			, "tests/fixtures/fin-container-consumers/cpp.cpp": "0b1b4a5454c9d7eabc7b9eb81fb6e84a43f9b561a57ed2743e46d3db56542fec"
			, "tests/fixtures/fin-container-consumers/php-native.php": "e75545085f2ca4da792ec6a9ed5a2198bef9745116bbf6840886f5749b9baac1"
			, "tests/fixtures/fin-container-consumers/java.java": "6c567c87f866dc91c714bcae35fbbbfeaed65f34530e62c456f872b7d752eefa"
			, "tests/fixtures/fin-container-consumers/kotlin.kt": "c32f3cc353d4225e7ccf2c39c07a77c06ab1b59d939aded1b4864e16bfa1a7a7"
			, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
			, "src/build/native-artifacts.mjs": "5fd01aa0ad402df7512b90a63a22b1cacb97ff0a06f2a44e1bd9a5089f7ffbc4"
			, "src/backends/native/runtime-broker.mjs": "1c9f030f998af5fb4d4641efad9ccb51822443fed7ad5b37635b98aac89287ed"
		}
	}
]);
/** Each host's instrument, public identity fields, consumer check count and exact public caller. */
export const containerEntryHosts = Object.freeze({
	cpp: {
		instrument: "LD_PRELOAD"
		, keys: [...preload, "executableSha256", "packageReceiptSha256", "parameterNames", "repeatedColdProcess"]
		, checks: 2039
		, libraries: "files"
		, caller: "public C++ calls of lean_bridge::fincontainers mirror_all, sum_huge, or_default, present and label through fincontainers.hpp, the public C ABI and the checked runtime into the bundled C adapters"
	}
	, "php-native": {
		instrument: "LD_PRELOAD"
		, keys: preload
		, checks: 2026
		, libraries: "sha256"
		, caller: "public PHP functions LeanFincontainers\\mirror_all, sum_huge, or_default, present and label through Composer autoload and PHP FFI into the bundled C adapters"
	}
	, "wit-wasi": {
		instrument: "LD_PRELOAD"
		, keys: preload
		, checks: 2033
		, libraries: "sha256"
		, caller: "public WIT exports mirror-all, sum-huge, or-default, present and label through the installed fincontainers_wasmtime_call host API, the embedded Wasmtime component and its host imports into the bundled C adapters"
	}
	, ruby: {
		instrument: "gdb-breakpoints"
		, keys: strict
		, checks: 2025
		, libraries: "sha256"
		, caller: "public Ruby methods LeanBridge::Fincontainers.mirror_all, .sum_huge, .or_default, .present and .label through the verified RTLD_DEEPBIND gem loader and Fiddle into the bundled C adapters"
	}
	, dotnet: {
		instrument: "gdb-breakpoints"
		, keys: [...strict, "loadTrigger"]
		, checks: 2026
		, libraries: "sha256"
		, caller: "public .NET methods LeanBridge.Fincontainers.Api.MirrorAll, .SumHuge, .OrDefault, .Present and .Label through the verified RTLD_DEEPBIND NuGet loader and DllImport into the bundled C adapters"
	}
	, java: {
		instrument: "gdb-breakpoints-extracted-root"
		, keys: extracted
		, checks: 2026
		, libraries: "sha256"
		, caller: jvmCaller("Java")
	}
	, kotlin: {
		instrument: "gdb-breakpoints-extracted-root"
		, keys: extracted
		, checks: 2025
		, libraries: "sha256"
		, caller: jvmCaller("Kotlin")
	}
});
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const itemKeys = ["bindingIrSha256", "checks", "compilerFreePath", "consumerSha256", "dispatch", "modelSha256", "offlineInstall", "packages", "path", "profile", "receiptSha256", "refinements", "sourceRemovedBeforeInstallation", "sourceTreeSha256"];

/**
 * One host section of one report, against its instrument, the shared rows and the shared component bytes.
 *
 * @param item - One report entry.
 * @param route - Route: ordinary-source or reviewed-ir.
 */
export const assertContainerEntryItem = (item, route) => {
	const host = containerEntryHosts[item.profile];
	assert.ok(host, `unknown host ${item.profile}`);
	assert.deepEqual(Object.keys(item).sort(), [...itemKeys, ...route === "reviewed-ir" ? ["reviewedSourceSha256"] : []].sort());
	assert.deepEqual([item.path, item.checks], [route, host.checks]);
	// Source removal, offline and compiler-free installation only: these reports never move the installed tree.
	for(const flag of ["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation"]) assert.equal(item[flag], true, flag);
	for(const field of ["bindingIrSha256", "consumerSha256", "modelSha256", "receiptSha256", "sourceTreeSha256", ...route === "reviewed-ir" ? ["reviewedSourceSha256"] : []]) hash(item[field]);
	const dispatch = item.dispatch;
	assert.deepEqual(Object.keys(dispatch).sort(), ["columns", "componentId", "kind", "libraries", "measuredEntrypoints", "public", "rawAdapter"]);
	assert.deepEqual([dispatch.kind, dispatch.componentId], ["fin-container-entry-v1", componentId]);
	assert.deepEqual(dispatch.columns, columns);
	assert.deepEqual(dispatch.measuredEntrypoints, sources.map(name => `FinContainers.${name}`));
	// Every host loaded the one compiled component whose adapters and sources are counted.
	const libraries = dispatch.libraries;
	const names = host.libraries === "files" ? Object.keys(libraries.files).map(path => path.replace(/^lib\//u, "")) : Object.keys(libraries.sha256);
	assert.deepEqual(Object.keys(libraries).sort(), host.libraries === "files" ? ["directory", "files"] : ["directory", "handoff", "sha256"]);
	assert.equal(host.libraries === "files" ? libraries.files[`lib/${component}`].sha256 : libraries.sha256[component], componentSha256);
	const { public: observed, rawAdapter: raw } = dispatch;
	assert.deepEqual(Object.keys(observed).sort(), [...host.keys].sort());
	assert.deepEqual([observed.caller, observed.instrument, observed.probeSha256], [host.caller, host.instrument, digests[item.profile]]);
	assert.deepEqual(observed.observed, publicRows);
	assert.equal(observed.missingInstrumentRefused, true);
	assert.deepEqual(observed.definers, Array(10).fill(component));
	assert.ok(names.includes(component));
	if(host.instrument === "LD_PRELOAD") assert.equal(observed.interposerSha256, digests.interposer);
	else
	{
		assert.deepEqual(observed.gdb, gdb); hash(observed.configSha256);
		assert.equal(observed.scriptSha256, host.instrument === "gdb-breakpoints" ? digests.strictScript : digests.extractedScript);
		assert.deepEqual(observed.breakpoints.map(item => [item.symbol, item.library]), columns.map(symbol => [symbol, component]));
		for(const point of observed.breakpoints) assert.match(point.offset, /^0x[0-9a-f]+$/u);
		const refusals = host.instrument === "gdb-breakpoints" ? ["staleRecordRefused", "foreignRootRefused", "misplacedDefinersRefused"] : ["plantedParentRefused", "outsideRootRefused", "preloadedCopiesRefused"];
		for(const flag of refusals) assert.equal(observed[flag], true, flag);
		if(host.keys.includes("loadTrigger")) assert.equal(observed.loadTrigger, trigger);
		if(host.instrument === "gdb-breakpoints-extracted-root") assert.equal(observed.hashes[component], componentSha256);
	}
	if(item.profile === "cpp")
	{
		hash(observed.executableSha256); hash(observed.packageReceiptSha256);
		assert.equal(observed.repeatedColdProcess, true);
		assert.deepEqual(observed.parameterNames, { label: ["arg0", "arg1"], mirrorAll: ["arg0"], orDefault: ["arg0"], present: ["arg0"], sumHuge: ["arg0"] });
	}
	assert.deepEqual(Object.keys(raw).sort(), [...preload].sort());
	assert.deepEqual([raw.caller, raw.instrument, raw.probeSha256, raw.interposerSha256, raw.missingInstrumentRefused], [rawCaller, "LD_PRELOAD", digests.raw, digests.interposer, true]);
	assert.deepEqual(raw.observed, rawRows);
	assert.deepEqual(raw.definers, Array(10).fill(component));
};

/**
 * One installed report of one attempt and route.
 *
 * @param data - Parsed report.
 * @param profiles - Hosts the attempt selected, in report order.
 * @param route - Route of this report.
 */
export const assertContainerEntryReport = (data, profiles, route) => {
	assert.deepEqual(Object.keys(data).sort(), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.deepEqual([data.schemaVersion, data.reproducible], [1, true]);
	assert.deepEqual(data.reports.map(item => item.profile), profiles);
	for(const item of data.reports)
	{
		assertContainerEntryItem(item, route);
		for(const pkg of item.packages) for(const artifact of pkg.artifacts) assert.equal(data.archives[artifact.path], artifact.sha256);
	}
};

const pattern = "^(relocated source-free native packages check Fin inside arrays, lists and options|independently reviewed native packages check container and alias Fin bounds after source-free installation)$";
const ordinaryTest = "relocated source-free native packages check Fin inside arrays, lists and options";
const reviewedTest = "independently reviewed native packages check container and alias Fin bounds after source-free installation";

/**
 * One attempt's queue, end record, transcript and reports, independently of artifact hashes.
 *
 * @param attempt - Pinned attempt identity.
 * @param records - Parsed originals of that attempt.
 */
export const assertContainerEntryAttempt = (attempt, records) => {
	const { queue, end, tap, reports } = records;
	assert.deepEqual(Object.keys(reports).sort(), Object.keys(attempt.reports).sort(), "exactly the attempt's own reports");
	assert.deepEqual([queue.revision, queue.tree, queue.startedAt], [attempt.revision, attempt.tree, attempt.startedAt]);
	const line = lineage[queue.revision];
	assert.ok(line, `unknown producer revision ${queue.revision}`);
	assert.deepEqual([queue.parent, attempt.parent, queue.rootDiffSha256, queue.fixDiffSha256], [line.parent, line.parent, rootDiffSha256, line.fixDiffSha256]);
	if("gdb" in queue) assert.deepEqual([queue.gdb, queue.gdbSha256], [gdb.version, gdb.sha256]);
	assert.deepEqual(queue.sources, attempt.sources);
	assert.equal(queue.runnerSha256, attempt.files["runner.mjs.txt"].sha256);
	assert.deepEqual(queue.command, ["/usr/bin/taskset", "-c", "3", "/usr/bin/node", "--test", "--test-concurrency=1", "--test-reporter=tap", `--test-name-pattern=${pattern}`, "tests/native-fin-containers.test.mjs"]);
	const env = queue.environment, selected = attempt.profiles.join(",");
	assert.deepEqual([env.NO_COLOR, env.LEAN_BRIDGE_FIN_CONTAINER_ENTRY_COUNTERS, env.LEAN_BRIDGE_FIN_CONTAINER_PROFILES, env.LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES], ["1", "1", selected, selected]);
	assert.deepEqual([env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, env.LEAN_NUM_THREADS, env.OMP_NUM_THREADS, env.MAKEFLAGS], ["2.36", "1", "1", "-j1"]);
	assert.equal(env.LEAN_BRIDGE_LEAN_PREFIX, "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	assert.deepEqual(queue.unset, ["FORCE_COLOR", "other LEAN_BRIDGE_* variables"]);
	assert.deepEqual([queue.node, queue.glibc, queue.stopFloorMiB], ["v22.23.3", "glibc 2.36", 1024]);
	assert.equal(queue.lean, "Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)");
	assert.match(queue.scope, /not hosted release-floor acceptance$/u);
	assert.ok(queue.freeMiB >= 2048, "the start gate held");
	assert.deepEqual(Object.keys(end).sort(), ["code", "endedAt", "minimumFreeMiB", "signal", "stoppedForDisk", "tapSha256"]);
	assert.deepEqual([end.signal, end.stoppedForDisk, end.tapSha256], [null, false, sha256(tap)]);
	assert.ok(end.minimumFreeMiB >= 1024 && Date.parse(end.endedAt) > Date.parse(queue.startedAt));
	const lines = tap.split("\n");
	for(const [label, count] of Object.entries({ tests: 2, cancelled: 0, skipped: 0, todo: 0 })) assert.ok(lines.includes(`# ${label} ${count}`), label);
	assert.equal(attempt.outcome === "failed", Object.hasOwn(failureReasons, attempt.id));
	if(attempt.outcome === "failed")
	{
		// Kept as it failed: both routes stop with the attempt's own pinned failure, and no report exists.
		assert.equal(end.code, 1);
		assert.ok(lines.includes("# pass 0") && lines.includes("# fail 2"));
		assert.ok(lines.includes(`not ok 1 - ${ordinaryTest}`) && lines.includes(`not ok 2 - ${reviewedTest}`));
		assert.deepEqual(Object.keys(attempt.failure).sort(), ["count", "texts"]);
		for(const text of attempt.failure.texts) assert.equal(tap.split(text).length - 1, attempt.failure.count, text);
		assert.deepEqual(Object.keys(attempt.reports), []);
		return;
	}
	assert.equal(attempt.failure, undefined);
	assert.equal(end.code, 0);
	assert.ok(lines.includes("# pass 2") && lines.includes("# fail 0"));
	assert.ok(lines.includes(`ok 1 - ${ordinaryTest}`) && lines.includes(`ok 2 - ${reviewedTest}`));
	assert.doesNotMatch(tap, /^\s*not ok /mu);
	assert.deepEqual(Object.values(attempt.reports).sort(), ["ordinary-source", "reviewed-ir"]);
	for(const [name, route] of Object.entries(attempt.reports))
	{
		assert.equal((route === "reviewed-ir" ? env.LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_REPORT : env.LEAN_BRIDGE_FIN_CONTAINER_REPORT).split("/").at(-1), name);
		assertContainerEntryReport(reports[name], attempt.profiles, route);
	}
};

/**
 * Archive path of one exact producer source.
 *
 * @param revision - Producer revision.
 * @param path - Repository-relative source identity.
 */
export const containerEntrySnapshot = (revision, path) => archived(`sources/${revision.slice(0, 7)}/${path}.txt`);
const collectSources = () => {
	const all = new Map();
	for(const attempt of containerEntryAttempts) for(const [path, digest] of Object.entries(attempt.sources))
	{
		const key = `${attempt.revision}\0${path}`;
		assert.ok(!all.has(key) || all.get(key).sha256 === digest, `${path} differs within ${attempt.revision}`);
		all.set(key, { revision: attempt.revision, path, sha256: digest });
	}
	return [...all.values()].sort((a, b) => `${a.revision}${a.path}`.localeCompare(`${b.revision}${b.path}`));
};
/** Distinct producer sources by revision, in archive order. */
export const containerEntrySources = Object.freeze(collectSources());
export const containerEntryPaths = Object.freeze([
	...containerEntryAttempts.flatMap(attempt => Object.keys(attempt.files).map(name => archived(`${attempt.id}/${name}`)))
	, ...containerEntrySources.map(source => containerEntrySnapshot(source.revision, source.path))
]);

const reproducerLogs = ["log1.txt", "log2.txt", "log3.txt", "iex.txt", "t1.txt", "t2.txt"];
/**
 * The root-cause reproduction kept with the failed JVM attempt: plain Java and an inferior-only Lean preload exit
 * normally under the pinned GDB, while the same preload in GDB's own environment aborts it.
 *
 * @param texts - Reproducer file name to its archived text.
 */
export const assertContainerEntryReproducer = texts => {
	assert.deepEqual(Object.keys(texts).sort(), ["SHA256SUMS", "commands.txt", "pre.txt", "r.py", "r2.py", "t.py", "tools.txt", ...reproducerLogs].sort());
	const sums = texts.SHA256SUMS.trimEnd().split("\n").map(line => line.split("  "));
	assert.deepEqual(sums.map(([, name]) => name).sort(), Object.keys(texts).filter(name => name !== "SHA256SUMS").sort());
	for(const [digest, name] of sums) assert.equal(sha256(texts[name]), digest, name);
	for(const name of reproducerLogs)
	{
		assert.match(texts[name], /^exit 0$/mu, name);
		assert.doesNotMatch(texts[name], /terminate called/u, name);
	}
	assert.match(texts["iex.txt"], /^lean objfiles in inferior: \['[^']*\/lib\/lean\/libleanshared\.so'\]$/mu);
	assert.match(texts["pre.txt"], /terminate called after throwing an instance of 'gdb_exception_error'/u);
	assert.doesNotMatch(texts["pre.txt"], /^exit /mu);
	assert.ok(texts["tools.txt"].split("\n").includes(gdb.version));
	assert.ok(texts["tools.txt"].split("\n").includes(`${gdb.sha256}  /usr/bin/gdb`));
};

/** Each source path at the newest revision of a passing attempt; older producer snapshots stay archived only. */
export const containerEntryCurrentSources = () => {
	const passing = new Set(containerEntryAttempts.filter(attempt => attempt.outcome === "passed").map(attempt => attempt.revision));
	const newest = new Map();
	for(const source of containerEntrySources.filter(item => passing.has(item.revision)))
	{
		const seen = newest.get(source.path);
		if(!seen || containerEntryRevisions.indexOf(source.revision) > containerEntryRevisions.indexOf(seen.revision)) newest.set(source.path, source);
	}
	return [...newest.values()];
};

/**
 * Local scope only: failed attempts are retained as failed, nothing is hosted or promoted, and these native
 * reports never move the installed tree.
 *
 * @param artifacts - Exact original and source snapshot identities.
 */
export const containerEntryReceipt = artifacts => ({ schemaVersion: 1
	, kind: "fin-container-entry-acceptance"
	, revisions: containerEntryRevisions
	, attempts: containerEntryAttempts.map(attempt => ({ id: attempt.id, outcome: attempt.outcome, revision: attempt.revision, profiles: attempt.profiles }))
	, scope: {
		hosts: Object.keys(containerEntryHosts)
		, routes: ["ordinary-source", "reviewed-ir"]
		, measuredEntrypoints: sources.map(name => `FinContainers.${name}`)
		, publicRows: 24
		, rawAdapterRows: 11
		, instruments: { "LD_PRELOAD": ["cpp", "php-native", "wit-wasi"], "gdb-breakpoints": ["ruby", "dotnet"], "gdb-breakpoints-extracted-root": ["java", "kotlin"] }
		, rawAdapterCaller: "separate C probe of each host's verified installed libraries; never a host-language call"
		, localGlibc: "2.36"
		, hostedCi: false
		, installedTreeRelocation: false
		, supportPromotion: false
		, retained: "Reports, transcripts, queues, runners and Git source snapshots; package archives, installed trees, models and binaries are identified by digest only"
		, failedAttempts: containerEntryAttempts.filter(attempt => attempt.outcome === "failed").map(attempt => ({ id: attempt.id, revision: attempt.revision, reason: failureReasons[attempt.id] }))
	}
	, artifacts
	, sources: containerEntrySources.map(source => ({ ...source, snapshot: containerEntrySnapshot(source.revision, source.path) })) });

/**
 * Validate every path and byte before interpreting any record or current source.
 *
 * @param receipt - Parsed archive receipt.
 * @param read - Archive-byte reader, injectable for corruption tests.
 * @param options - Whether to authenticate live producer sources too.
 * @param options.currentSources - False only while staging the archived Git snapshots.
 */
export const assertContainerEntryArchive = async (receipt, read = readFile, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts));
	assert.deepEqual(receipt.artifacts.map(file => file.path), containerEntryPaths, "exact archive paths, with no duplicates or foreign paths");
	assert.deepEqual(receipt, containerEntryReceipt(receipt.artifacts));
	const files = new Map(), snapshots = containerEntrySources;
	for(const file of receipt.artifacts)
	{
		const owner = containerEntryAttempts.find(attempt => file.path.startsWith(archived(`${attempt.id}/`)));
		const name = owner && file.path.slice(archived(`${owner.id}/`).length);
		const source = snapshots.find(item => containerEntrySnapshot(item.revision, item.path) === file.path);
		const expected = owner ? owner.files[name] : { original: `git:${source.revision}:${source.path}`, sha256: source.sha256 };
		assert.ok(expected, file.path);
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "originalPath", "path", "sha256"]);
		assert.deepEqual([file.originalPath, file.sha256], [expected.original, expected.sha256]);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		const bytes = await read(file.path); assert.ok(Buffer.isBuffer(bytes));
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.path);
		files.set(file.path, bytes);
	}
	for(const attempt of containerEntryAttempts)
	{
		const json = name => JSON.parse(files.get(archived(`${attempt.id}/${name}`)));
		const reports = Object.fromEntries(Object.keys(attempt.reports).map(name => [name, json(name)]));
		const tap = files.get(archived(`${attempt.id}/run.tap`)).toString();
		assertContainerEntryAttempt(attempt, { queue: json("queue.json"), end: json("end.json"), tap, reports });
	}
	for(const attempt of containerEntryAttempts.filter(item => Object.keys(item.files).some(name => name.startsWith("reproducer/"))))
	{
		const names = Object.keys(attempt.files).filter(name => name.startsWith("reproducer/"));
		assertContainerEntryReproducer(Object.fromEntries(names.map(name => [name.slice("reproducer/".length), files.get(archived(`${attempt.id}/${name}`)).toString()])));
	}
	if(currentSources) for(const source of containerEntryCurrentSources())
	{
		const current = await readFile(source.path, "utf8").catch(() => "");
		if(source.sha256 !== registration.sha256)
		{
			assert.equal(sha256(beforeFinRefinementSource(source.path, current, source.sha256)), source.sha256, source.path);
			continue;
		}
		assert.equal(source.path, registration.path);
		const predecessor = beforeFinRefinementSource(registration.path, current, registration.predecessorSha256);
		assert.equal(sha256(predecessor), registration.predecessorSha256, "main's history authenticates the 5466a96 predecessor");
		assert.equal(predecessor.split(registration.anchor).length, 2, "one registration anchor");
		assert.equal(sha256(predecessor.replace(registration.anchor, registration.anchor + registration.added)), registration.sha256, "only the two-name registration separates fd51318");
	}
	return receipt;
};

/**
 * Save an artifact once; identical repeats are allowed, but changed bytes never overwrite it.
 *
 * @param path - Explicit archive destination.
 * @param bytes - Authenticated content to preserve.
 */
export const writeContainerEntryArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `Refusing to replace an existing artifact: ${path}`);
	}
};
