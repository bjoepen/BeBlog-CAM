use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const DEV_ICON_PNG: &[u8] = &[
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
    0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x04, 0x00, 0x00,
    0x00, 0xb5, 0x1c, 0x0c, 0x02, 0x00, 0x00, 0x00, 0x0b, 0x49, 0x44, 0x41, 0x54, 0x78,
    0xda, 0x63, 0xfc, 0xff, 0x1f, 0x00, 0x02, 0xeb, 0x01, 0xf5, 0x8f, 0x59, 0x97, 0xdb, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
];

fn ensure_dev_icon() {
    let icon_dir = Path::new("icons");
    let icon_path = icon_dir.join("icon.png");
    if icon_path.exists() {
        return;
    }
    fs::create_dir_all(icon_dir).expect("failed to create Tauri icon directory");
    fs::write(icon_path, DEV_ICON_PNG).expect("failed to write deterministic Tauri dev icon");
}

fn main() {
    // Tauri's generated context expects the default desktop icon even when
    // bundling is disabled. Keep development and CI reproducible until the
    // final BeBlog CAM application icon is committed as a proper icon set.
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
