#include "component.h"
#define _GNU_SOURCE
#include <structuralsubtypes.h>
#include <lean/lean.h>
#include <stdint.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
lean_object * lb_structural_constructor_checkedPositive(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_constructor_checkedPositive"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_constructor_checkedPositive\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor StructuralSubtypes.checkedPositive\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_constructor_normalizePositive(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_constructor_normalizePositive"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_constructor_normalizePositive\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor StructuralSubtypes.normalizePositive\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_constructor_checkedWord(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_constructor_checkedWord"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_constructor_checkedWord\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor StructuralSubtypes.checkedWord\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_constructor_checkedByte(uint8_t a0) {
  static lean_object * (*next)(uint8_t a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_constructor_checkedByte"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_constructor_checkedByte\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor StructuralSubtypes.checkedByte\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_source_scalar(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_source_scalar"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_source_scalar\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.scalar\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_source_arrays(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_source_arrays"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_source_arrays\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.arrays\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_source_lists(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_source_lists"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_source_lists\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.lists\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_source_options(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_source_options"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_source_options\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.options\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_source_product(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_source_product"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_source_product\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.product\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_source_branch(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_source_branch"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_source_branch\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.branch\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_source_byteBranches(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_source_byteBranches"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_source_byteBranches\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.byteBranches\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_source_nested(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_source_nested"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_source_nested\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.nested\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_source_aliasPair(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_source_aliasPair"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_source_aliasPair\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.aliasPair\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_source_aliasArguments(lean_object * a0, lean_object * a1) {
  static lean_object * (*next)(lean_object * a0, lean_object * a1);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_source_aliasArguments"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_source_aliasArguments\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.aliasArguments\n", stderr);
  lean_object * result = next(a0, a1);
  
  return result;
}
lean_object * lb_structural_source_plainFin(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_source_plainFin"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_source_plainFin\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.plainFin\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * l_StructuralSubtypes_generic___redArg(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "l_StructuralSubtypes_generic___redArg"); if (!next) { fprintf(stderr, "missing interposed target: l_StructuralSubtypes_generic___redArg\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.generic\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_structural_source_unrestricted(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_structural_source_unrestricted"); if (!next) { fprintf(stderr, "missing interposed target: lb_structural_source_unrestricted\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.unrestricted\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_486d24ee5849ed09fee4459f(lean_object * a0, lean_object * a1) {
  static lean_object * (*next)(lean_object * a0, lean_object * a1);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_486d24ee5849ed09fee4459f"); if (!next) { fprintf(stderr, "missing interposed target: lb_486d24ee5849ed09fee4459f\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.aliasArguments\n", stderr);
  lean_object * result = next(a0, a1);
  
  return result;
}
uint8_t lb_486d24ee5849ed09fee4459f_refinement_0_0_0(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_486d24ee5849ed09fee4459f_refinement_0_0_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_486d24ee5849ed09fee4459f_refinement_0_0_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.aliasArguments:0_0_0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
uint8_t lb_486d24ee5849ed09fee4459f_refinement_1_0_0(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_486d24ee5849ed09fee4459f_refinement_1_0_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_486d24ee5849ed09fee4459f_refinement_1_0_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.aliasArguments:1_0_0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
lean_object * lb_85ecd6046aa1f73f83abcf27(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_85ecd6046aa1f73f83abcf27"); if (!next) { fprintf(stderr, "missing interposed target: lb_85ecd6046aa1f73f83abcf27\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.aliasPair\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
uint8_t lb_85ecd6046aa1f73f83abcf27_refinement_0_0_0_0(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_85ecd6046aa1f73f83abcf27_refinement_0_0_0_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_85ecd6046aa1f73f83abcf27_refinement_0_0_0_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.aliasPair:0_0_0_0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
uint8_t lb_85ecd6046aa1f73f83abcf27_refinement_0_1_0_0(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_85ecd6046aa1f73f83abcf27_refinement_0_1_0_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_85ecd6046aa1f73f83abcf27_refinement_0_1_0_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.aliasPair:0_1_0_0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
lean_object * lb_a8afafdcdccfd487c60aab47(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_a8afafdcdccfd487c60aab47"); if (!next) { fprintf(stderr, "missing interposed target: lb_a8afafdcdccfd487c60aab47\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.arrays\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
uint8_t lb_a8afafdcdccfd487c60aab47_refinement_0_0(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_a8afafdcdccfd487c60aab47_refinement_0_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_a8afafdcdccfd487c60aab47_refinement_0_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.arrays:0_0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
lean_object * lb_78e54ba4d815e6e77c4895b1(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_78e54ba4d815e6e77c4895b1"); if (!next) { fprintf(stderr, "missing interposed target: lb_78e54ba4d815e6e77c4895b1\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.branch\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
uint8_t lb_78e54ba4d815e6e77c4895b1_refinement_0_0(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_78e54ba4d815e6e77c4895b1_refinement_0_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_78e54ba4d815e6e77c4895b1_refinement_0_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.branch:0_0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
uint8_t lb_78e54ba4d815e6e77c4895b1_refinement_0_1(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_78e54ba4d815e6e77c4895b1_refinement_0_1"); if (!next) { fprintf(stderr, "missing interposed target: lb_78e54ba4d815e6e77c4895b1_refinement_0_1\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.branch:0_1\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
lean_object * lb_d848cf752c7261f24cfd5b10(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_d848cf752c7261f24cfd5b10"); if (!next) { fprintf(stderr, "missing interposed target: lb_d848cf752c7261f24cfd5b10\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.byteBranches\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
uint8_t lb_d848cf752c7261f24cfd5b10_refinement_0_0_0_0(uint8_t a0) {
  static uint8_t (*next)(uint8_t a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_d848cf752c7261f24cfd5b10_refinement_0_0_0_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_d848cf752c7261f24cfd5b10_refinement_0_0_0_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.byteBranches:0_0_0_0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
uint8_t lb_d848cf752c7261f24cfd5b10_refinement_0_0_0_1(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_d848cf752c7261f24cfd5b10_refinement_0_0_0_1"); if (!next) { fprintf(stderr, "missing interposed target: lb_d848cf752c7261f24cfd5b10_refinement_0_0_0_1\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.byteBranches:0_0_0_1\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
lean_object * lb_0b5409d057862ec3f96beec1(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_0b5409d057862ec3f96beec1"); if (!next) { fprintf(stderr, "missing interposed target: lb_0b5409d057862ec3f96beec1\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.lists\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
uint8_t lb_0b5409d057862ec3f96beec1_refinement_0_0(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_0b5409d057862ec3f96beec1_refinement_0_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_0b5409d057862ec3f96beec1_refinement_0_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.lists:0_0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
lean_object * lb_d0560c47cb866c2fde2d7214(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_d0560c47cb866c2fde2d7214"); if (!next) { fprintf(stderr, "missing interposed target: lb_d0560c47cb866c2fde2d7214\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.nested\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
uint8_t lb_d0560c47cb866c2fde2d7214_refinement_0_0_0_0_0(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_d0560c47cb866c2fde2d7214_refinement_0_0_0_0_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_d0560c47cb866c2fde2d7214_refinement_0_0_0_0_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.nested:0_0_0_0_0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
lean_object * lb_4518d0e9e129c150c099cebd(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_4518d0e9e129c150c099cebd"); if (!next) { fprintf(stderr, "missing interposed target: lb_4518d0e9e129c150c099cebd\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.options\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
uint8_t lb_4518d0e9e129c150c099cebd_refinement_0_0(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_4518d0e9e129c150c099cebd_refinement_0_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_4518d0e9e129c150c099cebd_refinement_0_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.options:0_0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
lean_object * lb_9dc502b24e87182eae2912ae(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_9dc502b24e87182eae2912ae"); if (!next) { fprintf(stderr, "missing interposed target: lb_9dc502b24e87182eae2912ae\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.plainFin\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
lean_object * lb_679f47fcbb2f10761b9db312(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_679f47fcbb2f10761b9db312"); if (!next) { fprintf(stderr, "missing interposed target: lb_679f47fcbb2f10761b9db312\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.product\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
uint8_t lb_679f47fcbb2f10761b9db312_refinement_0_0(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_679f47fcbb2f10761b9db312_refinement_0_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_679f47fcbb2f10761b9db312_refinement_0_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.product:0_0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
uint8_t lb_679f47fcbb2f10761b9db312_refinement_0_1(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_679f47fcbb2f10761b9db312_refinement_0_1"); if (!next) { fprintf(stderr, "missing interposed target: lb_679f47fcbb2f10761b9db312_refinement_0_1\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.product:0_1\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
lean_object * lb_76da6e2b36bf2bc74bb2d821(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_76da6e2b36bf2bc74bb2d821"); if (!next) { fprintf(stderr, "missing interposed target: lb_76da6e2b36bf2bc74bb2d821\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.scalar\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
uint8_t lb_76da6e2b36bf2bc74bb2d821_refinement_0(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_76da6e2b36bf2bc74bb2d821_refinement_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_76da6e2b36bf2bc74bb2d821_refinement_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.scalar:0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
lean_object * lb_9f6df65d361b8f96297241fd(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_9f6df65d361b8f96297241fd"); if (!next) { fprintf(stderr, "missing interposed target: lb_9f6df65d361b8f96297241fd\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.specialized\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
uint8_t lb_9f6df65d361b8f96297241fd_refinement_0_0(lean_object * a0) {
  static uint8_t (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_9f6df65d361b8f96297241fd_refinement_0_0"); if (!next) { fprintf(stderr, "missing interposed target: lb_9f6df65d361b8f96297241fd_refinement_0_0\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator StructuralSubtypes.specialized:0_0\n", stderr);
  uint8_t result = next(a0);
  
  return result;
}
lean_object * lb_175d3f87e2d0b869723dd6dd(lean_object * a0) {
  static lean_object * (*next)(lean_object * a0);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "lb_175d3f87e2d0b869723dd6dd"); if (!next) { fprintf(stderr, "missing interposed target: lb_175d3f87e2d0b869723dd6dd\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter StructuralSubtypes.unrestricted\n", stderr);
  lean_object * result = next(a0);
  
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_alias_arguments(structuralsubtypes_gmp_array_option_nat_span const* _lb_arg0, structuralsubtypes_gmp_array_option_nat_span const* _lb_arg1, structuralsubtypes_gmp_array_option_nat_span* out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(structuralsubtypes_gmp_array_option_nat_span const* _lb_arg0, structuralsubtypes_gmp_array_option_nat_span const* _lb_arg1, structuralsubtypes_gmp_array_option_nat_span* out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_alias_arguments"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_alias_arguments\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public aliasArguments\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, _lb_arg1, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public aliasArguments\n", stderr);
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_alias_pair(structuralsubtypes_gmp_tuple_array_option_nat_array_option_nat_value const* _lb_arg0, structuralsubtypes_gmp_tuple_array_option_nat_array_option_nat_value* out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(structuralsubtypes_gmp_tuple_array_option_nat_array_option_nat_value const* _lb_arg0, structuralsubtypes_gmp_tuple_array_option_nat_array_option_nat_value* out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_alias_pair"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_alias_pair\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public aliasPair\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public aliasPair\n", stderr);
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_arrays(structuralsubtypes_gmp_array_nat_span const* _lb_arg0, structuralsubtypes_gmp_array_nat_span* out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(structuralsubtypes_gmp_array_nat_span const* _lb_arg0, structuralsubtypes_gmp_array_nat_span* out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_arrays"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_arrays\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public arrays\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public arrays\n", stderr);
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_branch(structuralsubtypes_gmp_result_nat_string_value const* _lb_arg0, structuralsubtypes_gmp_result_nat_string_value* out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(structuralsubtypes_gmp_result_nat_string_value const* _lb_arg0, structuralsubtypes_gmp_result_nat_string_value* out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_branch"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_branch\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public branch\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public branch\n", stderr);
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_byte_branches(structuralsubtypes_gmp_array_option_tuple_uint8_nat_span const* _lb_arg0, structuralsubtypes_gmp_array_option_tuple_uint8_nat_span* out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(structuralsubtypes_gmp_array_option_tuple_uint8_nat_span const* _lb_arg0, structuralsubtypes_gmp_array_option_tuple_uint8_nat_span* out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_byte_branches"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_byte_branches\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public byteBranches\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public byteBranches\n", stderr);
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_lists(structuralsubtypes_gmp_list_nat_span const* _lb_arg0, structuralsubtypes_gmp_list_nat_span* out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(structuralsubtypes_gmp_list_nat_span const* _lb_arg0, structuralsubtypes_gmp_list_nat_span* out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_lists"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_lists\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public lists\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public lists\n", stderr);
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_nested(structuralsubtypes_gmp_array_list_option_tuple_nat_nat_span const* _lb_arg0, mpz_ptr out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(structuralsubtypes_gmp_array_list_option_tuple_nat_nat_span const* _lb_arg0, mpz_ptr out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_nested"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_nested\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public nested\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public nested\n", stderr);
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_options(structuralsubtypes_gmp_option_nat_value const* _lb_arg0, structuralsubtypes_gmp_option_nat_value* out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(structuralsubtypes_gmp_option_nat_value const* _lb_arg0, structuralsubtypes_gmp_option_nat_value* out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_options"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_options\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public options\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public options\n", stderr);
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_plain_fin(structuralsubtypes_gmp_array_option_nat_span const* _lb_arg0, mpz_ptr out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(structuralsubtypes_gmp_array_option_nat_span const* _lb_arg0, mpz_ptr out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_plain_fin"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_plain_fin\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public plainFin\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public plainFin\n", stderr);
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_product(structuralsubtypes_gmp_tuple_nat_string_value const* _lb_arg0, structuralsubtypes_gmp_tuple_nat_string_value* out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(structuralsubtypes_gmp_tuple_nat_string_value const* _lb_arg0, structuralsubtypes_gmp_tuple_nat_string_value* out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_product"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_product\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public product\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public product\n", stderr);
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_scalar(mpz_srcptr _lb_arg0, mpz_ptr out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(mpz_srcptr _lb_arg0, mpz_ptr out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_scalar"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_scalar\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public scalar\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public scalar\n", stderr);
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_specialized(structuralsubtypes_gmp_list_nat_span const* _lb_arg0, structuralsubtypes_gmp_list_nat_span* out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(structuralsubtypes_gmp_list_nat_span const* _lb_arg0, structuralsubtypes_gmp_list_nat_span* out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_specialized"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_specialized\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public specialized\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public specialized\n", stderr);
  return result;
}
structuralsubtypes_gmp_status structuralsubtypes_gmp_unrestricted(mpz_srcptr _lb_arg0, mpz_ptr out, structuralsubtypes_gmp_error* error) {
  static structuralsubtypes_gmp_status (*next)(mpz_srcptr _lb_arg0, mpz_ptr out, structuralsubtypes_gmp_error* error);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "structuralsubtypes_gmp_unrestricted"); if (!next) { fprintf(stderr, "missing interposed target: structuralsubtypes_gmp_unrestricted\n"); abort(); } }
  fputs("LB_SUBTYPE_ENTRY_V1 begin public unrestricted\n", stderr);
  structuralsubtypes_gmp_status result = next(_lb_arg0, out, error);
  fputs("LB_SUBTYPE_ENTRY_V1 end public unrestricted\n", stderr);
  return result;
}
