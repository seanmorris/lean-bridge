// Introspection and fork checks are test-only. Both APIs are installed crates.
use recursive_api as api;
unsafe extern "C" {
    fn dlsym(handle: *mut std::ffi::c_void, name: *const std::ffi::c_char) -> *mut std::ffi::c_void;
    fn fork() -> i32;
    fn waitpid(pid: i32, status: *mut i32, flags: i32) -> i32;
    fn _exit(code: i32) -> !;
}
#[repr(C)]
#[derive(Default)]
struct Snapshot {
    version: u32, state: u32, runtime_runs: u32, component_runs: u32,
    components: u32, identities: u32, instance: u64, domain: u64,
}
fn main() {
    let barrier = std::sync::Barrier::new(2);
    std::thread::scope(|scope| {
        scope.spawn(|| { barrier.wait(); assert_eq!(api::empty().unwrap(), api::Tree::Branch { children: vec![] }); });
        scope.spawn(|| { barrier.wait(); assert_eq!(peer_api::answer().unwrap(), 42); });
    });
    let owned = api::grow(&api::Spine::Leaf { value: 7 }).unwrap();
    unsafe {
        let raw = dlsym(std::ptr::null_mut(), c"lean_bridge_native_snapshot_read".as_ptr());
        assert!(!raw.is_null());
        let read: unsafe extern "C" fn(*mut Snapshot) = std::mem::transmute(raw);
        let mut snapshot = Snapshot::default(); read(&mut snapshot);
        assert_eq!(snapshot.runtime_runs, 1); assert_eq!(snapshot.component_runs, 2);
        assert_eq!(snapshot.components, 2); assert_eq!(snapshot.identities, 0);
        let pid = fork(); assert!(pid >= 0);
        if pid == 0 {
            let graph = matches!(api::empty(), Err(api::Error::Load(message)) if message.contains("fork"));
            let peer = matches!(peer_api::answer(), Err(peer_api::Error::Load(message)) if message.contains("fork"));
            _exit(if graph && peer { 0 } else { 1 });
        }
        let mut status = -1; assert_eq!(waitpid(pid, &mut status, 0), pid); assert_eq!(status, 0);
        assert_eq!(peer_api::answer().unwrap(), 42);
        let raw = dlsym(std::ptr::null_mut(), c"lean_bridge_native_runtime_retire".as_ptr());
        assert!(!raw.is_null());
        let retire: unsafe extern "C" fn() = std::mem::transmute(raw); retire();
    }
    assert!(matches!(api::empty(), Err(api::Error::Native { code: 5, .. })));
    assert!(peer_api::answer().is_err());
    assert_eq!(owned, api::Spine::Next { value: Box::new(api::Spine::Leaf { value: 7 }) });
    drop(owned);
    println!("recursive-composition-ok:shared-runtime,fork-rejection,retirement,owned-cleanup");
}
