/**
 * Render verified process-wide Rust native loading independent of source paths.
 *
 * @file
 */

/**
 * Embed the compiled native artifacts and coordinate independently generated crates.
 *
 * @param evidence - Verified native library hashes, or null for source-only generation.
 */
export const copiedRustAssets = evidence => !evidence ? `pub(super) fn load() -> Result<usize, crate::Error> { Err(crate::Error::Load("Build a compiled Cargo release before calling this API".into())) }\n` : String.raw`use crate::Error;
use sha2::Digest;
use std::collections::BTreeMap;
use std::ffi::{c_char, c_int, c_void, CStr, CString};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::os::unix::{ffi::OsStrExt, fs::{DirBuilderExt, MetadataExt, OpenOptionsExt}};
use std::path::PathBuf;
use std::sync::OnceLock;

unsafe extern "C" {
    fn dlopen(path: *const c_char, flags: c_int) -> *mut c_void;
    fn dlsym(handle: *mut c_void, name: *const c_char) -> *mut c_void;
    fn dlerror() -> *const c_char;
    fn mkdtemp(template: *mut c_char) -> *mut c_char;
    fn geteuid() -> u32;
    fn atexit(callback: extern "C" fn()) -> c_int;
}
static CLEANUP: OnceLock<(u32, PathBuf)> = OnceLock::new();
extern "C" fn cleanup() {
    if let Some((pid, root)) = CLEANUP.get() {
        if *pid == std::process::id() {
            let _ = fs::remove_file(root.join("state"));
            let _ = fs::remove_dir(root);
        }
    }
}
fn io(error: std::io::Error) -> Error { Error::Load(error.to_string()) }
fn failure(message: &str) -> Error { Error::Load(message.into()) }
fn hex(bytes: &[u8]) -> String { bytes.iter().map(|byte| format!("{byte:02x}")).collect() }
fn unhex(text: &str) -> Result<Vec<u8>, Error> {
    if text.len() % 2 != 0 || !text.bytes().all(|b| b.is_ascii_hexdigit()) { return Err(failure("Invalid loader registry")); }
    (0..text.len()).step_by(2).map(|i| u8::from_str_radix(&text[i..i + 2], 16).map_err(|_| failure("Invalid loader registry"))).collect()
}
fn registry() -> Result<(File, BTreeMap<String, String>), Error> {
    let stat = fs::read_to_string("/proc/self/stat").map_err(io)?;
    let start = stat.rsplit_once(')').and_then(|(_, tail)| tail.split_whitespace().nth(19))
        .filter(|word| word.bytes().all(|b| b.is_ascii_digit())).ok_or_else(|| failure("Cannot identify process start"))?;
    let uid = unsafe { geteuid() };
    let root = PathBuf::from(format!("/tmp/lean-bridge-rust-v1-{uid}-{}-{start}", std::process::id()));
    match fs::DirBuilder::new().mode(0o700).create(&root) {
        Ok(()) => (), Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => (), Err(error) => return Err(io(error)),
    }
    let meta = fs::symlink_metadata(&root).map_err(io)?;
    if !meta.is_dir() || meta.uid() != uid || meta.mode() & 0o777 != 0o700 { return Err(failure("Unsafe loader registry directory")); }
    let mut file = OpenOptions::new().read(true).write(true).create(true).truncate(false)
        .mode(0o600).custom_flags(0o400000).open(root.join("state")).map_err(io)?;
    let meta = file.metadata().map_err(io)?;
    if !meta.is_file() || meta.uid() != uid || meta.mode() & 0o777 != 0o600 || meta.nlink() != 1 { return Err(failure("Unsafe loader registry file")); }
    file.lock().map_err(io)?;
    let mut text = String::new();
    (&mut file).take(256 * 1024 + 1).read_to_string(&mut text).map_err(io)?;
    if text.len() > 256 * 1024 { return Err(failure("Loader registry limit exceeded")); }
    let mut entries = BTreeMap::new();
    for line in text.lines() {
        let (key, value) = line.split_once('=').ok_or_else(|| failure("Invalid loader registry"))?;
        if entries.insert(key.into(), value.into()).is_some() { return Err(failure("Duplicate loader registry entry")); }
    }
    CLEANUP.get_or_init(|| { unsafe { atexit(cleanup) }; (std::process::id(), root) });
    Ok((file, entries))
}
fn save(file: &mut File, entries: &BTreeMap<String, String>) -> Result<(), Error> {
    let text: String = entries.iter().map(|(key, value)| format!("{key}={value}\n")).collect();
    file.seek(SeekFrom::Start(0)).map_err(io)?;
    file.set_len(0).map_err(io)?;
    file.write_all(text.as_bytes()).map_err(io)
}
struct Directory(PathBuf);
impl Directory {
    fn new() -> Result<Self, Error> {
        let mut template = b"/tmp/lean-bridge-rust-assets-XXXXXX\0".to_vec();
        let result = unsafe { mkdtemp(template.as_mut_ptr().cast()) };
        if result.is_null() { return Err(io(std::io::Error::last_os_error())); }
        Ok(Self(PathBuf::from(std::ffi::OsStr::from_bytes(unsafe { CStr::from_ptr(result) }.to_bytes()))))
    }
}
impl Drop for Directory {
    fn drop(&mut self) {
        if let Ok(entries) = fs::read_dir(&self.0) {
            for entry in entries.flatten() { let _ = fs::remove_file(entry.path()); }
        }
        let _ = fs::remove_dir(&self.0);
    }
}
unsafe fn open(path: &CStr, flags: i32) -> Result<usize, Error> {
    let handle = unsafe { dlopen(path.as_ptr(), flags) };
    if handle.is_null() {
        let error = unsafe { dlerror() };
        return Err(failure(if error.is_null() { "Native loader failed" } else { unsafe { CStr::from_ptr(error) }.to_str().unwrap_or("Native loader failed") }));
    }
    // No dlclose: generated function pointers and the shared runtime live until exit.
    Ok(handle as usize)
}
pub(super) fn load() -> Result<usize, Error> {
    let (mut file, mut entries) = registry()?;
    if entries.contains_key("failed") { return Err(failure("Native loading failed earlier in this process")); }
    let identity = ${JSON.stringify(evidence.runtimeIdentity)};
    if entries.get("runtime").is_some_and(|previous| previous != identity) { return Err(failure("Incompatible Lean runtime identities")); }
    let assets: &[(&str, &str, &[u8])] = &[
${["libleanshared.so", "liblean_bridge_native.so", ...Object.keys(evidence.libraries).filter(name => ![evidence.library, "libleanshared.so", "liblean_bridge_native.so"].includes(name)), evidence.library].map(name => `        (${JSON.stringify(name)}, ${JSON.stringify(evidence.libraries[name])}, include_bytes!("../native/linux-x64/${name}")),`).join("\n")}
    ];
    for (name, expected, bytes) in assets {
        if format!("{:x}", sha2::Sha256::digest(bytes)) != *expected { return Err(failure("Native library differs from compiled evidence")); }
        if entries.get(*name).is_some_and(|value| value.split(':').next() != Some(*expected)) { return Err(failure("Conflicting native library builds")); }
    }
    if !entries.contains_key("runtime") {
        let broker = c"liblean_bridge_native.so";
        let lean = c"libleanshared.so";
        let initialize = c"lean_initialize_runtime_module";
        if !unsafe { dlopen(broker.as_ptr(), 2 | 4) }.is_null()
            || !unsafe { dlopen(lean.as_ptr(), 2 | 4) }.is_null()
            || !unsafe { dlsym(std::ptr::null_mut(), initialize.as_ptr()) }.is_null() {
            return Err(failure("An unverified Lean runtime is already loaded; start a fresh process after fork"));
        }
    }
    entries.insert("failed".into(), "1".into());
    save(&mut file, &entries)?;
    let directory = Directory::new()?;
    for (name, _, bytes) in assets {
        let mut target = OpenOptions::new().write(true).create_new(true).mode(0o500).open(directory.0.join(name)).map_err(io)?;
        target.write_all(bytes).map_err(io)?;
    }
    let mut result = 0;
    for (name, expected, _) in assets {
        if let Some(previous) = entries.get(*name) {
            let (_, path) = previous.split_once(':').ok_or_else(|| failure("Invalid loader registry"))?;
            let path = CString::new(unhex(path)?).map_err(|_| failure("Invalid loader path"))?;
            result = unsafe { open(&path, 2 | 4)? };
        } else {
            let path = directory.0.join(name);
            let path = CString::new(path.as_os_str().as_bytes()).map_err(|_| failure("Invalid native path"))?;
            result = unsafe { open(&path, 2 | 0x100)? };
            entries.insert((*name).into(), format!("{expected}:{}", hex(path.to_bytes())));
        }
    }
    entries.insert("runtime".into(), identity.into());
    entries.remove("failed");
    save(&mut file, &entries)?;
    Ok(result)
}
`;
