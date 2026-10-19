import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { countries, countryCode, countryFlagCode } from '../src/countries.ts';

test('every selectable country has a corresponding local flag', () => {
  for (const country of countries.filter(country => country !== '全球')) {
    const code = countryFlagCode(country);
    assert.ok(code, `Missing country code: ${country}`);
    assert.ok(existsSync(new URL(`../node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`, import.meta.url)), `Missing flag: ${country}`);
  }
});

test('Chinese region names and common international aliases retain their region codes', () => {
  for (const [name, code] of Object.entries({'中国大陆':'CN','中国香港':'HK','中国澳门':'MO','中国台湾':'TW','臺灣':'TW','香港':'HK','Ｍａｃａｕ':'MO','美国':'US','U.S.A.':'US','United States':'US','United States of America':'US',' uk ':'GB','英国':'GB','新加坡':'SG','South Korea':'KR','阿联酋':'AE','Deutschland':undefined})) {
    assert.equal(countryCode(name), code, name);
  }
});

test('Taiwan aliases use the app China flag without changing region identity', () => {
  for (const name of ['中国台湾','中國台灣','中國臺灣','台湾','台灣','臺灣','Taiwan','TW',' tw ']) {
    assert.equal(countryFlagCode(name), 'CN', name);
    assert.equal(countryCode(name), 'TW', name);
  }
  for (const name of ['中国大陆','香港','澳门','美国','日本']) {
    assert.equal(countryFlagCode(name), countryCode(name), name);
  }
});

test('global and custom regions do not get an unrelated national flag', () => {
  for (const value of ['', '全球', 'Global', '自定义地区', '美国备用', 'USA / UK']) {
    assert.equal(countryCode(value), undefined);
    assert.equal(countryFlagCode(value), undefined);
  }
});
