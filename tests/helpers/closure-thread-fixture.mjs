/**
 * Independent two-closure contract for departed-creator lifetime checks.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../../src/backends/c/primitive-surface.mjs";
import { callableSignatures, callableReviewedIr } from "./callable-fixture.mjs";

export const closureThreadExports = ["Callables.makeUInt32", "Callables.makeString"];
/** Review the two exported signatures without compiler metadata. */
export const closureThreadReview = () => callableReviewedIr(callableSignatures.filter(item => closureThreadExports.includes(item.name)));

/** Generate a caller against the public installed C header only. */
export const closureThreadConsumer = () => {
	const surface = compilePrimitiveCSurface(closureThreadReview(), { callables: true });
	const owned = name => "callables_owned_" + surface.callbacks.get(surface.functions.find(fn => fn.declaration.id === `lean:Callables.make${name}`).declaration.result.type.id).field;
	const word = owned("UInt32"), string = owned("String");
	return `#include <callables.h>
#include <assert.h>
#include <dlfcn.h>
#include <pthread.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

static ${word} *foreign_word;
static ${string} *foreign_string;
static unsigned word_accepted, word_rejected, string_accepted, string_rejected;
static _Atomic unsigned checks;
#define CHECK(value) do { ++checks; assert(value); } while (0)
struct snapshot { uint32_t abi, state, runs, components, attached, identities; uint64_t runtime, domain; };
static unsigned identities(void) {
  void (*read_snapshot)(struct snapshot *) = (void (*)(struct snapshot *))dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read");
  CHECK(read_snapshot); struct snapshot value; read_snapshot(&value); return value.identities;
}
static void *creator(void *unused) {
  (void)unused; callables_error error = {0};
  const callables_string captured = {.data="a\\0z", .length=3};
  CHECK(callables_make_uint32(42, &foreign_word, &error) == CALLABLES_STATUS_OK);
  CHECK(callables_make_string(&captured, &foreign_string, &error) == CALLABLES_STATUS_OK);
  CHECK(foreign_word && foreign_string); return NULL;
}
static void *replacement(void *unused) {
  (void)unused; callables_error error = {0};
  ${word} *local_word = NULL; ${string} *local_string = NULL;
  const callables_string captured = {.data="local", .length=5};
  CHECK(callables_make_uint32(73, &local_word, &error) == CALLABLES_STATUS_OK);
  CHECK(callables_make_string(&captured, &local_string, &error) == CALLABLES_STATUS_OK);
  uint32_t wout = 99; callables_string sout = {0};
  CHECK(${word}_call(local_word, true, 0, &wout, &error) == CALLABLES_STATUS_OK && wout == 73);
  CHECK(${string}_call(local_string, true, &captured, &sout, &error) == CALLABLES_STATUS_OK);
  CHECK(sout.length == 5 && !memcmp(sout.data, "local", 5)); callables_string_clear(&sout);
  wout = 99;
  callables_status status = ${word}_call(foreign_word, true, 0, &wout, &error);
  if (status == CALLABLES_STATUS_OK) { CHECK(wout == 42); ++word_accepted; }
  else { CHECK(status == CALLABLES_STATUS_INVALID_ARGUMENT && wout == 99); ++word_rejected; }
  const callables_string sentinel = {.data="unchanged", .length=9}; sout = sentinel;
  status = ${string}_call(foreign_string, true, &captured, &sout, &error);
  if (status == CALLABLES_STATUS_OK) { CHECK(sout.length == 3 && !memcmp(sout.data, "a\\0z", 3)); ++string_accepted; }
  else {
    CHECK(status == CALLABLES_STATUS_INVALID_ARGUMENT && sout.data == sentinel.data && sout.length == sentinel.length && !sout.owner && !sout.release);
    ++string_rejected;
  }
  callables_string_clear(&sout);
  CHECK(${word}_call(local_word, true, 0, &wout, &error) == CALLABLES_STATUS_OK && wout == 73);
  ${word}_dispose(&local_word); ${string}_dispose(&local_string);
  CHECK(!local_word && !local_string && identities() == 2); return NULL;
}
int main(void) {
  callables_error error = {0}; ${word} *prime = NULL;
  CHECK(callables_make_uint32(1, &prime, &error) == CALLABLES_STATUS_OK);
  ${word}_dispose(&prime); CHECK(!prime && identities() == 0);
  pthread_t thread; CHECK(pthread_create(&thread, NULL, creator, NULL) == 0);
  CHECK(pthread_join(thread, NULL) == 0 && identities() == 2);
  for (unsigned index = 0; index < 16; ++index) {
    CHECK(pthread_create(&thread, NULL, replacement, NULL) == 0);
    CHECK(pthread_join(thread, NULL) == 0);
  }
  ${word}_dispose(&foreign_word); ${string}_dispose(&foreign_string);
  CHECK(!foreign_word && !foreign_string && identities() == 0);
  const unsigned remaining = identities();
  printf("{\\"checks\\":%u,\\"wordAccepted\\":%u,\\"wordRejected\\":%u,\\"stringAccepted\\":%u,\\"stringRejected\\":%u,\\"identities\\":%u}\\n", checks, word_accepted, word_rejected, string_accepted, string_rejected, remaining);
}
`;
};
