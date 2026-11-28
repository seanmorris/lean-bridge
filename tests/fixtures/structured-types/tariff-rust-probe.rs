/* A second executable. Public consumer.rs does not need the native observer. */
#[path = "consumer.rs"] #[allow(dead_code)] mod application;
use std::ffi::{c_char, c_void};
use std::sync::Mutex;

#[repr(C)]
#[derive(Default)]
struct Snapshot { abi: u32, state: u32, starts: u32, init: u32, attached: u32, live: u32, runtime: u64, domain: u64 }
unsafe extern "C" { fn dlsym(h: *mut c_void, name: *const c_char) -> *mut c_void; }
static SAMPLES: Mutex<Vec<u32>> = Mutex::new(Vec::new());
fn live() -> u32 {
    let mut s = Snapshot::default();
    unsafe {
        let hook = dlsym(std::ptr::null_mut(), c"lean_bridge_native_snapshot_read".as_ptr());
        assert!(!hook.is_null());
        let read: unsafe extern "C" fn(*mut Snapshot) = std::mem::transmute(hook);
        read(&mut s);
    }
    assert_eq!(s.abi, 1);
    s.live
}
fn checkpoint(name: &str) {
    // Rust's thread-local session cache is weak: no value pins a session at
    // these checkpoints. Do not mistake an empty cache for a live C++ session.
    let sample = live();
    assert_eq!(sample, 0, "{name}");
    SAMPLES.lock().unwrap().push(sample);
    println!("{name}");
}
fn main() {
    let held = std::thread::spawn(|| {
        let tariff = tariff_quotes::make_tariff(300).unwrap();
        assert_eq!(tariff.quote.call(2).unwrap(), 302);
        let held = live();
        assert!(held > 0, "observer did not see a known live function");
        drop(tariff);
        assert_eq!(live(), 0);
        application::scenarios(checkpoint).unwrap();
        held
    }).join().unwrap();
    let mut samples = SAMPLES.lock().unwrap();
    assert_eq!(samples.len(), 7);
    samples.push(live());
    assert_eq!(samples.last(), Some(&0));
    println!("held:{held}");
    println!("identities:{}", samples.iter().map(u32::to_string).collect::<Vec<_>>().join(","));
}
