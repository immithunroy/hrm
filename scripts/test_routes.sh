#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:9000/api/auth/login -H 'Content-Type: application/json' -d @/tmp/test_login.json | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
echo "Token: ${TOKEN:0:30}..."
echo "--- Dashboard ---"
curl -s http://localhost:9000/api/dashboard -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('success') else d)"
echo "--- Employees ---"
curl -s http://localhost:9000/api/employees -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK: {len(d.get(\"data\",{}).get(\"employees\",[]))} employees' if d.get('success') else d)"
echo "--- Loans ---"
curl -s http://localhost:9000/api/loans -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('success') else d)"
echo "--- Holidays ---"
curl -s http://localhost:9000/api/holidays -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('success') else d)"