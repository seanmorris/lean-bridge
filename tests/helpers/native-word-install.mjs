/**
 * Word-sized integer cases for the shared installed-package harness.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { installCopiedConsumer } from "./copied-fixture-install.mjs";
export { nativeFixtureEnvironment as nativeWordEnvironment } from "./copied-fixture-install.mjs";
const coordinate = { name: "platform-words", version: "1.0.0" };
export const nativeWordTargets = Object.freeze({ c: ["c", coordinate]
	, cpp: ["cpp", coordinate], python: ["pypi", coordinate]
	, rust: ["cargo", coordinate]
	, dotnet: ["nuget", { name: "Platform.Words", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:platform-words", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:platform-words", version: "1.0.0" }]
	, ruby: ["rubygems", coordinate]
	, perl: ["cpan", { module: "LeanBridge::Words", version: "1.000" }]
	, "php-native": ["php-native", { name: "example/platform-words", version: "1.0.0" }]
	, "wit-wasi": ["wit-wasi", coordinate]
	, "php-wasm": ["php-wasm", { npm: { name: "platform-words-wasm", version: "1.0.0" }, composer: { name: "example/platform-words-wasm", version: "1.0.0" } }] });

/**
 * Install and exercise compiler-target ranges through public host APIs.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 */
export const installWordConsumer = options => installCopiedConsumer({ ...options, fixture: {
	source: async (profile, extension, bits) => (await readFile(`tests/fixtures/word-consumers/${profile}.${extension}`, "utf8")).replaceAll("__BITS__", String(bits))
	, wit: [/keep-unsigned: func\([^)]*: u64\) -> u64/, /keep-signed: func\([^)]*: s64\) -> s64/, /list<u64>/, /list<s64>/]
	, success: "word-ok"
	, phpInvalid: "try { LeanWords\\keep_unsigned(-1); throw new Exception('Invalid word accepted'); } catch (TypeError|ValueError $error) {}"
} });
