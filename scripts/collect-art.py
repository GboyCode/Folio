"""Collect a bounded, attributed snapshot of public card artwork for the local prototype."""
import json, pathlib, urllib.request, concurrent.futures

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'cards'
OUT.mkdir(parents=True, exist_ok=True)
items = []
for query in ('limit=150', 'category=other&limit=150', 'category=other&region=cn&limit=150'):
    with urllib.request.urlopen('https://card.lengziyu.cn/api/cards?' + query, timeout=30) as response:
        items += json.load(response)['items']
lookup = {c['id']: c for c in items}
chosen = ['wise','hsbc-hk-mastercard-debit','amex-platinum','revolut-standard','redotpay','etherfi-core','bybit','kast','metamask','crypto-com','coinbase','n26-standard-mastercard','monzo-mastercard','apple-card','chase-sapphire-preferred','chase-sapphire-reserve','chase-freedom-flex','chase-freedom-unlimited','capital-one-venture','capital-one-quicksilver','amex-gold','citi-double-cash','citi-custom-cash','bank-of-america-visa-debit','bank-of-america-customized-cash','wells-fargo-active-cash','discover-it-cash-back','hsbc-hk-premier-mastercard','hsbc-hk-red-credit-card','boc-hk-mastercard-debit','za-card','welab-debit-card','hang-seng-prestige-atm-card','livi-debit-mastercard','payoneer-card','trust-link-card','starling-bank-debit-card','chime-visa-debit','sofi-debit-card','bitget-wallet','infini-card','wirex','xapo-bank']
cn = [c for c in items if c.get('marketRegion') == 'cn']
seen = set()
for c in cn:
    issuer = c['issuer']
    if issuer not in seen:
        chosen.append(c['id']); seen.add(issuer)
for c in cn:
    if any(s in c['name'] for s in ['全币种', '经典白金', '环球', '长城环球', '牡丹', '龙卡']) and c['id'] not in chosen:
        chosen.append(c['id'])
    if len(chosen) >= 66: break

def collect(cid):
    c = lookup.get(cid)
    if not c or not c.get('cardImageSrc'): return None
    url = 'https://card.lengziyu.cn' + c['cardImageSrc']
    suffix = pathlib.Path(c['cardImageSrc']).suffix.lower()
    dest = OUT / (cid + suffix)
    try:
        if not dest.exists():
            req = urllib.request.Request(url, headers={'User-Agent': 'MrgCard-local-prototype/0.1'})
            with urllib.request.urlopen(req, timeout=25) as response:
                payload = response.read()
                if not response.headers.get('Content-Type', '').startswith('image/'): raise ValueError('not an image')
            dest.write_bytes(payload)
        category = 'bank' if c['category'] != 'U卡' or cid == 'wise' else 'crypto'
        return {'id':cid, 'name':c['name'], 'issuer':c['issuer'], 'type':category, 'subtype': '借记卡' if cid=='wise' else c['category'], 'network':c['suffix'], 'region':c.get('marketRegion', 'global'), 'image':'/cards/'+dest.name, 'color':c.get('surfaceColor','#30384a'), 'source':url, 'providerSource':c.get('sourceUrl',''), 'collectedAt':'2026-10-07'}
    except Exception as error:
        print('SKIP', cid, str(error))
        return None

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    results = [r for r in pool.map(collect, dict.fromkeys(chosen)) if r]
official = [
    ('icbc-junzi','工商银行牡丹君子信用卡','中国工商银行','American Express','https://v.icbc.com.cn/userfiles/resources/icbc/xinyongka/images/2024/jzk158.jpg','https://www.icbc.com.cn/page/944246882430066688.html'),
    ('abc-world','农业银行金穗悠游世界信用卡','中国农业银行','Mastercard / 银联','https://www.abchina.com/cn/CreditCard/crecardsy/rmtj/201602/W020210806378630814688.jpg','https://www.abchina.com/cn/CreditCard/'),
    ('abc-business','农业银行环球商旅信用卡','中国农业银行','Visa / 银联','https://www.abchina.com/cn/CreditCard/crecardsy/rmtj/201602/W020210806378966436769.jpg','https://www.abchina.com/cn/CreditCard/'),
]
for cid,name,issuer,network,url,provider in official:
    dest=OUT / (cid+'.jpg')
    if not dest.exists():
        with urllib.request.urlopen(url, timeout=25) as response: dest.write_bytes(response.read())
    results.append({'id':cid,'name':name,'issuer':issuer,'type':'bank','subtype':'信用卡','network':network,'region':'cn','image':'/cards/'+dest.name,'color':'#384250','source':url,'providerSource':provider,'collectedAt':'2026-10-07'})
(ROOT / 'src').mkdir(exist_ok=True)
# Preserve curated additions and their verified metadata when refreshing the original snapshot.
catalog_path = ROOT / 'src' / 'catalog.json'
existing = json.loads(catalog_path.read_text(encoding='utf-8')) if catalog_path.exists() else []
merged = {card['id']: card for card in existing}
for card in results:
    merged.setdefault(card['id'], card)
results = list(merged.values())
catalog_path.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'cards':len(results),'banks':sum(c['type']=='bank' for c in results),'crypto':sum(c['type']=='crypto' for c in results),'bytes':sum(p.stat().st_size for p in OUT.iterdir())}))
