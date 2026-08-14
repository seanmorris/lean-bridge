/**
 * Provides the Lean link spike private ABI proof-of-concept module.
 *
 * @file
 */

export const alphaPrivateAbi = Object.freeze({
	schemaVersion: 1
	, initialize: "_bridge_lean_runtime_init"
	, declarations: Object.freeze({
		"lean:Alpha.box": Object.freeze({ symbol: "_bridge_lean_alpha_make", adapter: null })
		, "lean:Alpha.Box.read": Object.freeze({ symbol: "_bridge_lean_alpha_read", adapter: null })
		, "bridge:Alpha.Box.identity": Object.freeze({ symbol: "_bridge_lean_handle_identity", adapter: null })
		, "lean:Alpha.roundTrip": Object.freeze({
			symbol: "_bridge_lean_alpha_round_trip"
			, adapter: Object.freeze({
				kind: "value-frame-v1"
				, abiVersion: 1
				, maxCopyBytes: 1024 * 1024
				, maxArrayLength: 64 * 1024
			})
		})
		, "lean:Alpha.withCallback": Object.freeze({
			symbol: "_bridge_lean_alpha_with_callback"
			, adapter: Object.freeze({
				kind: "callback-call-v1"
				, abiVersion: 1
				, callbackParameter: "transform"
				, maxDepth: 64
			})
		})
		, "lean:Alpha.makeAdder": Object.freeze({
			symbol: "_bridge_lean_alpha_make_adder"
			, adapter: Object.freeze({
				kind: "callback-result-v1"
				, abiVersion: 1
				, maxDepth: 64
			})
		})
	})
	, resources: Object.freeze({
		"lean:Alpha.Box": Object.freeze({
			side: "lean"
			, kind: 1
			, dispose: "_bridge_lean_release"
		})
	})
	, callbacks: Object.freeze({
		"lean:Alpha.Transform": Object.freeze({
			side: "lean"
			, kind: 2
			, call: "_bridge_lean_alpha_transform_call"
			, dispose: "_bridge_lean_alpha_transform_release"
		})
	})
});
