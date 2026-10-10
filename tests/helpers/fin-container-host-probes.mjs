/**
 * Host-process dispatch probes for installed Python and Rust container refinements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { finContainerDispatchColumns, finContainerDispatchExpected, finContainerDispatchInterposer, finContainerSymbol } from "./fin-container-dispatch.mjs";

/** Test instrumentation uses the pinned Lean header to construct and release raw values. */
export const finContainerHostInterposer = () => `${finContainerDispatchInterposer()}
#include <lean/lean.h>
typedef lean_object *(*raw_unary)(lean_object *);
/* Adapters consume their argument and return an owned Option. The runtime has
   already been initialized by the preceding public calls in this process. */
int fin_container_raw(unsigned operation) {
  if (operation > 3) abort();
  int mirror = operation == 0 || operation == 2;
  raw_unary adapter;
  *(void **)&adapter = dlsym(RTLD_DEFAULT, mirror
    ? "${finContainerSymbol("FinContainers.mirrorAll")}"
    : "${finContainerSymbol("FinContainers.orDefault")}");
  if (!adapter) abort();
  lean_object *argument;
  if (mirror) {
    argument = lean_alloc_array(1, 1);
    lean_array_set_core(argument, 0, lean_box(operation == 0 ? 10 : 3));
  } else if (operation == 1) {
    argument = lean_alloc_ctor(1, 1, 0);
    lean_ctor_set(argument, 0, lean_box(1));
  } else argument = lean_box(0);
  lean_object *result = adapter(argument);
  int valid = 0;
  if (operation < 2) valid = result == lean_box(0);
  else if (!lean_is_scalar(result) && lean_obj_tag(result) == 1) {
    lean_object *value = lean_ctor_get(result, 0);
    if (mirror) valid = !lean_is_scalar(value) && lean_obj_tag(value) == LeanArray
      && lean_array_size(value) == 1 && lean_array_get_core(value, 0) == lean_box(6);
    else valid = value == lean_box(7);
  }
  lean_dec(result);
  return valid;
}
`;

/** Public calls use the generated Python API; raw calls stay in this Python process. */
export const pythonFinContainerProbe = () => `import ctypes as c
import lean_fincontainers as api

process = c.CDLL(None)
count = process.fin_container_dispatch_count
count.argtypes = [c.c_uint]
count.restype = c.c_ulong
raw = process.fin_container_raw
raw.argtypes = [c.c_uint]
raw.restype = c.c_int

def report(step, status):
    print(step, status, *[count(i) for i in range(${finContainerDispatchColumns.length})])

def rejected(call, path, bound):
    try:
        call()
    except api.LeanBridgeError as error:
        if error.status == 1 and str(error) == path + ' is not below its Fin ' + bound + ' bound':
            return 1
        raise
    raise AssertionError('invalid input accepted')

report('start', 0)
if api.mirror_all([3]) != (6,):
    raise AssertionError('incorrect mirror result')
report('public-valid-mirror', 0)
report('public-invalid-mirror', rejected(lambda: api.mirror_all([10]), 'arg0[0]', '10'))
if api.or_default(None) != 7:
    raise AssertionError('incorrect absent result')
report('public-valid-absent', 0)
report('public-invalid-present', rejected(lambda: api.or_default(api.Some(1)), 'arg0?', '1'))
for operation, step in enumerate(('raw-invalid-mirror', 'raw-invalid-present', 'raw-valid-mirror', 'raw-valid-absent')):
    report(step, raw(operation))
`;

/** Public Rust calls use the installed crate; only the test instrumentation uses dlsym. */
export const rustFinContainerProbe = () => `use fincontainers as api;
use api::{BigUint, Error};
use std::ffi::{c_char, c_int, c_uint, c_ulong, c_void};

#[link(name = "dl")]
extern "C" { fn dlsym(handle: *mut c_void, name: *const c_char) -> *mut c_void; }
type Counter = unsafe extern "C" fn(c_uint) -> c_ulong;
type Raw = unsafe extern "C" fn(c_uint) -> c_int;

fn report(count: Counter, step: &str, status: i32) {
    print!("{step} {status}");
    for index in 0..${finContainerDispatchColumns.length} { print!(" {}", unsafe { count(index) }); }
    println!();
}
fn rejected<T>(result: Result<T, Error>, path: &str, bound: &str) -> i32 {
    match result {
        Err(Error::Native { code: 1, message }) if message == format!("{path} is not below its Fin {bound} bound") => 1,
        _ => panic!("missing expected Fin rejection"),
    }
}
fn main() {
    let symbol = |name: &[u8]| {
        let pointer = unsafe { dlsym(std::ptr::null_mut(), name.as_ptr().cast()) };
        assert!(!pointer.is_null(), "interposer is not loaded");
        pointer
    };
    let count: Counter = unsafe { std::mem::transmute(symbol(b"fin_container_dispatch_count\\0")) };
    let raw: Raw = unsafe { std::mem::transmute(symbol(b"fin_container_raw\\0")) };
    let n = |value: u64| BigUint::from(value);
    report(count, "start", 0);
    assert_eq!(api::mirror_all(&[n(3)]).unwrap(), vec![n(6)]);
    report(count, "public-valid-mirror", 0);
    report(count, "public-invalid-mirror", rejected(api::mirror_all(&[n(10)]), "arg0[0]", "10"));
    assert_eq!(api::or_default(&None).unwrap(), n(7));
    report(count, "public-valid-absent", 0);
    report(count, "public-invalid-present", rejected(api::or_default(&Some(n(1))), "arg0?", "1"));
    for (operation, step) in ["raw-invalid-mirror", "raw-invalid-present", "raw-valid-mirror", "raw-valid-absent"].iter().enumerate() {
        report(count, step, unsafe { raw(operation as c_uint) });
    }
}
`;

/**
 * Admit only the complete ordered positive/negative-control transcript.
 *
 * @param output - Probe stdout, including its final newline.
 */
export const parseFinContainerHostDispatch = output => {
	assert.equal(typeof output, "string");
	assert.ok(output.endsWith("\n"), "dispatch transcript is incomplete");
	const observed = output.slice(0, -1).split("\n").map(line => {
		assert.match(line, /^[a-z-]+ [01](?: (?:0|[1-9][0-9]*)){4}$/u);
		const [step, status, ...counts] = line.split(" ");
		return [step, Number(status), counts.map(Number)];
	});
	assert.deepEqual(observed, finContainerDispatchExpected);
	return observed;
};
