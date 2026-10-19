import test from 'node:test';
import assert from 'node:assert/strict';
import { facingRegion, globeArc, globePointVisible, globeVector, globeRotation } from '../src/globe-projection.ts';
import { projectRegion } from '../src/information-geography.ts';

test('globe projection keeps a chosen region centered and its antipode behind the globe',()=>{
  const rotate=globeRotation(120*Math.PI/180,29*Math.PI/180);
  const [x,y,z]=rotate(globeVector(projectRegion(120,29)));
  assert.ok(Math.abs(x)<1e-10&&Math.abs(y)<1e-10&&Math.abs(z-1)<1e-10);
  const opposite=rotate(globeVector(projectRegion(-60,-29)));
  assert.ok(Math.abs(opposite[0])<1e-10&&Math.abs(opposite[1])<1e-10&&Math.abs(opposite[2]+1)<1e-10);
});

test('facing region follows the front hemisphere without flickering between close neighbours',()=>{
  assert.equal(facingRegion([{key:'US',depth:-.5},{key:'SG',depth:.8}],null),'SG');
  assert.equal(facingRegion([{key:'GE',depth:.78},{key:'KZ',depth:.82}],'GE'),'GE');
  assert.equal(facingRegion([{key:'GE',depth:.6},{key:'KZ',depth:.86}],'GE'),'KZ');
  assert.equal(facingRegion([{key:'US',depth:-.4},{key:'SG',depth:-.1}],'US'),'US');
  assert.equal(facingRegion([],null),null);
});

test('rotations preserve the sphere and join both edges of the flat map',()=>{
  const rotate=globeRotation(1.2,.3);
  for (const position of [[0,100],[1000,100],[500,0],[833,170]] as const) {
    assert.ok(Math.abs(Math.hypot(...rotate(globeVector(position)))-1)<1e-10);
  }
  const west=rotate(globeVector([0,100])),east=rotate(globeVector([1000,100]));
  assert.ok(Math.hypot(...west.map((value,index)=>value-east[index]))<1e-10);
});

test('connection routes end at their real anchors and remain outside the sphere',()=>{
  const end=globeVector(projectRegion(120,29));
  for (const position of [[-98,39],[104,1],[-60,-29],[120,29]] as const) {
    const start=globeVector(projectRegion(...position)),route=globeArc(start,end);
    if (!route.length) {assert.deepEqual(start,end);continue;}
    assert.deepEqual(route[0],start);assert.deepEqual(route.at(-1),end);
    assert.ok(route.every(point=>point.every(Number.isFinite)&&Math.hypot(...point)>=1-1e-10));
    for (let i=1;i<route.length;i++) assert.ok(Math.hypot(...route[i].map((value,k)=>value-route[i-1][k]))<.05);
  }
});

test('far-side lines are occluded except outside the globe silhouette',()=>{
  assert.equal(globePointVisible([0,0,-1]),false);
  assert.equal(globePointVisible([.5,.5,-.9]),false);
  assert.equal(globePointVisible([0,0,1]),true);
  assert.equal(globePointVisible([1.05,0,-.2]),true);
});
