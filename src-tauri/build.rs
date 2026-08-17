use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const DEV_ICON_PNG: &[u8] = &[
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
    0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
    0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78,
    0x9c, 0x63, 0x60, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x05, 0x00, 0x01, 0xa5, 0xf6,
    0x45, 0x40, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
];

fn is_rgba_png(bytes: &[u8]) -> bool {
    bytes.len() > 25
        && bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a])
        && bytes[24] == 8
        && bytes[25] == 6
}

fn ensure_dev_icon() {
    let icon_dir = Path::new("icons");
    let icon_path = icon_dir.join("icon.png");

    if let Ok(existing) = fs::read(&icon_path) {
        if is_rgba_png(&existing) {
            return;
        }
    }

    fs::create_dir_all(icon_dir).expect("failed to create Tauri icon directory");
    fs::write(icon_path, DEV_ICON_PNG).expect("failed to write deterministic RGBA Tauri dev icon");
}

fn main() {
    ensure_dev_icon();
    tauri_build::build();

    if env::var_os("CARGO_FEATURE_OCCT_NATIVE").is_none() {
        return;
    }

    let prefix = env::var("BEBLOG_OCCT_PREFIX")
        .expect("occt-native requires BEBLOG_OCCT_PREFIX pointing to an OCCT 8 installation");
    let prefix = PathBuf::from(prefix);
    let include = prefix.join("include/opencascade");
    let lib = prefix.join("lib");

    if !include.exists() || !lib.exists() {
        panic!("BEBLOG_OCCT_PREFIX must contain include/opencascade and lib");
    }

    cc::Build::new()
        .cpp(true)
        .std("c++17")
        .file("native/occt_bridge.cpp")
        .include("native")
        .include(&include)
        .compile("beblog_occt_bridge");

    println!("cargo:rustc-link-search=native={}", lib.display());

    // macOS: make the development binary self-sufficient. Tauri/Node may not
    // preserve DYLD_LIBRARY_PATH consistently when spawning the Rust binary,
    // so embed the OCCT install directory as an rpath in native builds.
    if cfg!(target_os = "macos") {
        println!("cargo:rustc-link-arg=-Wl,-rpath,{}", lib.display());
    }

    for library in [
        "TKernel", "TKMath", "TKG2d", "TKG3d", "TKGeomBase", "TKBRep",
        "TKGeomAlgo", "TKTopAlgo", "TKMesh", "TKXSBase", "TKDE", "TKDESTEP",
    ] {
        println!("cargo:rustc-link-lib=dylib={library}");
    }
    println!("cargo:rerun-if-changed=native/occt_bridge.cpp");
    println!("cargo:rerun-if-changed=native/occt_bridge.h");
    println!("cargo:rerun-if-env-changed=BEBLOG_OCCT_PREFIX");
}
