#!/usr/bin/env python3
"""Makes the pixel art for Planeswalker's Ascent with the Retro Diffusion API.

Reads docs/ascent-art-manifest.json (written by `node tests/ascent_art_guide.js`) and writes PNGs to spellslinger/art/.
The key is read from the RD_API_KEY environment variable and is never saved anywhere.

  python3 tools/make_art.py                      free dry run: checks styles and lists every step with its cost
  python3 tools/make_art.py --go --only t1-mick  make one character
  python3 tools/make_art.py --go                 make every character and in-game effect that is missing

Needs: requests, Pillow.
"""
import argparse, base64, io, json, os, sys, time, uuid
from pathlib import Path

try:
    import requests
    from PIL import Image, ImageSequence
except ImportError:
    sys.exit('Needs requests and Pillow:  pip install requests pillow')

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'docs' / 'ascent-art-manifest.json'
CACHE = ROOT / 'tools' / '.art-cache'
API = os.environ.get('RD_API_BASE', 'https://api.retrodiffusion.ai/v2')
# What each style costs per image (USD), from the API notes of 2026-09. check_cost is the real answer; this is a fallback.
PRICE = {'rd_pro': 0.18, 'rd_plus': 0.06, 'rd_fast': 0.03, 'rd_advanced_animation__idle': 0.14,
         'rd_advanced_animation__custom_action': 0.25, 'rd_animation__vfx': 0.07}


class Api:
    def __init__(self, key):
        self.s = requests.Session()
        self.s.headers['X-RD-Token'] = key

    def call(self, method, path, **kw):
        r = self.s.request(method, API + path, timeout=120, **kw)
        try:
            data = r.json()
        except ValueError:
            data = {'raw': r.text[:300]}
        if r.status_code >= 400:
            err = (data.get('error') or {}) if isinstance(data, dict) else {}
            raise RuntimeError(f'{method} {path} -> {r.status_code} {err.get("code", "")}: {err.get("message", data)}')
        return data

    def run(self, body, idem):
        """Submit one generation, wait for it and return the raw bytes of every image."""
        acc = self.call('POST', '/inferences', json=body, headers={'Idempotency-Key': idem})
        tid = acc['task_id']
        for _ in range(300):
            time.sleep(2)
            t = self.call('GET', f'/inferences/tasks/{tid}')
            if t['status'] == 'succeeded':
                res = t['result']
                out = [base64.b64decode(b) for b in res.get('base64_images') or []]
                for u in res.get('output_urls') or []:
                    out.append(requests.get(u, timeout=120).content)
                if not out:
                    raise RuntimeError('the task succeeded but returned no images')
                return out
            if t['status'] == 'failed':
                raise RuntimeError('generation failed: ' + json.dumps(t.get('error')))
        raise RuntimeError('timed out waiting for ' + tid)


def b64(img_bytes):
    return base64.b64encode(img_bytes).decode()


def blank_png(w, h):
    buf = io.BytesIO()
    Image.new('RGB', (w, h), (128, 128, 128)).save(buf, 'PNG')
    return buf.getvalue()


def frames_of(data):
    """All frames of a GIF or PNG as RGBA images."""
    im = Image.open(io.BytesIO(data))
    return [f.convert('RGBA') for f in ImageSequence.Iterator(im)]


def key_background(img):
    """If a frame has no transparent pixel, treat its corner color as the background."""
    px = img.load()
    w, h = img.size
    if any(px[x, y][3] < 255 for x in range(w) for y in range(h)):
        return img
    bg = px[0, 0]
    out = img.copy()
    o = out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][:3] == bg[:3]:
                o[x, y] = (0, 0, 0, 0)
    return out


def pick(frames, n):
    """n frames spread evenly across the list."""
    if len(frames) <= n:
        return (frames * n)[:n] if len(frames) < n else frames
    return [frames[round(i * (len(frames) - 1) / (n - 1))] if n > 1 else frames[0] for i in range(n)]


def fit(img, w, h):
    """Place a frame on a w x h canvas: scale by whole steps with hard pixels, centered, feet on the bottom edge."""
    if img.size == (w, h):
        return img
    k = max(1, min(w // img.width, h // img.height)) if img.width < w and img.height < h else 1
    if k > 1:
        img = img.resize((img.width * k, img.height * k), Image.NEAREST)
    if img.size != (w, h):
        if img.width > w or img.height > h:
            img = img.resize((w, h), Image.NEAREST)
        canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        canvas.paste(img, ((w - img.width) // 2, h - img.height), img)
        img = canvas
    return img


def step_body(asset, step, seed, input_png):
    body = {'prompt': step['prompt'], 'prompt_style': step['style'], 'width': step['width'], 'height': step['height'],
            'num_images': 1, 'seed': seed}
    if step.get('remove_bg'):
        body['remove_bg'] = True
    if step.get('frames_duration'):
        body['frames_duration'] = step['frames_duration']
    if input_png is not None:
        body['input_image'] = b64(input_png)
    return body


def estimate(api, asset, step, seed, input_png):
    body = step_body(asset, step, seed, input_png if input_png is not None else (blank_png(step['width'], step['height']) if step.get('from') else None))
    body['check_cost'] = True
    r = api.call('POST', '/inferences', json=body)
    for k in ('balance_cost', 'cost', 'total_cost', 'price'):
        if isinstance(r.get(k), (int, float)):
            return float(r[k])
    for pre, v in PRICE.items():
        if step['style'].startswith(pre) or step['style'] == pre:
            return v
    return 0.0


def load_state(d):
    p = d / 'state.json'
    return json.loads(p.read_text()) if p.exists() else {}


def save_state(d, st):
    (d / 'state.json').write_text(json.dumps(st, indent=1))


def build_output(asset, steps_png):
    fw, fh = asset['frame']
    if asset['kind'] == 'sheet':
        idle = pick([key_background(f) for f in frames_of(steps_png['idle'])], asset['cols'])
        talk = pick([key_background(f) for f in frames_of(steps_png['talk'])], asset['cols'])
        sheet = Image.new('RGBA', (fw * asset['cols'], fh * asset['rows']), (0, 0, 0, 0))
        for r, row in enumerate((idle, talk)):
            for c, f in enumerate(row):
                sheet.paste(fit(f, fw, fh), (c * fw, r * fh))
        return sheet
    fr = pick([key_background(f) for f in frames_of(steps_png['gen'])], asset['frames'])
    strip = Image.new('RGBA', (fw * asset['frames'], fh), (0, 0, 0, 0))
    for i, f in enumerate(fr):
        strip.paste(fit(f, fw, fh), (i * fw, 0))
    return strip


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--go', action='store_true', help='really generate (spends money); without it, only a free dry run')
    ap.add_argument('--group', default='characters,fx,packs,site', help='characters, fx, packs, site, site-fall, ideas, icons (comma list; default characters,fx,packs,site)')
    ap.add_argument('--only', default='', help='comma list of asset ids')
    ap.add_argument('--max-spend', type=float, default=20.0, help='stop before spending more than this many dollars in this run')
    ap.add_argument('--force', action='store_true', help='redo assets whose PNG already exists')
    ap.add_argument('--redo', default='', help='comma list of step names (base, idle, talk, gen) to make again for the chosen assets, keeping the other steps; use with --seed-bump for a different result')
    ap.add_argument('--seed-bump', type=int, default=0, help='added to every seed, for a different look from the same prompt')
    a = ap.parse_args()

    key = os.environ.get('RD_API_KEY', '').strip()
    if not key.startswith('rdpk-'):
        sys.exit('Set RD_API_KEY to your Retro Diffusion key first:  export RD_API_KEY=rdpk-...')
    api = Api(key)
    man = json.loads(MANIFEST.read_text())
    groups = {g.strip() for g in a.group.split(',') if g.strip()}
    only = {o.strip() for o in a.only.split(',') if o.strip()}
    redo = {o.strip() for o in a.redo.split(',') if o.strip()}
    assets = [x for x in man['assets'] if x['group'] in groups and (not only or x['id'] in only)]
    if not assets:
        sys.exit('Nothing matches --group / --only.')

    # Preflight: the service is up, the styles exist and the sizes are inside their limits
    try:
        st = requests.get(API + '/status', timeout=30).json().get('status', {})
        bad = [k for k, v in st.items() if v != 'ok']
        if bad:
            print('Service status is not ok for:', ', '.join(bad))
    except Exception as e:
        print('(could not read /status:', e, ')')
    sel = api.call('GET', '/styles/selector')
    items = sel if isinstance(sel, list) else next((v for v in sel.values() if isinstance(v, list)), [])
    styles = {i['prompt_style']: i for i in items if isinstance(i, dict) and 'prompt_style' in i}
    problems = []
    for x in assets:
        for s in x['steps']:
            info = styles.get(s['style'])
            if styles and not info:
                problems.append(f'{x["id"]}: style {s["style"]} is not in the live style list')
            elif info:
                if not (info.get('min_width', 0) <= s['width'] <= info.get('max_width', 9999) and info.get('min_height', 0) <= s['height'] <= info.get('max_height', 9999)):
                    problems.append(f'{x["id"]}: {s["width"]}x{s["height"]} is outside {s["style"]} limits '
                                    f'({info.get("min_width")}-{info.get("max_width")} x {info.get("min_height")}-{info.get("max_height")})')
    if problems:
        print('\n'.join(problems))
        sys.exit('Fix the styles or sizes above (tests/ascent_art_guide.js, then rerun it) before generating.')
    try:
        bal = api.call('GET', '/inferences/credits').get('balance')
        print(f'Balance: ${bal}')
    except Exception as e:
        bal = None
        print('(could not read the balance:', e, ')')

    total = 0.0
    spent = 0.0
    todo = []
    for x in assets:
        out = ROOT / x['out']
        if out.exists() and not a.force and not redo:
            continue
        todo.append(x)
    print(f'{len(todo)} of {len(assets)} assets to make ({len(assets) - len(todo)} already done).')

    for x in todo:
        d = CACHE / x['id']
        d.mkdir(parents=True, exist_ok=True)
        state = load_state(d)
        png = {}
        for s in x['steps']:
            seed = x['seed'] + (a.seed_bump if (not redo or s['key'] in redo) else 0)
            f = d / f'{s["key"]}.{"gif" if s["style"].startswith(("rd_animation", "rd_advanced_animation")) else "png"}'
            if f.exists() and not a.force and s['key'] not in redo and state.get(s['key'] + '_seed') == seed:
                png[s['key']] = f.read_bytes()
                continue
            src = png.get(s['from']) if s.get('from') else None
            if src is not None:
                src = frames_of(src)[0]
                buf = io.BytesIO(); src.convert('RGB').save(buf, 'PNG'); src = buf.getvalue()  # advanced animations need RGB without transparency
            cost = estimate(api, x, s, seed, src)
            total += cost
            if not a.go:
                print(f'  {x["id"]:<22} {s["key"]:<5} {s["style"]:<40} {s["width"]}x{s["height"]}  ${cost:.2f}')
                png[s['key']] = blank_png(s['width'], s['height']) if s['key'] == 'base' else None
                continue
            if spent + cost > a.max_spend:
                print(f'Stopping: the next step would pass the ${a.max_spend:.2f} limit (spent ${spent:.2f}). Raise --max-spend to go on.')
                finish(total, spent, a)
                return
            idem = state.get(s['key'] + '_idem') or str(uuid.uuid4())  # reused only to recover an uncertain submit
            state[s['key'] + '_idem'] = idem
            save_state(d, state)
            print(f'  making {x["id"]} / {s["key"]} ({s["style"]}, ${cost:.2f}) ...', flush=True)
            try:
                data = api.run(step_body(x, s, seed, src), idem)[0]
            except RuntimeError as e:
                print('  ! ' + str(e))
                if ' 402 ' in str(e):
                    sys.exit('Out of balance. Add credit at retrodiffusion.ai and run again; finished steps are kept.')
                break
            spent += cost
            f.write_bytes(data)
            state[s['key'] + '_seed'] = seed
            state.pop(s['key'] + '_idem', None)
            save_state(d, state)
            png[s['key']] = data
        else:
            if a.go and all(png.get(s['key']) for s in x['steps']):
                out = ROOT / x['out']
                out.parent.mkdir(parents=True, exist_ok=True)
                build_output(x, png).save(out, 'PNG')
                print(f'  wrote {x["out"]}')
    finish(total, spent, a)


def finish(total, spent, a):
    if a.go:
        print(f'Done. Spent about ${spent:.2f}. Reload the game (or open it with ?v=<something new>) to see the art.')
    else:
        print(f'Dry run: this would cost about ${total:.2f}. Nothing was generated or charged. Add --go to make it.')


if __name__ == '__main__':
    main()
