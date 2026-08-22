import { describe, expect, it } from 'vitest';
import { createMillingTool, migrateMillingTool, toolGeometrySummary } from './toolTypes';

describe('001T milling tool model', () => {
  it('creates the four supported cutter types with their required geometry', () => {
    expect(createMillingTool('end-mill','a').kind).toBe('end-mill');
    expect(createMillingTool('ball-nose','b').kind).toBe('ball-nose');
    expect(createMillingTool('face-mill','c').kind).toBe('face-mill');
    expect(createMillingTool('v-bit','d').kind).toBe('v-bit');
  });

  it('migrates a v1 library tool to an end mill without losing cutting data', () => {
    const migrated=migrateMillingTool({id:'legacy',name:'Alt 3 mm',diameterMm:3,flutes:2,chipLoadMm:.03});
    expect(migrated?.kind).toBe('end-mill');
    expect(migrated?.diameterMm).toBe(3);
    expect(migrated?.chipLoadMm).toBe(.03);
  });

  it('derives the ball radius from diameter', () => {
    const ball=createMillingTool('ball-nose','ball');
    ball.diameterMm=8;
    expect(toolGeometrySummary(ball)).toContain('R 4 mm');
  });

  it('keeps V-bit angle, tip and maximum diameter explicit', () => {
    const bit=createMillingTool('v-bit','v');
    expect(toolGeometrySummary(bit)).toContain('60°');
    expect(toolGeometrySummary(bit)).toContain('Spitze Ø 0.2 mm');
    expect(toolGeometrySummary(bit)).toContain('max. Ø 6 mm');
  });
});
