/**
 * Load the exact unpromoted inventory used by historical partial HostNull
 * promoter controls after the complete matrix supersedes them.
 *
 * @file
 */
import { execFileSync } from "node:child_process";

export const hostNullPrePromotionCommit
	= "52622818425c3fb69a81ef87b5af26ce429e3136";
const paths = Object.freeze([
	"docs/type-surface.v1.json"
	, "schema/binding-ir.schema.json"
	, "docs/consumer-support.v1.json"
]);
const records = paths.map(path => JSON.parse(execFileSync("git", [
	"show", `${hostNullPrePromotionCommit}:${path}`
], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })));

/** Return the immutable historical document and its matching contracts. */
export const loadHostNullPrePromotionInventory = () => ({
	document: records[0]
	, contracts: { irSchema: records[1], consumers: records[2] }
});
