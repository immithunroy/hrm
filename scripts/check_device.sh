#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:9000/api/auth/login -H 'Content-Type: application/json' -d @/tmp/test_login.json | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
echo "=== Device Users ==="
curl -s http://localhost:9000/api/devices/users -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""
echo "=== Devices ==="
curl -s http://localhost:9000/api/devices -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""
echo "=== Device Status (from ZKT) ==="
curl -s http://localhost:9000/api/dashboard -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('data',{}).get('device',d.get('data',{}).get('devices',{})),indent=2))"
