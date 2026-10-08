#define _GNU_SOURCE
#include <genericinheritance.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == GENERICINHERITANCE_STATUS_OK)
static genericinheritance_string text(const char *value) { genericinheritance_string result = {value, strlen(value), NULL, NULL}; return result; }
static int same_text(const genericinheritance_string *value, const char *expected) { return value->length == strlen(expected) && memcmp(value->data, expected, value->length) == 0; }

int main(void) {
  genericinheritance_error error = {0};
  mpz_t sum, expected; mpz_init(sum); mpz_init(expected);
  /* NatChild extends Base Nat: the parent is the to_base member, typed by its source alias NatBase. */
  genericinheritance_nat_child child, grown; genericinheritance_nat_child_init(&child); genericinheritance_nat_child_init(&grown);
  mpz_set_ui(child.to_base.base, 4); mpz_set_ui(child.child, 7);
  CHECK(OK(genericinheritance_grow(&child, &grown, &error)) && mpz_cmp_ui(grown.to_base.base, 5) == 0 && mpz_cmp_ui(grown.child, 14) == 0);
  CHECK(mpz_cmp_ui(child.to_base.base, 4) == 0 && mpz_cmp_ui(child.child, 7) == 0);
  genericinheritance_nat_child_clear(&grown); genericinheritance_nat_child_init(&grown);
  /* Nat stays arbitrary precision through the parent member. */
  mpz_set_ui(child.to_base.base, 0); mpz_setbit(child.to_base.base, 70); mpz_set_ui(child.child, 1); mpz_setbit(child.child, 65);
  CHECK(OK(genericinheritance_grow(&child, &grown, &error)));
  mpz_set_ui(expected, 0); mpz_setbit(expected, 70); mpz_add_ui(expected, expected, 1);
  CHECK(mpz_cmp(grown.to_base.base, expected) == 0);
  mpz_set_ui(expected, 2); mpz_setbit(expected, 66);
  CHECK(mpz_cmp(grown.child, expected) == 0);
  genericinheritance_nat_child_clear(&grown); genericinheritance_nat_child_init(&grown);
  /* UNatChild extends a universe-polymorphic UBase instantiated at Type: the member is to_ubase. */
  genericinheritance_unat_child lifted; genericinheritance_unat_child_init(&lifted);
  mpz_set_ui(lifted.to_ubase.value, 30); mpz_set_ui(lifted.extra, 12);
  CHECK(OK(genericinheritance_lift(&lifted, sum, &error)) && mpz_cmp_ui(sum, 42) == 0);
  mpz_set_ui(lifted.to_ubase.value, 0); mpz_setbit(lifted.to_ubase.value, 80);
  CHECK(OK(genericinheritance_lift(&lifted, sum, &error)));
  mpz_set_ui(expected, 12); mpz_setbit(expected, 80);
  CHECK(mpz_cmp(sum, expected) == 0);
  /* MarkerTagged extends Tag Marker: Marker is a phantom argument, so to_tag carries only the label. */
  genericinheritance_marker_tagged tagged, relabeled; genericinheritance_marker_tagged_init(&tagged); genericinheritance_marker_tagged_init(&relabeled);
  tagged.to_tag.label = text("h\xc3\xa9llo \xf0\x9f\x99\x82"); mpz_set_ui(tagged.count, 3);
  CHECK(OK(genericinheritance_relabel(&tagged, &relabeled, &error)) && same_text(&relabeled.to_tag.label, "h\xc3\xa9llo \xf0\x9f\x99\x82!") && mpz_cmp_ui(relabeled.count, 3) == 0);
  CHECK(same_text(&tagged.to_tag.label, "h\xc3\xa9llo \xf0\x9f\x99\x82"));
  genericinheritance_marker_tagged_clear(&relabeled); genericinheritance_marker_tagged_init(&relabeled);
  tagged.to_tag.label = text("");
  CHECK(OK(genericinheritance_relabel(&tagged, &relabeled, &error)) && same_text(&relabeled.to_tag.label, "!"));
  genericinheritance_marker_tagged_clear(&relabeled); genericinheritance_marker_tagged_init(&relabeled);
  for (unsigned long i = 0; i < 1000; ++i) {
    mpz_set_ui(child.to_base.base, i); mpz_set_ui(child.child, i);
    if (!OK(genericinheritance_grow(&child, &grown, &error)) || mpz_cmp_ui(grown.to_base.base, i + 1) != 0 || mpz_cmp_ui(grown.child, 2 * i) != 0) { fprintf(stderr, "grow round %lu failed\n", i); return 1; }
    genericinheritance_nat_child_clear(&grown); genericinheritance_nat_child_init(&grown);
    mpz_set_ui(lifted.to_ubase.value, i); mpz_set_ui(lifted.extra, 1000 - i);
    if (!OK(genericinheritance_lift(&lifted, sum, &error)) || mpz_cmp_ui(sum, 1000) != 0) { fprintf(stderr, "lift round %lu failed\n", i); return 1; }
  }
  checks += 2000;
  /* Caller-owned strings were borrowed views; clear only what the caller initialized. */
  tagged.to_tag.label = text("");
  genericinheritance_nat_child_clear(&child); genericinheritance_nat_child_clear(&grown); genericinheritance_unat_child_clear(&lifted);
  genericinheritance_marker_tagged_clear(&tagged); genericinheritance_marker_tagged_clear(&relabeled); mpz_clear(sum); mpz_clear(expected);
  printf("generic-inheritance-ok:%u\n", checks);
  return 0;
}
