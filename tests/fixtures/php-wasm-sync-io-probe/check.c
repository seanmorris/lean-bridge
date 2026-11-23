/* Only the test side module has this constructor. It calls the real linked
   transport from inside PHP's wasm memory; it does not implement a PHP API. */
#include "test-methods.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include "lean_bridge_native_runtime.h"

#define EXPECT(cond) do { if (!(cond)) { fprintf(f, "line %d: %s", __LINE__, #cond); fclose(f); return; } ++count; } while (0)
__attribute__((constructor)) static void check_ledger(void) {
    FILE *f = fopen("/ledger-check.txt", "w");
    if (!f) return;
    int count = 0;
    uint64_t args[9] = {0}, out[4] = {0}, limbs[] = {UINT64_MAX, 1};
    uint8_t tag = 0;
    const char message[] = "a\0b";
    EXPECT(READTOTAL(NULL, out, &tag) == 0 && out[0] == 0);
    args[0] = 4000000000u;
    EXPECT(ADD(args, out, &tag) == 0 && out[0] == 4000000000u);
    args[0] = (UINT64_C(1) << 32) + 5;
    EXPECT(ADD(args, out, &tag) == 5);
    EXPECT(READTOTAL(NULL, out, &tag) == 0 && out[0] == 4000000000u);
    args[0] = (uint64_t)INT32_MIN;
    EXPECT(SIGNED(args, out, &tag) == 0 && out[0] == (uint64_t)INT32_MIN);
    args[0] = UINT32_MAX;
    EXPECT(SIGNED(args, out, &tag) == 5);
    args[0] = UINT64_MAX;
    EXPECT(WIDE(args, out, &tag) == 0 && out[0] == UINT64_MAX);
    args[0] = (uintptr_t)limbs; args[1] = 2; args[2] = 1;
    EXPECT(MAGNITUDE(args, out, &tag) == 0 && out[1] == 2 && out[2] == 1 && out[3] == 2);
    EXPECT(!memcmp((void *)(uintptr_t)out[0], limbs, sizeof(limbs)));
    CLEAR(out); EXPECT(!out[0] && !out[1] && !out[2] && !out[3]);
    args[2] = 2; EXPECT(MAGNITUDE(args, out, &tag) == 5);
    args[2] = 0; args[0]++; EXPECT(MAGNITUDE(args, out, &tag) == 5);
    memset(args, 0, sizeof(args));
    args[6] = (uintptr_t)message; args[7] = 3;
    for (unsigned rejected = 0; rejected < 2; rejected++) {
        for (unsigned text = 0; text < 2; text++) {
            args[0] = rejected; args[3] = text; tag = 255;
            EXPECT(CHOOSE(args, out, &tag) == (rejected ? 3 : 0) && tag == text);
            if (text) {
                EXPECT(out[3] == 1 && out[1] == 3 && !memcmp((void *)(uintptr_t)out[0], message, 3));
            } else { EXPECT(out[3] == 0 && out[0] == 4000000000u); }
            CLEAR(out);
        }
    }
    args[6] += UINT64_C(1) << 32; EXPECT(CHOOSE(args, out, &tag) == 5);
    args[6] = UINT32_MAX; EXPECT(CHOOSE(args, out, &tag) == 5);
    args[6] = (uintptr_t)message; args[7] += UINT64_C(1) << 32;
    EXPECT(CHOOSE(args, out, &tag) == 5);
    EXPECT(IOFAILURE(NULL, out, &tag) == 4 && out[3] == 1);
    EXPECT(out[1] == 14 && !memcmp((void *)(uintptr_t)out[0], "ledger offline", 14));
    CLEAR(out);
    lean_bridge_native_snapshot snapshot;
    lean_bridge_native_snapshot_read(&snapshot);
    EXPECT(snapshot.runtime_init_runs == 1 && snapshot.component_init_runs == 1 && !snapshot.live_identities);
    lean_bridge_native_runtime_retire();
    EXPECT(READTOTAL(NULL, out, &tag) == 10);
    fprintf(f, "ok %d", count); fclose(f);
}
