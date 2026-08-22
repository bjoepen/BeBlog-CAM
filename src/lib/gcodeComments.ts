export function normalizeGcodeComments(code:string):string{
  return code
    .replace('( Konturparallele Tasche · native LINE/ARC-Offets · G1 + G2/G3 )','( Operation: Tasche )\n( Strategie: Konturparallel · native LINE/ARC-Offets · G1 + G2/G3 )')
    .replace('( Eintauchen: senkrecht · jeder Offset separat auf Safe-Z angefahren )','( Bahnmerkmal: sichere Stay-Down-Links zwischen benachbarten Offsets; sonst Safe-Z-Retract )')
    .replace('( Kreistasche · konzentrische native G2/G3-Raeumung )','( Operation: Tasche )\n( Strategie: Kreis · konzentrische native G2/G3-Raeumung )')
    .replace('( Rechtecktasche · Rasterraeumung + Wandumlauf )','( Operation: Tasche )\n( Strategie: Raster · Raeumung + Wandumlauf )')
    .replace('( Carve · DXF-Centerlines · kein seitlicher Werkzeugradius-Offset )','( Operation: Carve )\n( Strategie: DXF-Centerlines · kein seitlicher Werkzeugradius-Offset )');
}
