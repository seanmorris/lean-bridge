/**
 * Fin inside record and variant fields for the shared installed-package harness (VO #1442).
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { installCopiedConsumer } from "./copied-fixture-install.mjs";
// The WIT host header and its C prefix both derive from this hyphen-free name.
const coordinate = { name: "finrecords", version: "1.0.0" };
export const finRecordTargets = Object.freeze({ c: ["c", coordinate]
	, cpp: ["cpp", coordinate]
	, python: ["pypi", coordinate]
	, rust: ["cargo", coordinate]
	, dotnet: ["nuget", { name: "FinRecords.Api", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:finrecords", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:finrecords", version: "1.0.0" }]
	, ruby: ["rubygems", coordinate]
	, "php-native": ["php-native", { name: "example/finrecords", version: "1.0.0" }]
	, "wit-wasi": ["wit-wasi", coordinate]
	, perl: ["cpan", { module: "LeanBridge::FinRecords", version: "1.000" }] });

const fin = bound => ({ kind: "fin", bound });
const tile = { kind: "record", definition: "FinRecords.Tile", fields: ["digit", "count"], arguments: [fin("5"), null] };
const shapeCases = [
	{ name: "circle", fields: ["radius"], arguments: [fin("10")] }
	, { name: "label", fields: ["text"], arguments: [null] }
	, { name: "empty", fields: [], arguments: [] }];
const shape = { kind: "variant", definition: "FinRecords.Shape", cases: shapeCases };
const gateCases = [{ name: "closed", fields: [], arguments: [] }, { name: "never", fields: ["value"], arguments: [fin("0")] }];
/** Checked refinement trees the native model must carry for every export. */
export const finRecordRefinements = Object.freeze({
	"FinRecords.bump": { parameters: [tile], result: tile }
	, "FinRecords.gateOpen": { parameters: [{ kind: "variant", definition: "FinRecords.Gate", cases: gateCases }], result: null }
	, "FinRecords.lateSum": { parameters: [{ kind: "record", definition: "FinRecords.Late", fields: ["label", "items", "digit"], arguments: [null, null, fin("5")] }], result: null }
	, "FinRecords.makeShape": { parameters: [null], result: shape }
	, "FinRecords.maybeShape": { parameters: [{ kind: "option", arguments: [shape] }], result: null }
	, "FinRecords.nestSum": { parameters: [{ kind: "record", definition: "FinRecords.Nest", fields: ["inner", "tag"], arguments: [tile, fin("3")] }], result: null }
	, "FinRecords.shapeSize": { parameters: [shape], result: null }
	, "FinRecords.slotCount": { parameters: [{ kind: "record", definition: "FinRecords.Slot", fields: ["maybe", "count"], arguments: [{ kind: "option", arguments: [fin("0")] }, null] }], result: null }
	, "FinRecords.tileExcept": { parameters: [{ kind: "result", arguments: [tile, shape] }], result: null }
	, "FinRecords.tileList": { parameters: [{ kind: "list", arguments: [tile] }], result: null }
	, "FinRecords.tilePair": { parameters: [{ kind: "tuple", arguments: [tile, shape] }], result: null }
	, "FinRecords.tileSum": { parameters: [tile], result: null }
	, "FinRecords.tiles": { parameters: [{ kind: "array", arguments: [tile] }], result: null } });

/** WIT keeps Nat's limb list inside named records and variant case records. */
export const finRecordWitPatterns = Object.freeze([/type (bridge-value-\d+) = list<u32>;[^]*record tile \{\s*digit: \1,\s*count: \1,?\s*\}[^]*record nest \{\s*inner: tile,\s*tag: \1,?\s*\}[^]*nest-sum: func\(arg0: nest\) -> \1;/u
	, /record shape-circle-fields \{\s*radius: (bridge-value-\d+),?\s*\}[^]*variant shape \{\s*circle\(shape-circle-fields\),\s*label\(shape-label-fields\),\s*empty,?\s*\}[^]*shape-size: func\(arg0: shape\) -> \1;/u
	, /variant gate \{\s*closed,\s*never\(gate-never-fields\),?\s*\}/u]);

/**
 * Install and exercise the record exports through public host APIs.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 */
export const installFinRecordConsumer = options => installCopiedConsumer({ ...options, fixture: {
	source: (profile, extension) => readFile(`tests/fixtures/fin-record-consumers/${profile}.${extension}`, "utf8")
	, wit: finRecordWitPatterns
	, success: "fin-record-ok"
} });
