// Test instrumentation only. The application uses the public Rust crate.
#[path = "consumer.rs"] #[allow(dead_code)] mod application;
use std::ffi::{c_char, c_void};

#[repr(C)]
#[derive(Default)]
struct Snapshot { abi: u32, state: u32, starts: u32, init: u32, attached: u32,
                  live: u32, runtime: u64, domain: u64 }
unsafe extern "C" { fn dlsym(handle: *mut c_void, name: *const c_char) -> *mut c_void; }

fn live() -> u32 {
    let mut s = Snapshot::default();
    unsafe {
        let hook = dlsym(std::ptr::null_mut(), c"lean_bridge_native_snapshot_read".as_ptr());
        assert!(!hook.is_null(), "could not observe the loaded broker");
        let read: unsafe extern "C" fn(*mut Snapshot) = std::mem::transmute(hook);
        read(&mut s);
    }
    assert_eq!(s.abi, 1);
    s.live
}

fn main() {
    let (held, mut counts) = std::thread::spawn(|| {
        let tariff = tariff_quotes::make_tariff(300).unwrap();
        assert_eq!(tariff.quote.call(2).unwrap(), 302);
        let held = live();
        assert!(held > 0, "observer missed a known live function");
        drop(tariff);
        assert_eq!(live(), 0);
        let mut counts = Vec::new();
        application::scenarios(|| {
            counts.push(live());
            assert_eq!(counts.last(), Some(&0), "unexpected owner after case {}", counts.len());
        }).unwrap();
        assert_eq!(counts.len(), 6);
        (held, counts)
    }).join().unwrap();
    counts.push(live());
    assert_eq!(counts, [0; 7]);
    println!("held:{held}");
    println!("identities:{}", counts.iter().map(u32::to_string).collect::<Vec<_>>().join(","));
}
