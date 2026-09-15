/**
 * Verify downloaded packages without importing build engines or publication adapters.
 *
 * @file
 */

import { diagnostic } from "./contract.mjs";
import { verifyComponentPackageReceipt } from "../release/component-package-receipt.mjs";
import { verifyReleaseArchive } from "../release/release-archive-verifier.mjs";
import { packageSetReceiptKind, readReceiptBytes, verifyPackageSetReceipt } from "../release/package-set-receipt.mjs";

const verifyUnsigned = async inputs => {
	const receipt = JSON.parse((await readReceiptBytes(inputs.receiptPath, inputs.signal)).toString("utf8"));
	if(receipt.kind === packageSetReceiptKind) return { ...await verifyPackageSetReceipt(inputs), verificationType: "local-package-set" };
	return verifyComponentPackageReceipt(inputs);
};

/**
 * Reuse the same validators as the portable handoff scripts.
 *
 * @param root0 - Verification dependencies, overridable for isolated CLI tests.
 * @param root0.verifyLocal - Unsigned local receipt and archive validator.
 * @param root0.verifySigned - Signed archive and trusted policy validator.
 */
export const createVerificationHandler = ({
	verifyLocal = verifyUnsigned
	, verifySigned = verifyReleaseArchive
} = {}) => async (request, { signal } = {}) => {
	const { verificationType, ...inputs } = request.verification;
	const authenticated = verificationType === "signed-archive";
	signal?.throwIfAborted();
	try
	{
		const checked = await (authenticated ? verifySigned(inputs) : verifyLocal({ ...inputs, signal }));
		signal?.throwIfAborted();
		return {
			status: "ok"
			, result: Object.freeze({ ...checked, verificationType: checked.verificationType ?? verificationType, authenticated })
		};
	}
	catch(error)
	{
		signal?.throwIfAborted();
		if(error?.name === "AbortError" || error?.code === "cli-cancelled") throw error;
		return {
			status: "failed", result: null
			, diagnostics: [diagnostic({
				code: error.code ?? `${verificationType}-verification-failed`
				, message: error.message ?? String(error)
				, path: inputs.receiptPath
				, hint: authenticated
					? "Keep the original archive, receipt and hash sidecar. Check the expected coordinate, subject and independently trusted policy hash."
					: "Use the original local receipt and its named archives. Package-set receipts also require their .json.sha256 sidecar. Signed releases require all signed verification options."
			})]
		};
	}
};

export const verificationHandler = createVerificationHandler();
