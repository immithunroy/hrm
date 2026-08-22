#!/usr/bin/env python3
"""Deploy updated code to ZKT Payroll production server."""
import subprocess
import sys
import os

def run(cmd, check=True):
    print(f"  > {cmd}")
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.stdout.strip():
        print(f"    {r.stdout.strip()}")
    if r.stderr.strip():
        print(f"    (stderr) {r.stderr.strip()}")
    if check and r.returncode != 0:
        print(f"    FAILED (exit {r.returncode})")
        sys.exit(1)
    return r

print("=== ZKT Payroll Deployment ===\n")

# 1. Replace backend source
print("[1/6] Replacing backend source...")
run("rm -rf /root/zkt-app/backend/src")
run("mv /root/zkt-app/backend/src_new /root/zkt-app/backend/src")

# 2. Rebuild backend Docker image
print("\n[2/6] Rebuilding backend Docker image...")
run("cd /root/zkt-app && docker compose build --no-cache backend", check=True)

# 3. Run prisma db push inside the running backend container (or start a temporary one)
print("\n[3/6] Pushing Prisma schema to database...")
run("cd /root/zkt-app && docker compose run --rm backend sh -c 'npx prisma db push --skip-generate'", check=True)

# 4. Set admin user role to ADMIN
print("\n[4/6] Setting admin user role to ADMIN...")
run("""docker compose exec -T db psql -U postgres -d zkt_payroll -c "UPDATE \\\"Employee\\\" SET role = 'ADMIN' WHERE email = 'admin@zkt.com';" """, check=True)

# 5. Restart all services
print("\n[5/6] Restarting all services...")
run("cd /root/zkt-app && docker compose down", check=True)
run("cd /root/zkt-app && docker compose up -d --build", check=True)

# 6. Verify health
print("\n[6/6] Waiting for services to start...")
import time
time.sleep(10)
r = run("curl -sf http://localhost:9000/api/../../health 2>/dev/null || curl -sf http://localhost:5000/health 2>/dev/null || echo 'Checking...'", check=False)
print(f"  Health: {r.stdout.strip()}")

print("\n=== Deployment Complete ===")
print("App should be available at http://103.177.54.6:9000")
