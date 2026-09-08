import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const path='src/lib/jobPreflight.ts';
const previous=execFileSync('git',['show','aa0eeabab514bf750f0fd5bc6c1d39048729d9e3^:'+path],{encoding:'utf8'});
const from="buildStepContourOperationState({summary,stock,stockMode,placement,orientation,wcs,operation})";
const to="buildStepContourOperationState({summary,stock,stockMode,placement,orientation,wcs,operation,previousToolpaths:stockSimulationOperations.map(entry=>entry.toolpath)})";
if(!previous.includes(from))throw new Error('STEP contour preflight anchor missing');
fs.writeFileSync(path,previous.replace(from,to));
console.log('004Z preflight repaired and rest-stock history connected.');
