/**
 * Replay every retained owned checked-record hosted archive.
 *
 * The named tests exist before capture so each archive records the same
 * verifier path. A lane without a retained archive is skipped here; promotion
 * must require every lane's archive and cannot skip it.
 *
 * @file
 */
import { readdirSync } from "node:fs";
import test from "node:test";
import { ownedCheckedRecordHostedLaneNames } from "./helpers/owned-checked-record-hosted-contracts.mjs";
import { checkOwnedCheckedRecordHostedEvidence } from "./helpers/owned-checked-record-hosted-evidence.mjs";

const archives = readdirSync("docs/evidence", { withFileTypes: true })
	.filter(entry => entry.isDirectory()).map(entry => entry.name);

for(const lane of ownedCheckedRecordHostedLaneNames)
{
	const roots = archives.filter(name =>
		new RegExp(`^owned-checked-record-${lane}-hosted-\\d{8}$`, "u").test(name))
		.map(name => `docs/evidence/${name}`);
	test(`retained ${lane} owned checked-record hosted evidence replays`, {
		skip: roots.length === 0, timeout: 600_000
	}, async () => {
		for(const root of roots)
			await checkOwnedCheckedRecordHostedEvidence(lane, root);
	});
}
