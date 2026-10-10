/**
 * Implements the lifecycle fixture module in the performance subsystem.
 *
 * @file
 */

/**
 * Replaces weak references and finalization registries with explicit controls so lifecycle tests can trigger collection deterministically.
 */
export const createDeterministicFinalizerControls = () => {
	const references = [];
	let callback;
	let holding;

	return Object.freeze({
		loaderOptions: Object.freeze({
			createWeakReference:
				/**
         * Returns a controllable weak reference whose referent can be cleared before the queued finalizer runs.
         *
         * @param target - Object retained until the fixture explicitly simulates collection.
         */
				function(target) {
					let current = target;
					const reference = {
						deref: () => current
						, clear: () => { current = undefined; }
					};
					references.push(reference);
					return reference;
				}
			, createFinalizationRegistry:
				/**
         * Captures the runtime finalizer and returns a registry stand-in that tracks one resource holding.
         *
         * @param finalize - Finalization callback invoked with the registered holding after collection is simulated.
         */
				function(finalize) {
					callback = finalize;
					return {
						register:
						/**
             * Captures the finalizer holding so the fixture can trigger deterministic resource collection.
             *
             * @param _target - Test-double input accepted for interface compatibility but intentionally unused.
             * @param value - Generation-safe resource holding delivered to the finalizer callback.
             */
						function(_target, value) { holding = value; }
						, unregister:
						/**
             * Clears the captured holding and reports successful explicit unregistration.
             */
						function() { holding = undefined; return true; }
					};
				}
		})
		, queueLastResource:
			/**
       * Clears the most recent referent and delivers its holding to the captured finalizer callback.
       */
			function() {
				if(!callback || !holding || references.length === 0)
				{
					throw new Error("deterministic finalizer controls have no registered resource");
				}
				references.at(-1).clear();
				callback(holding);
			}
		, nativeLiveResources:
			/**
       * Reads the fixture’s private native live-handle diagnostic and fails when the module does not expose it.
       *
       * @param module - Initialized runtime module that supplies private native exports.
       */
			function(module) {
				const diagnostic = module._bridge_lean_live_handles;
				if(typeof diagnostic !== "function")
				{
					throw new Error("the lifecycle fixture requires the private live-handle diagnostic");
				}
				return diagnostic();
			}
	});
};
