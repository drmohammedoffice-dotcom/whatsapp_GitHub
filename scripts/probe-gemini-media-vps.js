#!/usr/bin/env node
/** Probe which Gemini image/video models work with the VPS key. */
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const PASSWORD = process.env.VPS_PASSWORD || '';

const REMOTE = `
python3 - <<'PY'
import json, urllib.request, urllib.error
from pathlib import Path
env={}
for line in Path('/root/whatsapp_GitHub/.env').read_text(encoding='utf-8', errors='replace').splitlines():
    if '=' in line and not line.strip().startswith('#'):
        k,v=line.split('=',1); env[k.strip()]=v.strip()
key=env.get('AI_API_KEY_1') or env.get('OPENAI_API_KEY') or ''
print('KEY_PREFIX', key[:6], 'LEN', len(key))

# List relevant models
url='https://generativelanguage.googleapis.com/v1beta/models?key='+key+'&pageSize=200'
try:
    with urllib.request.urlopen(urllib.request.Request(url), timeout=60) as r:
        data=json.load(r)
    for m in data.get('models', []):
        name=(m.get('name') or '')
        n=name.lower()
        methods=m.get('supportedGenerationMethods') or []
        if any(x in n for x in ['imagen','veo','image','banana','omni','flash-image','nano']):
            print('MODEL', name, '|', ','.join(methods))
except Exception as e:
    print('LIST_FAIL', type(e).__name__, str(e)[:250])

candidates_img = [
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-3.1-flash-image-preview',
  'imagen-4.0-generate-001',
  'imagen-4.0-fast-generate-001',
  'imagen-3.0-generate-002',
]
candidates_vid = [
  'veo-3.1-generate-preview',
  'veo-3.0-generate-001',
  'veo-2.0-generate-001',
  'gemini-omni-1.1-flash',
]

def post(path, body):
    req=urllib.request.Request(
      'https://generativelanguage.googleapis.com/v1beta/'+path,
      data=json.dumps(body).encode(),
      headers={'Content-Type':'application/json','x-goog-api-key':key},
      method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            raw=r.read()
            print('OK', path, r.status, 'bytes', len(raw))
            return json.loads(raw.decode('utf-8','replace'))
    except urllib.error.HTTPError as e:
        print('FAIL', path, e.code, e.read().decode('utf-8','replace')[:220])
    except Exception as e:
        print('FAIL', path, type(e).__name__, str(e)[:180])
    return None

print('--- IMAGE PROBES ---')
for model in candidates_img:
    if model.startswith('imagen'):
        post('models/'+model+':predict', {
          'instances':[{'prompt':'a red apple on a white table'}],
          'parameters':{'sampleCount':1,'aspectRatio':'1:1'}
        })
    else:
        post('models/'+model+':generateContent', {
          'contents':[{'parts':[{'text':'Generate an image of a red apple on a white table'}]}],
          'generationConfig':{'responseModalities':['TEXT','IMAGE']}
        })

print('--- VIDEO PROBES (start only) ---')
for model in candidates_vid:
    if model.startswith('veo'):
        post('models/'+model+':predictLongRunning', {
          'instances':[{'prompt':'A calm ocean wave at sunset, cinematic'}],
          'parameters':{'aspectRatio':'16:9'}
        })
    else:
        # interactions API for omni - skip heavy probe
        print('SKIP_OMNI_PROBE', model)
PY
`;

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST,
      username: 'root',
      password: PASSWORD,
      readyTimeout: 60000,
    });
  });
  await new Promise((resolve, reject) => {
    conn.exec(REMOTE, { timeout: 300000 }, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', resolve);
    });
  });
  conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
