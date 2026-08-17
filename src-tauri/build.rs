use std::env;
use std::path::PathBuf;

fn main() {
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
