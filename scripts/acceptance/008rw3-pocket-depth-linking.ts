import { generateJobGcode } from '../../src/lib/jobGcode';
import { materializeSafeMotionChain } from '../../src/lib/safeMotionChain';
import {
  defaultPartOrientation,
  defaultPartPlacement,
  defaultPocketOperation,
  defaultWcs,
  type ImportSummary,
  type PlanarGeometry,
  type PocketOperation,
  type StockDefinition,
} from '../../src/lib/types';
import type { CanonicalToolpath } from '../../src/lib/canonicalToolpath';

const point=(x:number,y:number)=>({x,y});
const line=(x1:number,y1:number,x2:number,y2:number)=>({kind:'line' as const,start:point(x1,y1),end:point(x2,y2)});
const geometry:PlanarGeometry={
  curves:[line(10,10,50,10),line(50,10,50,30),line(50,30,10,30),line(10,30,10,10)],
  curveLayers:['CUT','CUT','CUT','CUT'],
  layerNames:['CUT'],
  bounds:{min:point(10,10),max:point(50,30)},
};
const summary:ImportSummary={
  kind:'dxf',fileName:'008rw3-pocket.dxf',backend:'008-RW-003 synthetic fixture',status:'ready',
  entities:{curves:geometry.curves.length},planarGeometry:geometry,
  note:'Production-path fixture for depth-level stay-down linking.',
};
const stock:StockDefinition={width:60,height:40,thickness:10,offsetX:0,offsetY:0,offsetZ:0};
const tool={...defaultPocketOperation.tool,id:'rw3-mill-4',name:'RW3 Schaftfräser 4 mm',diameterMm:4,shaftDiameterMm:4};

function operation(strategy:PocketOperation['strategy']):PocketOperation{
  return{
    ...defaultPocketOperation,
    id:`rw3-pocket-${strategy}`,
    name:`Tasche RW3 ${strategy}`,
    contourId:0,
    contourIds:[0],
    safeZMm:5,
    totalDepthMm:3,
    stepDownMm:1,
    strategy,
    entry:'plunge',
    tool,
  };
}

function runJob(strategy:PocketOperation['strategy']){
  const job=generateJobGcode({
    summary,stock,stockMode:'manual',placement:{...defaultPartPlacement},orientation:{...defaultPartOrientation},wcs:{...defaultWcs},operations:[operation(strategy)],
  });
  const lines=job.code.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const fullXyzSafeRapids=lines.filter(line=>/^G0\s+X[-+]?\d+(?:\.\d+)?\s+Y[-+]?\d+(?:\.\d+)?\s+Z5\.000$/i.test(line));
  const depthFeeds=lines.filter(line=>/^G1\s+X[-+]?\d+(?:\.\d+)?\s+Y[-+]?\d+(?:\.\d+)?\s+Z-(?:1|2|3)\.000\s+F/i.test(line));
  return{strategy,job:{ok:job.ok,errors:job.errors,warnings:job.warnings,code:job.code},fullXyzSafeRapids:fullXyzSafeRapids.length,depthFeeds:depthFeeds.length};
}

const failClosedToolpath:CanonicalToolpath={
  version:1,operationKind:'pocket',strategy:'raster',tool:{diameterMm:4},stepoverPercent:40,
  runs:[
    {kind:'cut',z:-1,points:[point(0,0),point(10,0)],retractAfter:true},
    {kind:'cut',z:-2,points:[point(0,0),point(10,0)],retractAfter:true},
  ],
};
const stayDownToolpath:CanonicalToolpath={
  ...failClosedToolpath,
  runs:[
    {kind:'cut',z:-1,points:[point(0,0),point(10,0),point(0,0)],retractAfter:false},
    {kind:'cut',z:-2,points:[point(0,0),point(10,0)],retractAfter:true},
  ],
};
const invalidOpenLink:CanonicalToolpath={...failClosedToolpath,runs:[{kind:'cut',z:-1,points:[point(0,0),point(10,0)],retractAfter:false}]};

const failClosed=materializeSafeMotionChain({toolpath:failClosedToolpath,safeZMm:5});
const stayDown=materializeSafeMotionChain({toolpath:stayDownToolpath,safeZMm:5});
const invalid=materializeSafeMotionChain({toolpath:invalidOpenLink,safeZMm:5});

console.log(JSON.stringify({
  auto:runJob('auto'),
  parallel:runJob('parallel'),
  safeMotion:{
    failClosed:{ok:failClosed.ok,rapidCount:failClosed.rapidCount,errors:failClosed.errors},
    stayDown:{ok:stayDown.ok,rapidCount:stayDown.rapidCount,errors:stayDown.errors,motions:stayDown.toolpath?.motions??[]},
    invalid:{ok:invalid.ok,errors:invalid.errors},
  },
}));
