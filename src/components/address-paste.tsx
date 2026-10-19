import { useId, useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import type { Entry } from '../types';
import { applyParsedAddress, parseAddress } from '../address-parser';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

export function AddressPaste({ entry, onApply, disabled }: { entry: Entry; onApply: (entry: Entry) => void; disabled: boolean }) {
  const id = useId();
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [unparsed, setUnparsed] = useState<string[]>([]);
  const hasValues = [entry.holder, entry.phone, entry.country, entry.city, entry.region, entry.line1, entry.line2, entry.postal].some(value => value.trim());
  const recognize = () => {
    const result = parseAddress(text);
    const next = applyParsedAddress(entry, result.fields, overwrite);
    const changed = (['holder', 'phone', 'country', 'region', 'city', 'line1', 'line2', 'postal', 'mapUrl'] as const).filter(key => next[key] !== entry[key]).length;
    const skipped = Object.keys(result.fields).filter(key => {
      const field = key as keyof typeof result.fields;
      return entry[field].trim() && next[field] !== result.fields[field];
    }).length;
    if (changed || next.name !== entry.name) onApply(next);
    setFeedback([
      ...(changed ? [`已填入 ${changed} 项，请核对。`] : []),
      ...(entry.mapUrl && !next.mapUrl ? ['原地图链接已清除。'] : []),
      ...(skipped ? [`保留了 ${skipped} 项已有内容。`] : []),
      ...result.warnings,
      ...(!changed && !skipped && !result.warnings.length ? ['内容未变。'] : []),
    ]);
    setUnparsed(result.unparsed);
    setOverwrite(false);
  };
  return <details className="address-paste full" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary><ClipboardPaste size={16}/>粘贴识别地址</summary>
    <div className="address-paste-body">
      <label htmlFor={id}>完整地址</label>
      <Textarea id={id} value={text} rows={3} maxLength={4000} disabled={disabled}
        placeholder="粘贴一条完整地址"
        onChange={event => { setText(event.target.value); setFeedback([]); setUnparsed([]); }}/>
      <div className="address-paste-actions">
        <Button type="button" variant="outline" disabled={disabled || !text.trim()} onClick={recognize}>识别并填入</Button>
      </div>
      {hasValues && <label className="checkbox-label"><input type="checkbox" checked={overwrite} disabled={disabled} onChange={event => setOverwrite(event.target.checked)}/>覆盖地址字段，保留名称</label>}
      {feedback.length > 0 && <div className="address-paste-feedback" role="status">{feedback.map(message => <p key={message}>{message}</p>)}{unparsed.length > 0 && <p className="address-unparsed">未填入：{unparsed.join('；')}</p>}</div>}
      <details className="address-format"><summary>格式示例</summary><pre>{'收件人：Example User\n国家：美国\n省/州：OR\n城市：Portland\n街道地址：123 Example Avenue\n地址补充：Suite 100\n邮编：97201\n电话：+1 202 555 0148'}</pre></details>
    </div>
  </details>;
}
