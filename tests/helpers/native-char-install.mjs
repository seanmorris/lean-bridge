/**
 * Char cases using the shared offline copied-package harness.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { charPoints } from "./native-char-fixture.mjs";
import { installCopiedConsumer } from "./copied-fixture-install.mjs";
export { nativeFixtureEnvironment as nativeCharEnvironment } from "./copied-fixture-install.mjs";
const coordinate = { name: "glyphs-char", version: "1.0.0" };
export const nativeCharTargets = Object.freeze({ c: ["c", coordinate]
	, cpp: ["cpp", coordinate]
	, python: ["pypi", coordinate]
	, rust: ["cargo", coordinate]
	, dotnet: ["nuget", { name: "Glyphs.Char", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:glyphs-char", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:glyphs-char", version: "1.0.0" }]
	, ruby: ["rubygems", coordinate]
	, perl: ["cpan", { module: "LeanBridge::Glyphs", version: "1.000" }]
	, "php-native": ["php-native", { name: "example/glyphs-char", version: "1.0.0" }]
	, "wit-wasi": ["wit-wasi", coordinate]
	, "php-wasm": ["php-wasm", { npm: { name: "glyphs-char-wasm", version: "1.0.0" }, composer: { name: "example/glyphs-char-wasm", version: "1.0.0" } }] });


/**
 * Install the Unicode fixture without exposing producer tools to consumers.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 */
export const installCharConsumer = options => installCopiedConsumer({ ...options, fixture: {
	source: async (profile, extension) => (await readFile(`tests/fixtures/char-consumers/${profile}.${extension}`, "utf8")).replaceAll("__POINTS__", charPoints.join(", "))
	, wit: [/keep: func\([^)]*: char\) -> char/, /list<char>/]
	, success: "char-ok"
	, phpInvalid: "try { LeanGlyphs\\keep('ab'); throw new Exception('Invalid Char accepted'); } catch (ValueError $error) {}"
} });
