#!/bin/bash
for i in $(seq 1 12); do
  echo -n "req$i: "
  curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:9000/api/auth/login \
    -H 'Content-Type: application/json' -d @/tmp/test_ratelimit.json
  echo ""
done
