/**
 * Reject coordinated replacement of complete Rust archives and their receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import { readOwnedPerlCallbackVariantTar } from "./owned-perl-callback-result-variant-archives.mjs";
import { checkInheritedCheckedRecordRustPackage } from "./inherited-checked-record-rust-package-records.mjs";
import { inheritedCheckedRecordRustReceipt } from "./inherited-checked-record-rust-package.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const encoded = value => Buffer.from(canonicalJson(value));

/**
 * Require an accepted baseline before changing payloads and every enclosing hash.
 *
 * @param originalRead - Immutable selection-relative original bytes.
 * @param options - Independently authenticated compiler/package inputs.
 * @param options.model - Author compiler model.
 * @param options.receipt - Author package-set receipt.
 * @param options.producerCommit - Full immutable producer revision.
 * @param options.floor - Explicit native glibc floor.
 */
export const checkInheritedCheckedRecordRustPackageControls = async (originalRead, options) => {
	const { crate } = await checkInheritedCheckedRecordRustPackage({ ...options, read: originalRead
		, json: async path => JSON.parse(await originalRead(path)) });
	const paths = [...crate.retained.map(path => "package/" + path), "crate.json"
		, "handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, "handoff/" + crate.archive.path];
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const identities = new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)]));
	const json = path => JSON.parse(originals.get(path));
	const read = async (path, changes) => {
		const bytes = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(bytes), path); return Buffer.from(bytes);
	};
	let packageControls = 0;
	// Repack every changed byte and reconcile all package hashes together. The
	// frozen public-source generator must still reject the substituted Rust API.
	const originalPackageSet = options.receipt;
	const originalPackage = originalPackageSet.packages[0];
	const members = readOwnedPerlCallbackVariantTar(originals.get("handoff/" + crate.archive.path), originalPackage.name + "-" + originalPackage.version);
	for(const target of ["src/lib.rs", "src/__runtime.rs", "src/assets.rs", "Cargo.toml", "Cargo.lock", "src/injected.rs"])
	{
		assert.equal(originals.has(`package/${target}`), target !== "src/injected.rs", target);
		const changed = structuredClone(crate), receipt = json(`package/${inheritedCheckedRecordRustReceipt}`);
		const changes = new Map(), bytes = Buffer.concat([originals.get(`package/${target}`) ?? Buffer.alloc(0), Buffer.from("\n// coordinated source replacement\n")]);
		changes.set(`package/${target}`, bytes); receipt.files[target] = identity(bytes); changed.files[target] = identity(bytes);
		if(!changed.retained.includes(target)) changed.retained.push(target);
		changed.retained.sort();
		const receiptBytes = encoded(receipt); changes.set(`package/${inheritedCheckedRecordRustReceipt}`, receiptBytes);
		changed.files[inheritedCheckedRecordRustReceipt] = identity(receiptBytes); changed.receiptSha256 = sha256(receiptBytes);
		changed.closure = { receiptSha256: sha256(receiptBytes), packageFileSetSha256: sha256(canonicalJson(Object.keys(changed.files).sort())) };
		const replacement = new Map(members);
		replacement.set(target, bytes); replacement.set(inheritedCheckedRecordRustReceipt, receiptBytes);
		const packageSet = structuredClone(originalPackageSet), pkg = packageSet.packages[0];
		const archive = createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
			, files: [...replacement].map(([path, bytes]) => ({ path: pkg.name + "-" + pkg.version + "/" + path, bytes, mode: 0o644 })) });
		Object.assign(pkg.artifacts[0], identity(archive)); changed.archive = structuredClone(pkg.artifacts[0]);
		changes.set("handoff/" + changed.archive.path, archive);
		const handoff = encoded(packageSet); changes.set("handoff/package-set-receipt.json", handoff);
		changes.set("handoff/package-set-receipt.json.sha256", Buffer.from(sha256(handoff) + "  package-set-receipt.json\n"));
		changes.set("crate.json", encoded(changed));
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkInheritedCheckedRecordRustPackage({ read: mutatedRead
			, json: async path => JSON.parse(await mutatedRead(path))
			, model: options.model
			, receipt: packageSet
			, producerCommit: options.producerCommit
			, floor: options.floor }), error => {
			assert.ok(error instanceof assert.AssertionError);
			if(target === "src/injected.rs")
			{
				assert.equal(error.operator, "deepStrictEqual");
				assert.ok(Array.isArray(error.actual) && error.actual.includes(target));
				assert.ok(Array.isArray(error.expected) && !error.expected.includes(target));
			}
			else
			{
				assert.equal(error.operator, "strictEqual", target);
				assert.equal(error.actual, bytes.toString());
				assert.equal(typeof error.expected, "string");
				assert.notEqual(error.expected, error.actual);
			}
			return true;
			}, target); packageControls++;
	}
	for(const [path, hash] of identities) assert.equal(sha256(await originalRead(path)), hash, path);
	return packageControls;
};
