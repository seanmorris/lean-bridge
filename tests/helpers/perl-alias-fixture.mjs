/**
 * Independent host-value expectations for the shared copied-alias contract.
 *
 * @file
 */
export const perlAliasValueTypes = {
	AUnit: "undef", ABool: "true() | false()"
	, AU8: "unsigned integer scalar", AU16: "unsigned integer scalar"
	, AU32: "unsigned integer scalar", AU64: "unsigned integer scalar"
	, AI8: "signed integer scalar", AI16: "signed integer scalar"
	, AI32: "signed integer scalar", AI64: "signed integer scalar"
	, ANat: "Math::BigInt (nonnegative)", AInt: "Math::BigInt"
	, AF32: "numeric scalar", AF64: "numeric scalar"
	, AText: "text scalar", ABytes: "octet string", AChar: "single-scalar text"
	, AWord: "unsigned integer scalar", ASignedWord: "signed integer scalar"
	, ScalarsView: "LeanBridge::Aliases::Scalars"
	, Count: "unsigned integer scalar", OtherCount: "unsigned integer scalar"
	, Rows: "array reference<array reference<unsigned integer scalar>>"
	, Maybe: "undef | Some<undef | Some<undef>>"
	, Outcome: "Ok<[unsigned integer scalar, octet string]> | Err<text scalar>"
	, PacketView: "LeanBridge::Aliases::Packet"
	, Packets: "array reference<LeanBridge::Aliases::Packet>"
};
