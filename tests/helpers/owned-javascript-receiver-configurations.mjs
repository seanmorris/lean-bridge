/**
 * Independent receiver packages with optional callbacks and result anchors.
 *
 * @file
 */
import { ownedJvmPlainReceiverConfiguration, ownedJvmPlainReceiverReviewedIr, ownedJvmPlainReceiverSource } from "./owned-jvm-receiver-fixture.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";

/**
 * Retain the same member decisions while removing every output-borrow contract.
 *
 * @param unanchored - Include callbacks without result anchors.
 * @param consuming - Include optional resource consumption.
 */
export const ownedJavaScriptReceiverConfiguration = async (unanchored, consuming) => {
	const configuration = unanchored ? await ownedRustReceiverConfiguration() : await ownedJvmPlainReceiverConfiguration(consuming, false);
	const reviewedIr = unanchored ? ownedRustReceiverReviewedIr() : ownedJvmPlainReceiverReviewedIr(consuming);
	if(unanchored)
	{
		for(const [name, contract] of Object.entries(configuration.contracts))
		{
			delete contract.result;
			if(!Object.keys(contract).length) delete configuration.contracts[name];
		}
		for(const fn of reviewedIr.declarations) if(fn.result.ownership === "borrow")
			Object.assign(fn.result, { ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
	}
	delete configuration.targets;
	return { configuration, reviewedIr, sourceSuffix: unanchored ? ownedRustReceiverSource : ownedJvmPlainReceiverSource };
};
