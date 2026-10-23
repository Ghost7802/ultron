import json
import os

path = os.path.expandvars(r'%LOCALAPPDATA%\ULTRON\memory\ultron_memory.json')
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print('=== VERIFIED PERSONAL STORE ON DISK ===')
keys_to_check = [
    'owner',
    'education_status',
    'learning_focus',
    'technical_skills',
    'core_interests',
    'engineering_goals',
    'cost_and_solution_preference',
    'explanation_style_preference',
    'preferred_language'
]

found_keys = set()
for item in data['stores']['personal']:
    k = item.get('key')
    if k in keys_to_check:
        found_keys.add(k)
        print(f"[{item.get('category')}] {k}: {item.get('value')} (conf: {item.get('confidence')}, src: {item.get('source')})")

print(f'\nTotal target profile keys found: {len(found_keys)} / {len(keys_to_check)}')

print('\n=== VERIFIED QUANTUMX RECORDS ON DISK ===')
qx_records = [x for x in data['stores']['project'] if x.get('key', '').startswith('qx_')]
print(f'Total QuantumX records in project store: {len(qx_records)}')
for item in qx_records:
    try:
        val = json.loads(item['value'])
        print(f"- {val.get('record_id')} [{val.get('record_type')} | {val.get('status')} | conf: {val.get('confidence')}]:")
        print(f"  Content: {val.get('content')}")
    except Exception:
        print(f"- {item.get('key')}: {item.get('value')}")

