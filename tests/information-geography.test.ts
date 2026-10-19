import test from 'node:test';
import assert from 'node:assert/strict';
import { blankEntry } from '../src/types.ts';
import { groupInformationRegions, clusterMapRegions } from '../src/information-geography.ts';

test('country aliases combine records across all four information types',()=>{
  const entries = [
    {...blankEntry('bank'),country:'美国'}, {...blankEntry('crypto'),country:'USA'},
    {...blankEntry('sim'),country:'United States'}, {...blankEntry('address'),country:' US '},
  ];
  const groups = groupInformationRegions(entries);
  assert.equal(groups.length,1);
  assert.equal(groups[0].code,'US');
  assert.equal(groups[0].entries.length,4);
  assert.deepEqual(groups[0].counts,{bank:1,crypto:1,sim:1,address:1});
  assert.ok(groups[0].position && groups[0].position[0]<500);
  assert.equal(entries[1].country,'USA');
});

test('global and unknown values retain records without invented map coordinates',()=>{
  const groups = groupInformationRegions(['全球','Global','自定义地区',''].map(country=>({...blankEntry('address'),country})));
  assert.equal(groups.length,3);
  assert.equal(groups.find(group=>group.key==='global')?.entries.length,2);
  assert.ok(groups.every(group=>!group.position));
  assert.deepEqual(clusterMapRegions(groups,800),[]);
  assert.deepEqual(groupInformationRegions([]),[]);
});

test('flag presentation does not merge distinct region positions',()=>{
  const groups = groupInformationRegions(['中国大陆','中国香港','中国澳门','中国台湾','Taiwan'].map(country=>({...blankEntry('sim'),country})));
  assert.equal(groups.length,4);
  assert.equal(groups.find(group=>group.code==='TW')?.entries.length,2);
  assert.ok(groups.every(group=>group.position));
  assert.equal(new Set(groups.map(group=>group.position?.join(','))).size,4);
});

test('responsive clusters preserve every region and record',()=>{
  const groups = groupInformationRegions(['香港','澳门','英国','法国','美国','日本'].map(country=>({...blankEntry('bank'),country})));
  for (const width of [320,800,1400]) {
    const clusters = clusterMapRegions(groups,width);
    assert.deepEqual(clusters.flatMap(cluster=>cluster.regions.map(group=>group.key)).sort(),groups.map(group=>group.key).sort());
    assert.equal(clusters.flatMap(cluster=>cluster.regions).reduce((sum,group)=>sum+group.entries.length,0),6);
    assert.ok(clusters.every(cluster=>Number.isFinite(cluster.x)&&Number.isFinite(cluster.y)));
  }
  assert.ok(clusterMapRegions(groups,320).length<groups.length);
});
