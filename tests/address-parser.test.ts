import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAddress, applyParsedAddress } from '../src/address-parser.ts';
import { blankEntry } from '../src/types.ts';

test('Chinese field labels populate a complete address and normalize country names', () => {
  const result = parseAddress('地址名称：美国收件地址\n收件人：Example User\n国家：United States\n省/州：OR\n城市：Portland\n街道地址：123 Example Avenue\n地址补充：Suite 100\n邮编：97201\n电话：+1 202 555 0148');
  assert.deepEqual(result.fields, { name: '美国收件地址', holder: 'Example User', country: '美国', region: 'OR', city: 'Portland', line1: '123 Example Avenue', line2: 'Suite 100', postal: '97201', phone: '+1 202 555 0148' });
  assert.deepEqual(result.warnings, []);
});

test('English labels accept flexible order and optional fields', () => {
  const result = parseAddress('City: Vancouver; Country: Canada; Address Line 2: Unit 12; Postal Code: V6B 1A1; Address Line 1: 123 Example Street; State / Province: BC; Full Name: Example User');
  assert.equal(result.fields.country, '加拿大'); assert.equal(result.fields.line1, '123 Example Street');
  assert.equal(result.fields.holder, 'Example User'); assert.equal(result.fields.line2, 'Unit 12');
  assert.deepEqual(result.warnings, []);
});

test('multiline US address separates recipient, unit, city, state and ZIP+4', () => {
  const result = parseAddress('Example User\n123 Example Avenue\nSuite 100\nPortland, OR 97201-1234\nUSA\n+1 202 555 0148');
  assert.deepEqual(result.fields, { country: '美国', phone: '+1 202 555 0148', postal: '97201-1234', region: 'OR', city: 'Portland', holder: 'Example User', line1: '123 Example Avenue', line2: 'Suite 100' });
  assert.deepEqual(result.warnings, []);
});

test('a state and ZIP combination may infer US, while a lone postal code may not', () => {
  assert.equal(parseAddress('123 Example Avenue\nPortland OR 97201').fields.country, '美国');
  assert.equal(parseAddress('123 Example Avenue\n97201').fields.country, undefined);
  assert.equal(parseAddress('街道：123 Example Avenue\n省/州：OR\n邮编：97201').fields.country, '美国');
  assert.equal(parseAddress('123 Example Avenue\nPortland, Oregon 97201').fields.region, 'OR');
  assert.equal(parseAddress('123 Example Street\nNew York, New York 10001').fields.city, 'New York');
});

test('Canadian province and postal code infer Canada, even with a +1 phone', () => {
  const result = parseAddress('Example User\n123 Example Street\nToronto, ON M5V 2T6\n+1 416 555 0100');
  assert.equal(result.fields.country, '加拿大'); assert.equal(result.fields.city, 'Toronto');
  assert.equal(result.fields.region, 'ON'); assert.equal(result.fields.postal, 'M5V 2T6');
  assert.equal(result.fields.holder, 'Example User'); assert.deepEqual(result.warnings, []);
});

test('UK postcode, Australian state/postcode and Singapore locality are recognized', () => {
  const uk = parseAddress('Example User\n10 Example Street\nLondon\nSW1A 1AA\nUnited Kingdom');
  assert.equal(uk.fields.city, 'London'); assert.equal(uk.fields.postal, 'SW1A 1AA'); assert.equal(uk.fields.country, '英国');
  const au = parseAddress('Example User\n123 Example Road\nSydney NSW 2000\nAustralia');
  assert.equal(au.fields.city, 'Sydney'); assert.equal(au.fields.region, 'NSW'); assert.equal(au.fields.country, '澳大利亚');
  const sg = parseAddress('Example User\n123 Example Road\n#01-02\nSingapore 123456');
  assert.equal(sg.fields.country, '新加坡'); assert.equal(sg.fields.postal, '123456'); assert.equal(sg.fields.line2, '#01-02');
});

test('Chinese full addresses retain district and building details', () => {
  for (const raw of ['张三，13800138000，广东省深圳市南山区示例路18号8楼，518000', '张三 13800138000 广东省深圳市南山区示例路18号8楼\n518000']) {
    const result = parseAddress(raw);
    assert.equal(result.fields.country, '中国大陆'); assert.equal(result.fields.region, '广东省');
    assert.equal(result.fields.city, '深圳市'); assert.equal(result.fields.line1, '南山区示例路18号8楼');
    assert.equal(result.fields.holder, '张三'); assert.equal(result.fields.phone, '13800138000'); assert.equal(result.fields.postal, '518000');
    assert.deepEqual(result.warnings, []);
  }
});

test('municipalities, autonomous regions and Hong Kong do not lose administrative details', () => {
  const beijing = parseAddress('地址：北京市朝阳区示例路18号');
  assert.equal(beijing.fields.region, '北京市'); assert.equal(beijing.fields.city, '北京市'); assert.equal(beijing.fields.line1, '朝阳区示例路18号');
  const guangxi = parseAddress('地址：广西壮族自治区南宁市青秀区示例路18号');
  assert.equal(guangxi.fields.region, '广西壮族自治区'); assert.equal(guangxi.fields.city, '南宁市');
  const hk = parseAddress('收件人：张三\n地址：中国香港九龙观塘区示例道18号8楼A室');
  assert.equal(hk.fields.country, '中国香港'); assert.equal(hk.fields.line1, '九龙观塘区示例道18号8楼A室');
});

test('explicit country takes precedence over a conflicting locality pattern', () => {
  const result = parseAddress('Country: Canada\n123 Example Street\nPortland, OR 97201');
  assert.equal(result.fields.country, '加拿大'); assert.equal(result.fields.region, undefined);
  assert.match(result.fields.line2!, /OR 97201/);
  assert(result.warnings.some(message => message.includes('可能不一致')));
});

test('ambiguous input preserves original fragments and does not invent a country', () => {
  const result = parseAddress('Example User\nUnknown locality\nPhone: +1 202 555 0148');
  assert.equal(result.fields.country, undefined); assert.equal(result.fields.line1, undefined);
  assert.deepEqual(result.unparsed, ['Example User', 'Unknown locality']); assert(result.warnings.length >= 2);
});

test('duplicates and oversized fields are surfaced instead of silently discarded', () => {
  const duplicate = parseAddress('国家：美国\n国家：加拿大\n街道：123 Example Street');
  assert.equal(duplicate.fields.country, '美国'); assert(duplicate.unparsed.includes('加拿大')); assert(duplicate.warnings.length);
  const long = parseAddress(`国家：美国\n街道：${'a'.repeat(301)}`);
  assert.equal(long.fields.line1, undefined); assert(long.unparsed.includes('a'.repeat(301)));
  assert.deepEqual(parseAddress('x'.repeat(4001)).fields, {});
  assert.deepEqual(parseAddress(' ').fields, {});
});

test('applying parsed data fills blanks, keeps existing values, and requires explicit overwrite', () => {
  const original = { ...blankEntry('address'), name: '常用地址', country: '中国香港', holder: '原收件人', line2: '原房间号', postal: '00000', notes: '原备注', mapUrl: 'https://maps.app.goo.gl/OriginalLocation' };
  const fields = { country: '美国', holder: 'Example User', city: 'Portland', line1: '123 Example Avenue' };
  const filled = applyParsedAddress(original, fields);
  assert.equal(filled.country, '中国香港'); assert.equal(filled.holder, '原收件人'); assert.equal(filled.line1, fields.line1);
  assert.equal(filled.mapUrl, original.mapUrl);
  const replaced = applyParsedAddress(original, { ...fields, name: '新名字' }, true);
  assert.equal(replaced.country, '美国'); assert.equal(replaced.holder, fields.holder); assert.equal(replaced.name, '常用地址'); assert.equal(replaced.notes, '原备注');
  assert.equal(replaced.line2, ''); assert.equal(replaced.postal, '');
  assert.equal(replaced.mapUrl, '');
  assert.equal(original.line1, '');
  assert.equal(applyParsedAddress(blankEntry('address'), fields).name, 'Portland收件地址');
});
