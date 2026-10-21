/**
 * Fin-inside-container cases for the shared installed-package harness.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { installCopiedConsumer } from "./copied-fixture-install.mjs";
export { nativeFixtureEnvironment as finContainerEnvironment } from "./copied-fixture-install.mjs";
// The WIT host header and its C prefix both derive from this hyphen-free name.
const coordinate = { name: "fincontainers", version: "1.0.0" };
export const finContainerTargets = Object.freeze({ c: ["c", coordinate]
	, cpp: ["cpp", coordinate]
	, python: ["pypi", coordinate]
	, rust: ["cargo", coordinate]
	, dotnet: ["nuget", { name: "FinContainers.Api", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:fincontainers", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:fincontainers", version: "1.0.0" }]
	, ruby: ["rubygems", coordinate]
	, "php-native": ["php-native", { name: "example/fincontainers", version: "1.0.0" }]
	, "wit-wasi": ["wit-wasi", coordinate]
	, perl: ["cpan", { module: "LeanBridge::FinContainers", version: "1.000" }] });

const fin = bound => ({ kind: "fin", bound });
const inside = (kind, child) => ({ kind, arguments: [child] });
const huge = "1180591620717411303424";
/** Checked refinement trees the native model must carry for every export. */
export const finContainerRefinements = Object.freeze({
	"FinContainers.mirrorAll": { parameters: [inside("array", fin("10"))], result: inside("array", fin("10")) }
	, "FinContainers.countNone": { parameters: [inside("array", fin("0"))], result: null }
	, "FinContainers.sumHuge": { parameters: [inside("list", fin(huge))], result: null }
	, "FinContainers.orDefault": { parameters: [inside("option", fin("1"))], result: null }
	, "FinContainers.present": { parameters: [inside("array", inside("option", fin("10")))], result: inside("array", fin("10")) }
	, "FinContainers.flatten": { parameters: [inside("list", inside("array", fin("10")))], result: inside("option", inside("list", fin("10"))) }
	, "FinContainers.label": { parameters: [null, inside("array", fin("4"))], result: null }
	, "FinContainers.wrapAll": { parameters: [null], result: inside("array", fin("7")) } });

/**
 * Install and exercise the container exports through public host APIs.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 */
export const installFinContainerConsumer = options => installCopiedConsumer({ ...options, fixture: {
	source: (profile, extension) => readFile(`tests/fixtures/fin-container-consumers/${profile}.${extension}`, "utf8")
	// Fin keeps Nat's limb-list transport in WIT; the bound lives in the README, not the WIT text.
	, wit: [/type (bridge-value-\d+) = list<u32>;[^]*type (bridge-value-\d+) = list<\1>;[^]*type digits = \2;[^]*mirror-all: func\([^)]*: digits\) -> digits/
		, /type (bridge-value-\d+) = list<u32>;[^]*type (bridge-value-\d+) = option<\1>;[^]*or-default: func\([^)]*: \2\) -> \1/]
	, success: "fin-container-ok"
} });
