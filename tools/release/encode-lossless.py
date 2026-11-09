"""Generate delivery copies only. Source images remain byte-for-byte unchanged."""
import concurrent.futures, hashlib, json, pathlib, sys, time
from PIL import Image

root = pathlib.Path(sys.argv[1]).resolve()
evidence = root / 'previews/lossless-package-20261110'
evidence.mkdir(parents=True, exist_ok=True)
source_manifest = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path(__file__).with_name('lossless-sources.json')
manifest = json.loads(source_manifest.read_text(encoding='utf-8-sig'))
destination = root / 'assets/room-delivery-v52/lossless'
destination.mkdir(parents=True, exist_ok=True)
digest = lambda data: hashlib.sha256(data).hexdigest()

def encode(record):
    source = root / record['file']
    before = source.read_bytes()
    assert digest(before) == record['sha256'], record['file']
    target = destination / (record['sha256'] + '.webp')
    with Image.open(source) as image:
        rgba = image.convert('RGBA')
        if not target.exists():
            rgba.save(target, 'WEBP', lossless=True, quality=100, method=4, exact=True)
        with Image.open(target) as result:
            assert result.size == rgba.size and result.convert('RGBA').tobytes() == rgba.tobytes(), record['file']
        dimensions = rgba.size
    after = target.read_bytes()
    assert source.read_bytes() == before
    row = {'source': record['file'], 'sourceSha256': digest(before), 'file': target.relative_to(root).as_posix(), 'sha256': digest(after), 'sourceBytes': len(before), 'bytes': len(after), 'rgbaIdentical': True, 'dimensions': dimensions, 'selected': len(after) < len(before)}
    return row

records = [r for r in manifest['images'] if r['mime'] == 'image/png']
results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    for row in executor.map(encode, records):
        results.append(row)
        print(json.dumps({'done':len(results),'total':len(records),'source':row['source'],'savedBytes':row['sourceBytes']-row['bytes']}), flush=True)
mapping = {r['source']: {k:r[k] for k in ['file','sourceSha256','sha256']} for r in results if r['selected']}
(root / 'assets/room-delivery-v52/lossless-map.json').write_text(json.dumps(mapping,indent=2), encoding='utf-8')
(evidence / 'conversion.json').write_text(json.dumps({'images':results,'count':len(results),'selected':len(mapping),'allRgbaIdentical':True,'savedBytes':sum(r['sourceBytes']-r['bytes'] for r in results if r['selected'])},indent=2),encoding='utf-8')
