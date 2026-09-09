import fs from 'node:fs';
const p='scripts/check-004z-contracts.mjs';
let s=fs.readFileSync(p,'utf8');
const anchor="requireText(planarRaster,'if(connector)','safe links remain one canonical run; unsafe links stay split for 004T Safe-Z');";
if(!s.includes(anchor))throw new Error('004Z-E gate anchor missing');
const extra=`${anchor}\nconst contourLeads=read('src/lib/contourLeads.ts');\nrejectText(contourLeads,\"operation.topology!=='closed'\",'004Z-E must not reject open STEP contours');\nrequireText(contourLeads,'function applyLeadToRun','004Z-E applies leads per canonical contour passage');\nrequireText(contourLeads,'vertical(leadStart,safeZMm,run.z)','004Z-E plunges at the tangent lead start instead of diagonally rapid-plunging');\nrequireText(contourLeads,'horizontal(leadStart,first,run.z)','004Z-E enters along the local first tangent');\nrequireText(contourLeads,'horizontal(last,leadEnd,run.z)','004Z-E exits along the local last tangent');\nrequireText(contourLeads,'vertical(leadEnd,run.z,safeZMm)','004Z-E retracts at the lead end before further rapids');\nrequireText(contourLeads,\"operation.topology==='open'?'offene':'geschlossene'\",'004Z-E reports open and closed lead semantics explicitly');`;
s=s.replace(anchor,extra);
s=s.replace("console.log('004Z PASS: STEP contours keep one canonical Bearbeiten/Prüfen/NC path; 004Z-B adds explicit preserve/clear island semantics; 004Z-C reduces raster retracts only through cutter-safe stay-down links.');","console.log('004Z PASS: STEP contours keep one canonical Bearbeiten/Prüfen/NC path; 004Z-B island semantics, 004Z-C safe stay-down links, 004Z-D curved-view caching, and 004Z-E safe tangential leads are gated.');");
fs.writeFileSync(p,s);
