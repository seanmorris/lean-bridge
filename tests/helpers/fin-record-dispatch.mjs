/**
 * Count Lean source and adapter dispatch for record- and variant-refined C exports (VO #1442).
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Name the compiler-emitted Lean adapter that public calls reach through the runtime table.
 *
 * @param name - Lean declaration identity.
 */
export const finRecordSymbol = name => `lb_${sha256(`finrecords@1.0.0\0${name}`).slice(0, 24)}`;

// Columns: source tileSum, source shapeSize, then their exported adapters. Each takes one Lean object.
export const finRecordDispatchColumns = Object.freeze([
	"l_FinRecords_tileSum"
	, "l_FinRecords_shapeSize"
	, finRecordSymbol("FinRecords.tileSum")
	, finRecordSymbol("FinRecords.shapeSize")]);
const wrapper = (symbol, index) => `void *${symbol}(void *a0) {
  static void *(*next)(void *);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort(); }
  ++counts[${index}];
  return next(a0);
}`;

/** Test-only LD_PRELOAD interposer; each wrapper resolves its target on first use. */
export const finRecordDispatchInterposer = () => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
static unsigned long counts[${finRecordDispatchColumns.length}];
unsigned long fin_record_dispatch_count(unsigned index) { return index < ${finRecordDispatchColumns.length} ? counts[index] : 0; }
${finRecordDispatchColumns.map(wrapper).join("\n")}
`;

/**
 * Expected rows: step, public status or raw outcome, then the four counters after the step.
 * Public rejections stop at the C entry; raw rejections reach only the adapter, whose mirror
 * check refuses them; valid raw calls reach the adapter and the source.
 */
export const finRecordDispatchExpected = Object.freeze([
	["start", 0, [0, 0, 0, 0]]
	, ["public-valid-tile", 0, [1, 0, 1, 0]]
	, ["public-invalid-tile", 1, [1, 0, 1, 0]]
	, ["public-valid-circle", 0, [1, 1, 1, 1]]
	, ["public-invalid-circle", 1, [1, 1, 1, 1]]
	, ["raw-invalid-tile", 1, [1, 1, 2, 1]]
	, ["raw-invalid-circle", 1, [1, 1, 2, 2]]
	, ["raw-valid-tile", 1, [2, 1, 3, 2]]
	, ["raw-valid-circle", 1, [2, 2, 3, 3]]]);

/** Probe public and exported-adapter dispatch; raw mirrors use the pinned Lean object API. */
export const finRecordDispatchProbe = () => `#define _GNU_SOURCE
#include <finrecords.h>
#include <lean/lean.h>
#include <dlfcn.h>
#include <stdio.h>
typedef lean_object *(*raw_unary)(lean_object *);
static unsigned long (*count)(unsigned);
static void report(const char *step, int status) {
  printf("%s %d", step, status);
  for (unsigned i = 0; i < ${finRecordDispatchColumns.length}; ++i) printf(" %lu", count(i));
  printf("\\n");
}
/* The erased Tile mirror is constructor 0 with two Nat fields; the Shape mirror's circle is constructor 0 with one. */
static lean_object *tile(size_t digit, size_t amount) {
  lean_object *value = lean_alloc_ctor(0, 2, 0);
  lean_ctor_set(value, 0, lean_box(digit)); lean_ctor_set(value, 1, lean_box(amount));
  return value;
}
static lean_object *circle(size_t radius) {
  lean_object *value = lean_alloc_ctor(0, 1, 0);
  lean_ctor_set(value, 0, lean_box(radius));
  return value;
}
/* An exported adapter consumes its argument and returns an owned Option. */
static int rejected(raw_unary adapter, lean_object *argument) {
  lean_object *result = adapter(argument);
  int none = lean_is_scalar(result);
  lean_dec(result);
  return none;
}
static int accepted(raw_unary adapter, lean_object *argument) {
  lean_object *result = adapter(argument);
  int some = !lean_is_scalar(result);
  lean_dec(result);
  return some;
}
int main(void) {
  *(void **)&count = dlsym(RTLD_DEFAULT, "fin_record_dispatch_count");
  if (!count) { fprintf(stderr, "interposer is not loaded\\n"); return 1; }
  finrecords_error error = {0};
  finrecords_tile value; finrecords_tile_init(&value);
  finrecords_shape shape; finrecords_shape_init(&shape);
  mpz_t result; mpz_init(result);
  report("start", 0);
  mpz_set_ui(value.digit, 3); mpz_set_ui(value.count, 1);
  report("public-valid-tile", finrecords_tile_sum(&value, result, &error));
  mpz_set_ui(value.digit, 5); report("public-invalid-tile", finrecords_tile_sum(&value, result, &error));
  if (finrecords_shape_select(&shape, FINRECORDS_SHAPE_KIND_CIRCLE) != FINRECORDS_STATUS_OK) return 1;
  mpz_set_ui(shape.cases.circle.radius, 9); report("public-valid-circle", finrecords_shape_size(&shape, result, &error));
  mpz_set_ui(shape.cases.circle.radius, 10); report("public-invalid-circle", finrecords_shape_size(&shape, result, &error));
  raw_unary tiles = (raw_unary)dlsym(RTLD_DEFAULT, "${finRecordSymbol("FinRecords.tileSum")}");
  raw_unary shapes = (raw_unary)dlsym(RTLD_DEFAULT, "${finRecordSymbol("FinRecords.shapeSize")}");
  if (!tiles || !shapes) { fprintf(stderr, "exported adapters are not visible\\n"); return 1; }
  /* Direct adapter calls skip the C precheck; the mirror check still rejects them without reaching the source. */
  report("raw-invalid-tile", rejected(tiles, tile(5, 1)));
  report("raw-invalid-circle", rejected(shapes, circle(10)));
  report("raw-valid-tile", accepted(tiles, tile(3, 1)));
  report("raw-valid-circle", accepted(shapes, circle(6)));
  finrecords_tile_clear(&value); finrecords_shape_clear(&shape); mpz_clear(result);
  return 0;
}
`;
