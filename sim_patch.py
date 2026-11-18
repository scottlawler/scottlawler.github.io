import re, time, zipfile, io, boto3, os

# Download and unzip current Lambda code
import subprocess, json

result = subprocess.run(
    ['aws', 'lambda', 'get-function', '--function-name', 'findata-data-simulator',
     '--region', 'us-east-1', '--query', 'Code.Location', '--output', 'text'],
    capture_output=True, text=True
)
url = result.stdout.strip()
print("Downloading from:", url[:60])

dl = subprocess.run(['curl', '-s', '-o', '/tmp/sim.zip', url], capture_output=True)
print("Download exit:", dl.returncode)

subprocess.run(['rm', '-rf', '/tmp/sim_src'], capture_output=True)
os.makedirs('/tmp/sim_src', exist_ok=True)
subprocess.run(['unzip', '-o', '/tmp/sim.zip', '-d', '/tmp/sim_src'], capture_output=True)

src = open('/tmp/sim_src/simulator.py').read()
orig_len = len(src)
print("Original lines:", src.count('\n'))

# 1. Add Key to imports
src = src.replace(
    'from boto3.dynamodb.conditions import Attr',
    'from boto3.dynamodb.conditions import Attr, Key'
)

# 2. Add time import
if 'import time' not in src:
    src = src.replace('import boto3, uuid, random, json', 'import boto3, uuid, random, json, time')

# 3. Replace criteria scan with GSI query
p1 = r'# Load ALL criteria.*?print\(f"Loaded \{len\(all_criteria\)\} criteria for jimmy"\)'
r1 = """# Load criteria via GSI (no expensive scan)
    all_criteria = []
    q = {"IndexName": "WatcherID-index", "KeyConditionExpression": Key("WatcherID").eq("jimmy")}
    while True:
        resp = criteria_table.query(**q)
        all_criteria.extend(resp["Items"])
        if "LastEvaluatedKey" not in resp:
            break
        q["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
    print(f"Loaded {len(all_criteria)} criteria via GSI")"""
new_src = re.sub(p1, r1, src, flags=re.DOTALL)
print("GSI fix:", new_src != src)
src = new_src

# 4. Remove rolloff scan blocks
p2 = r'    # Roll off records.*?print\(f"Rolled off: \{deleted_src\} source, \{deleted_mtch\} match records"\)\n'
src = re.sub(p2, '    # Rolloff handled by DynamoDB TTL\n', src, flags=re.DOTALL)
print("Rolloff removed:", 'Roll off records' not in src)

# 5. Add ttl_epoch before rec = {
if 'ttl_epoch' not in src:
    src = src.replace('            rec = {', '            ttl_epoch = int(time.time()) + (ROLLOFF_HOURS * 3600)\n            rec = {', 1)

# 6. Add ttl field in rec dict
if '"ttl":' not in src and 'ttl_epoch' in src:
    src = src.replace('"SenderBankRoutingNumber": s_bank_rout,', '"SenderBankRoutingNumber": s_bank_rout,\n                "ttl": ttl_epoch,', 1)

# 7. Add MatchedFields helper BEFORE lambda_handler
mf_helper = '''
CHECK_FIELDS = [
    "SenderFirstName","SenderLastName","SenderTaxID","SenderAccountID",
    "SenderCity","SenderState","SenderCounty","SenderBankName",
    "SenderBankAccountNumber","SenderBankRoutingNumber",
    "ReceiverFirstName","ReceiverLastName","ReceiverTaxID","ReceiverAccountID",
    "ReceiverCity","ReceiverState","ReceiverCountry","ReceiverBankName",
    "ReceiverBankAccountNumber","ReceiverBankRoutingNumber",
    "Amount","CurrencyCode","Channel","FundsFlow",
]

def get_matched_fields(record, criteria_list):
    matched = set()
    for crit in criteria_list:
        if matches_criterion(record, crit):
            for field in CHECK_FIELDS:
                c_val = str(crit.get(field, "")).strip()
                r_val = str(record.get(field, "")).strip()
                if c_val and c_val == r_val:
                    matched.add(field)
    return ",".join(sorted(matched))

'''
# Insert before lambda_handler
if 'get_matched_fields' not in src:
    src = src.replace('def lambda_handler(', mf_helper + 'def lambda_handler(')

# 8. Add MatchedFields to the match record being written
# Find where "watcherResultsGuid" is set (key field in matchResults record)
# and add MatchedFields near there
if 'MatchedFields' not in src and 'get_matched_fields' in src:
    # Find the match record write - look for watcherResultsGuid being set
    # Pattern: when building the match result record
    src = src.replace(
        '"watcherResultsGuid":',
        '"MatchedFields": get_matched_fields(rec, all_criteria),\n                "watcherResultsGuid":'
    )
    if 'MatchedFields' not in src:
        # Try alternate patterns
        src = src.replace(
            '"WatcherGuid":',
            '"MatchedFields": get_matched_fields(rec, all_criteria),\n                "WatcherGuid":'
        )

open('/tmp/sim_src/simulator.py', 'w').write(src)
print("Patched lines:", src.count('\n'))
print("Has GSI query:", "WatcherID-index" in src)
print("Has ttl_epoch:", "ttl_epoch" in src)
print("Has ttl field:", '"ttl":' in src)
print("Has MatchedFields helper:", "get_matched_fields" in src)
print("Has MatchedFields in record:", '"MatchedFields"' in src)

# Package and deploy
zb = io.BytesIO()
with zipfile.ZipFile(zb, 'w', zipfile.ZIP_DEFLATED) as zf:
    for fn in os.listdir('/tmp/sim_src'):
        fp = os.path.join('/tmp/sim_src', fn)
        if os.path.isfile(fp):
            zf.write(fp, fn)

lam = boto3.client('lambda', region_name='us-east-1')
resp = lam.update_function_code(
    FunctionName='findata-data-simulator',
    ZipFile=zb.getvalue(),
    Publish=True
)
print("DEPLOYED version=" + str(resp.get('Version')) + " sha=" + resp.get('CodeSha256','')[:12])
print("LastModified:", resp.get('LastModified',''))
