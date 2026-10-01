/**
 * Independently select optional capabilities for WIT receiver packages.
 *
 * @file
 */
import { ownedJvmPlainReceiverConfiguration, ownedJvmPlainReceiverReviewedIr, ownedJvmPlainReceiverSource } from "./owned-jvm-receiver-fixture.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";

/**
 * Keep callbacks, consumption and result anchors independently selectable.
 *
 * @param kind - Resource-only, consuming resource, or unanchored callable API.
 */
export const ownedWitReceiverConfiguration = async kind => {
	if(!["plain", "consuming", "unanchored"].includes(kind)) throw new TypeError("Unknown WIT receiver configuration");
	const hostCallbacks = kind === "unanchored", transferredInputs = kind !== "plain";
	const configuration = hostCallbacks ? await ownedRustReceiverConfiguration()
		: await ownedJvmPlainReceiverConfiguration(transferredInputs, false);
	const reviewedIr = hostCallbacks ? ownedRustReceiverReviewedIr() : ownedJvmPlainReceiverReviewedIr(transferredInputs);
	if(hostCallbacks)
	{
		for(const [name, contract] of Object.entries(configuration.contracts))
		{
			delete contract.result;
			if(Object.keys(contract).length === 0) delete configuration.contracts[name];
		}
		for(const fn of reviewedIr.declarations) if(fn.result.ownership === "borrow")
			Object.assign(fn.result, { ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
	}
	return { configuration, reviewedIr
		, sourceSuffix: hostCallbacks ? ownedRustReceiverSource : ownedJvmPlainReceiverSource
		, hostCallbacks, transferredInputs
		, anchoredResults: false, receiverExports: true };
};
