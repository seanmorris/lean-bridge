/**
 * Independent public C assertions shared by execution and receipt validation.
 *
 * @file
 */
import { readFile } from "node:fs/promises";

/**
 * Preserve the common move assertions and add WIT mixed-value and frame checks.
 *
 * @param generated - Generated public WIT package supplying only its C prefix.
 */
export const ownedWitTransferProbe = async generated => {
	const mixed = await readFile("tests/fixtures/structured-types/owned-wit-transfer-mixed.c", "utf8");
	const original = (await readFile("tests/fixtures/structured-types/owned-public-transfers.c", "utf8"))
		.replace("int main(void) {", mixed + '\nint main(void) {\n  if (getenv("LEAN_BRIDGE_WIT_MISSING_TRANSFER_FRAME")) { missing_transfer_frame(); puts("{\\"missingFrame\\":true}"); return 0; }')
		.replace("whole_owner(); affinity();", "whole_owner(); affinity(); mixed_and_boxed_moves();");
	return original.replaceAll("owned_aggregates_echo_tuple_argument0_snd_t", "owned_aggregates_mixed_product_snd_t")
		.replaceAll("owned_aggregates", generated.values.prefix).replaceAll("OWNED_AGGREGATES", generated.values.prefix.toUpperCase())
		.replace("int main(void)", "static int consumer_main(void)") + `
extern size_t owned_test_component_calls(void);
extern size_t owned_test_native_imports(void);
extern size_t owned_test_lean_calls(void);
extern size_t owned_test_exports(void);
int main(void) {
  int status = consumer_main();
  printf("{\\"componentCalls\\":%zu,\\"nativeImports\\":%zu,\\"leanCalls\\":%zu,\\"exports\\":%zu}\\n",
    owned_test_component_calls(), owned_test_native_imports(), owned_test_lean_calls(), owned_test_exports());
  return status;
}
`;
};
