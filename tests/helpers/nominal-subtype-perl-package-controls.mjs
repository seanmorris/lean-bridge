/**
 * Corrupt coupled Perl manifests and installed receipts while updating their hashes.
 * The semantic checker must reject changes even after superficial re-signing.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalSubtypePerlReport } from "./nominal-subtype-perl-report.mjs";

/**
 * Exercise ABI, prepared API, installed payload and XS-only compilation refusals.
 *
 * @param files - Immutable originals relative to one selection's records.
 * @param run - Independently authenticated selection and source revision.
 */
export const nominalSubtypePerlPackageControls = async (files, run) => {
	const report = JSON.parse(files.get("report.json")); let controls = 0;
	for(const position of [0, 7]) for(const role of ["runtime", "component"])
	{
		const item = report.reports[position], prefix = `${item.configuration}/${item.delivery}/`;
		const changes = [
			context => { context.manifest.glibcMinimumVersion = "2.38"; }
			, context => { context.manifest.prebuilt.pop(); }
			, context => { context.installation.abi.api_version = "34"; }
			, context => { context.installation.operation = "rebuilt-lean"; context.trace.operation = "rebuilt-lean"; }
			, context => { context.trace.nativePayloadUnchanged = false; }
			, context => { context.trace.files.pop(); }
			, context => { context.trace.files[0].path = "../outside"; }
			, context => { context.installed["../outside"] = { bytes: 1, sha256: "0".repeat(64) }; }
			, ...["xs", "pm"].map(extension => context => {
				const path = prefix + `${role}-${extension === "xs" ? "source.xs" : "public.pm"}`;
				const bytes = Buffer.concat([context.altered.get(path), Buffer.from("\n# changed generated API\n")]);
				context.altered.set(path, bytes);
				const relative = context.manifest.module.replaceAll("::", "/");
				const member = extension === "xs" ? context.manifest.xs : `lib/${relative}.pm`;
				context.manifest.files[member] = sha256(bytes);
				if(extension === "xs" && item.delivery === "build-xs") context.installation.sourceSha256 = sha256(bytes);
				if(extension === "pm")
				{
					context.trace.files.find(file => file.path === `${relative}.pm`).sha256 = sha256(bytes);
					context.installed[context.base + relative + ".pm"] = { bytes: bytes.length, sha256: sha256(bytes) };
				}
			})
			, ...item.delivery === "build-xs" ? [
				context => { context.installation.commands[0][0] = "/usr/bin/lean"; }
				, context => { context.installation.commands[0].push("arbitrary.c"); }
				, context => { context.installation.sourceSha256 = "0".repeat(64); }
			] : [context => { context.installation.outputSha256 = "0".repeat(64); }]
		];
		for(const change of changes)
		{
			const altered = new Map(files);
			const get = path => JSON.parse(altered.get(path));
			const set = (path, value) => altered.set(path, Buffer.from(canonicalJson(value)));
			const observation = get("report.json"), current = observation.reports[position];
			const context = { altered, manifest: get(prefix + `${role}-manifest.json`)
				, installation: get(prefix + `${role}-install-receipt.json`)
				, trace: get(prefix + `${role}-trace.json`)
				, installed: get(prefix + "installed-files.json") };
			const suffix = `${context.manifest.module.replaceAll("::", "/")}/install-receipt.json`;
			const receiptPath = Object.keys(context.installed).find(path => path.endsWith("/" + suffix));
			context.base = receiptPath.slice(0, -suffix.length);
			change(context);
			set(prefix + `${role}-manifest.json`, context.manifest);
			set(prefix + `${role}-install-receipt.json`, context.installation);
			set(prefix + `${role}-trace.json`, context.trace);
			const bytes = altered.get(prefix + `${role}-install-receipt.json`);
			context.installed[receiptPath] = { bytes: bytes.length, sha256: sha256(bytes) };
			set(prefix + "installed-files.json", context.installed);
			current.installedFilesSha256 = sha256(altered.get(prefix + "installed-files.json"));
			const trace = current.traces.find(value => value.role === role);
			trace.manifestSha256 = sha256(altered.get(prefix + `${role}-manifest.json`));
			trace.receiptSha256 = sha256(bytes); trace.traceSha256 = sha256(altered.get(prefix + `${role}-trace.json`));
			set(prefix + "report.json", current); set("report.json", observation);
			await assert.rejects(checkNominalSubtypePerlReport(async path => altered.get(path), run)); controls++;
		}
	}
	return controls;
};
