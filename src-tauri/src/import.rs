use crate::geometry::{Curve2, PlanarGeometry, Point2};
use crate::occt::{BrepBackend, BrepSummary, Occt8Backend};
use dxf::entities::EntityType;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, io::{Read, Write}, path::{Path, PathBuf}, sync::atomic::{AtomicU64, Ordering}};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary { pub kind:String,pub file_name:String,pub backend:String,pub status:String,pub entities:BTreeMap<String,usize>,pub planar_geometry:Option<PlanarGeometry>,pub brep:Option<BrepSummary>,pub note:Option<String>,pub source_fingerprint:String,pub source_content_sha256:Option<String> }

pub(crate) fn source_fingerprint(path:&Path)->Result<String,String>{
 let bytes=std::fs::read(path).map_err(|e|format!("Quelldatei konnte für die Identitätsprüfung nicht gelesen werden: {e}"))?;
 let mut hash:u64=0xcbf29ce484222325;
 for byte in &bytes{hash^=u64::from(*byte);hash=hash.wrapping_mul(0x100000001b3);}
 Ok(format!("src-v1:{hash:016x}:{}",bytes.len()))
}

pub fn inspect(path:&str)->Result<ImportSummary,String>{let path=Path::new(path);let file_name=path.file_name().and_then(|v|v.to_str()).unwrap_or("Bauteil").to_string();let ext=path.extension().and_then(|v|v.to_str()).unwrap_or("").to_ascii_lowercase();let fingerprint=source_fingerprint(path)?;match ext.as_str(){"dxf"=>inspect_dxf(path,file_name,fingerprint),"step"|"stp"=>{inspect_step_consistent(path,file_name,fingerprint)},_=>Err("BeBlog CAM unterstützt STEP/STP und DXF.".into())}}

fn source_sha256(path:&Path)->Result<String,String>{
 let mut file=std::fs::File::open(path).map_err(|e|format!("STEP-Quelldatei konnte für SHA-256 nicht geöffnet werden: {e}"))?;
 let mut hasher=Sha256::new();
 std::io::copy(&mut file,&mut hasher).map_err(|e|format!("STEP-Quelldatei konnte für SHA-256 nicht gelesen werden: {e}"))?;
 Ok(format!("{:x}",hasher.finalize()))
}

#[cfg(test)]
mod sha256_tests {
 use super::*;
 #[test]
 fn known_sha256_vector() {
  let mut hasher=Sha256::new();
  hasher.update(b"abc");
  assert_eq!(format!("{:x}",hasher.finalize()),"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
 }

 #[test]
 fn source_change_during_step_inspection_is_rejected() {
  let path=std::env::temp_dir().join(format!("beblog-011e3-change-{}-{:?}.step",std::process::id(),std::thread::current().id()));
  std::fs::write(&path,b"original").expect("create source");
  let fingerprint=source_fingerprint(&path).expect("initial fingerprint");
  let result=verify_step_source(&path,&fingerprint,|_|{
   std::fs::write(&path,b"modified").expect("modify source during inspection");
  });
  std::fs::remove_file(&path).expect("cleanup source");
  assert!(result.is_err(),"modified STEP must not be accepted");
 }

 #[test]
 fn source_change_before_step_inspection_is_rejected() {
  let path=std::env::temp_dir().join(format!("beblog-011e3-early-{}-{:?}.step",std::process::id(),std::thread::current().id()));
  std::fs::write(&path,b"original").expect("create source");
  let fingerprint=source_fingerprint(&path).expect("capture initial fingerprint");
  std::fs::write(&path,b"changed-before-hash").expect("mutate source before SHA-256");
  let result=verify_step_source(&path,&fingerprint,|digest|digest.len());
  std::fs::remove_file(&path).expect("cleanup source");
  assert!(result.is_err(),"source modified after initial fingerprint must be rejected");
 }

 #[test]
 fn stable_step_source_is_accepted() {
  let path=std::env::temp_dir().join(format!("beblog-011e3-stable-{}-{:?}.step",std::process::id(),std::thread::current().id()));
  std::fs::write(&path,b"stable").expect("create source");
  let fingerprint=source_fingerprint(&path).expect("initial fingerprint");
  let result=verify_step_source(&path,&fingerprint,|digest|digest.len());
  std::fs::remove_file(&path).expect("cleanup source");
  assert_eq!(result.expect("unchanged source"),64);
 }

 #[test]
 fn snapshot_identity_matches_original_and_cleans_up() {
  let path=std::env::temp_dir().join(format!("beblog-011e4b-source-{}-{:?}.step",std::process::id(),std::thread::current().id()));
  std::fs::write(&path,b"ISO-10303-21;\\nDATA;\\nENDSEC;").expect("create source");
  let snapshot=step_snapshot(&path).expect("snapshot");
  assert_eq!(snapshot.fingerprint,source_fingerprint(&path).unwrap());
  assert_eq!(snapshot.sha256,source_sha256(&path).unwrap());
  assert_eq!(std::fs::read(&snapshot.path).unwrap(),std::fs::read(&path).unwrap());
  let snapshot_path=snapshot.path.clone();
  drop(snapshot);
  assert!(!snapshot_path.exists(),"snapshot must be cleaned up");
  std::fs::remove_file(&path).unwrap();
 }

 #[test]
 fn snapshot_isolated_from_original_mutation() {
  let path=std::env::temp_dir().join(format!("beblog-011e4b-mutation-{}-{:?}.stp",std::process::id(),std::thread::current().id()));
  std::fs::write(&path,b"before").unwrap();
  let snapshot=step_snapshot(&path).unwrap();
  std::fs::write(&path,b"after").unwrap();
  assert_eq!(std::fs::read(&snapshot.path).unwrap(),b"before");
  assert_ne!(snapshot.sha256,source_sha256(&path).unwrap());
  std::fs::remove_file(&path).unwrap();
 }

 #[test]
 fn source_sha256_hashes_file_contents() {
  use std::io::Write;
  let path = std::env::temp_dir().join(format!("beblog-011e2-sha256-{}-{:?}.step", std::process::id(), std::thread::current().id()));
  let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&path).expect("create unique temporary STEP");
  file.write_all(b"abc").expect("write source bytes");
  file.flush().expect("flush source bytes");
  drop(file);
  let digest = source_sha256(&path);
  std::fs::remove_file(&path).expect("remove temporary STEP");
  assert_eq!(digest.expect("hash temporary STEP"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
 }
}

// 011-E3: reject ordinary source mutations between the pre-import hash and
// the post-import verification. This is not an atomic file snapshot: a source
// that changes and returns to identical bytes can still evade detection.
fn verify_step_source<T>(path:&Path,expected_fingerprint:&str,inspect:impl FnOnce(&str)->T)->Result<T,String>{
 let before=source_sha256(path)?;
 let result=inspect(&before);
 let after=source_sha256(path)?;
 if before!=after || source_fingerprint(path)?!=expected_fingerprint {
  return Err("STEP-Quelldatei wurde während des Imports verändert. Import verworfen; Datei erneut laden.".into());
 }
 Ok(result)
}

static SNAPSHOT_SEQUENCE: AtomicU64 = AtomicU64::new(0);

struct StepSnapshot { path: PathBuf, fingerprint: String, sha256: String }
impl Drop for StepSnapshot { fn drop(&mut self) { let _ = std::fs::remove_file(&self.path); } }

fn step_snapshot(source: &Path) -> Result<StepSnapshot,String> {
 let extension=source.extension().and_then(|v|v.to_str()).unwrap_or("step");
 let mut input=std::fs::File::open(source).map_err(|e|format!("STEP-Quelldatei konnte nicht geöffnet werden: {e}"))?;
 let mut snapshot=None;
 for _ in 0..32 {
  let sequence=SNAPSHOT_SEQUENCE.fetch_add(1,Ordering::Relaxed);
  let path=std::env::temp_dir().join(format!("beblog-step-{}-{}-{}.{}",std::process::id(),sequence,std::thread::current().name().unwrap_or("import").replace(|c:char|!c.is_ascii_alphanumeric(),""),extension));
  match std::fs::OpenOptions::new().write(true).create_new(true).open(&path) {
   Ok(file)=>{snapshot=Some((path,file));break;},
   Err(e) if e.kind()==std::io::ErrorKind::AlreadyExists=>continue,
   Err(e)=>return Err(format!("STEP-Snapshot konnte nicht angelegt werden: {e}")),
  }
 }
 let (path,mut output)=snapshot.ok_or("STEP-Snapshot: kein freier temporärer Dateiname")?;
 let mut guard=StepSnapshot{path,fingerprint:String::new(),sha256:String::new()};
 let mut sha=Sha256::new();let mut fnv:u64=0xcbf29ce484222325;let mut len=0u64;
 let mut buffer=[0u8;65536];
 loop {
  let n=input.read(&mut buffer).map_err(|e|format!("STEP-Quelle konnte nicht gelesen werden: {e}"))?;
  if n==0 {break;}
  len=len.checked_add(n as u64).ok_or("STEP-Quelle zu groß")?;
  sha.update(&buffer[..n]);
  for byte in &buffer[..n] {fnv^=u64::from(*byte);fnv=fnv.wrapping_mul(0x100000001b3);}
  output.write_all(&buffer[..n]).map_err(|e|format!("STEP-Snapshot konnte nicht geschrieben werden: {e}"))?;
 }
 output.flush().map_err(|e|format!("STEP-Snapshot konnte nicht abgeschlossen werden: {e}"))?;
 drop(output);
 guard.fingerprint=format!("src-v1:{fnv:016x}:{len}");
 guard.sha256=format!("{:x}",sha.finalize());
 Ok(guard)
}

fn inspect_step_consistent(path:&Path,file_name:String,expected_fingerprint:String)->Result<ImportSummary,String>{
 let snapshot=step_snapshot(path)?;
 if snapshot.fingerprint!=expected_fingerprint {return Err("STEP-Quelldatei wurde vor der Snapshot-Erstellung verändert. Import verworfen.".into());}
 let result=inspect_step(&snapshot.path,file_name,snapshot.fingerprint.clone(),snapshot.sha256.clone());
 if source_fingerprint(path)?!=snapshot.fingerprint || source_sha256(path)?!=snapshot.sha256 {
  return Err("STEP-Quelldatei wurde während des Imports verändert. Import verworfen; Datei erneut laden.".into());
 }
 result
}


fn inspect_step(path:&Path,file_name:String,source_fingerprint:String,source_content_sha256:String)->Result<ImportSummary,String>{match Occt8Backend.inspect_step(path){Ok(brep)=>{let mut entities=BTreeMap::new();entities.insert("Flächen".into(),brep.faces);entities.insert("Kanten".into(),brep.edges);entities.insert("Volumenkörper".into(),brep.solids);let note=brep.note.clone();let backend=brep.backend.clone();Ok(ImportSummary{kind:"step".into(),file_name,backend,status:"ready".into(),entities,planar_geometry:None,brep:Some(brep),note:Some(note),source_fingerprint,source_content_sha256:Some(source_content_sha256.clone())})},Err(note)=>Ok(ImportSummary{kind:"step".into(),file_name,backend:"OCCT 8 / BRep".into(),status:"native-adapter-pending".into(),entities:BTreeMap::new(),planar_geometry:None,brep:None,note:Some(note),source_fingerprint,source_content_sha256:Some(source_content_sha256)})}}

fn inspect_dxf(path:&Path,file_name:String,source_fingerprint:String)->Result<ImportSummary,String>{
 let drawing=dxf::Drawing::load_file(path).map_err(|e|format!("DXF konnte nicht gelesen werden: {e}"))?;
 let mut counts=BTreeMap::new();let mut curves=Vec::new();let mut curve_layers=Vec::new();let mut ignored_zero_lines=0usize;
 for entity in drawing.entities(){let layer=if entity.common.layer.is_empty(){"0".to_string()}else{entity.common.layer.clone()};match &entity.specific{
  EntityType::Line(line)=>{*counts.entry("Linien".into()).or_insert(0)+=1;let dx=line.p2.x-line.p1.x;let dy=line.p2.y-line.p1.y;if dx.hypot(dy)<=1e-9{ignored_zero_lines+=1;continue;}curves.push(Curve2::Line{start:Point2{x:line.p1.x,y:line.p1.y},end:Point2{x:line.p2.x,y:line.p2.y}});curve_layers.push(layer);}
  EntityType::Circle(circle)=>{*counts.entry("Kreise".into()).or_insert(0)+=1;curves.push(Curve2::Circle{center:Point2{x:circle.center.x,y:circle.center.y},radius:circle.radius});curve_layers.push(layer);}
  EntityType::Arc(arc)=>{*counts.entry("Bögen".into()).or_insert(0)+=1;curves.push(Curve2::Arc{center:Point2{x:arc.center.x,y:arc.center.y},radius:arc.radius,start_angle_deg:arc.start_angle,end_angle_deg:arc.end_angle});curve_layers.push(layer);}
  EntityType::LwPolyline(polyline)=>{*counts.entry("Polylinien".into()).or_insert(0)+=1;let points:Vec<Point2>=polyline.vertices.iter().map(|p|Point2{x:p.x,y:p.y}).collect();let bulges:Vec<f64>=polyline.vertices.iter().map(|p|p.bulge).collect();let bulge_count=bulges.iter().filter(|b|b.abs()>1e-12).count();if bulge_count>0{*counts.entry("Polyline-Bögen".into()).or_insert(0)+=bulge_count;}curves.push(Curve2::Polyline{points,closed:polyline.is_closed(),bulges});curve_layers.push(layer);}
  other=>{let source_kind=format!("{other:?}").split([' ','{','(']).next().unwrap_or("Entity").to_string();*counts.entry(format!("Weitere: {source_kind}")).or_insert(0)+=1;}
 }}
 if ignored_zero_lines>0{counts.insert("Null-Linien ignoriert".into(),ignored_zero_lines);}counts.insert("Layer".into(),drawing.layers().count());
 Ok(ImportSummary{kind:"dxf".into(),file_name,backend:"dxf-rs → BeBlog Geometry".into(),status:"ready".into(),entities:counts,planar_geometry:Some(PlanarGeometry::from_curves_with_layers(curves,curve_layers)),brep:None,note:Some("DXF-Elemente wurden in das interne planare BeBlog-Geometriemodell normalisiert. Die originale Layer-Zuordnung bleibt erhalten, damit offene Geometrien für Carve-Operationen gezielt und gesammelt ausgewählt werden können.".into()),source_fingerprint,source_content_sha256:None})
}