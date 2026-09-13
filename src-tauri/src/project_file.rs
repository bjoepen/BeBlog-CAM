use std::{
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

pub fn atomic_write(path: &Path, bytes: &[u8]) -> io::Result<()> {
    atomic_write_with_hook(path, bytes, || Ok(()))
}

fn atomic_write_with_hook<F>(path: &Path, bytes: &[u8], before_replace: F) -> io::Result<()>
where
    F: FnOnce() -> io::Result<()>,
{
    let parent = path.parent().filter(|parent| !parent.as_os_str().is_empty()).unwrap_or_else(|| Path::new("."));
    let file_name = path.file_name().and_then(|value| value.to_str()).unwrap_or("project.beblogcam");
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let temp_path = parent.join(format!(".{file_name}.tmp-{}-{nonce}", std::process::id()));

    let result = (|| -> io::Result<()> {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&temp_path)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);

        before_replace()?;
        fs::rename(&temp_path, path)?;
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_dir(name: &str) -> PathBuf {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        let dir = std::env::temp_dir().join(format!("beblog-cam-{name}-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn temp_files(dir: &Path) -> Vec<PathBuf> {
        fs::read_dir(dir)
            .unwrap()
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.file_name().and_then(|name| name.to_str()).map(|name| name.contains(".tmp-")).unwrap_or(false))
            .collect()
    }

    #[test]
    fn successful_save_replaces_existing_project() {
        let dir = test_dir("atomic-success");
        let target = dir.join("project.beblogcam");
        fs::write(&target, b"old-project").unwrap();

        atomic_write(&target, b"new-project").unwrap();

        assert_eq!(fs::read(&target).unwrap(), b"new-project");
        assert!(temp_files(&dir).is_empty());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn failure_before_replace_preserves_existing_project() {
        let dir = test_dir("atomic-failure-existing");
        let target = dir.join("project.beblogcam");
        fs::write(&target, b"known-good-project").unwrap();

        let error = atomic_write_with_hook(&target, b"partial-new-project", || {
            Err(io::Error::new(io::ErrorKind::Other, "008B6 injected failure before replace"))
        })
        .unwrap_err();

        assert!(error.to_string().contains("008B6 injected failure"));
        assert_eq!(fs::read(&target).unwrap(), b"known-good-project");
        assert!(temp_files(&dir).is_empty());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn failure_before_replace_does_not_create_new_target() {
        let dir = test_dir("atomic-failure-new");
        let target = dir.join("project.beblogcam");

        atomic_write_with_hook(&target, b"new-project", || {
            Err(io::Error::new(io::ErrorKind::Other, "008B6 injected failure before first save"))
        })
        .unwrap_err();

        assert!(!target.exists());
        assert!(temp_files(&dir).is_empty());
        let _ = fs::remove_dir_all(dir);
    }
}
