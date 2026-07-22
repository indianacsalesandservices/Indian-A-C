#!/usr/bin/env python3
import psycopg2
from supabase import create_client

print("DB CHECK:")
try:
    conn = psycopg2.connect(
        host='aws-0-ap-southeast-2.pooler.supabase.com', port=6543,
        user='postgres.xpkaoqwywhvliwbbuwoh',
        password='indianacsalesandservices',
        dbname='postgres', sslmode='require', connect_timeout=5
    )
    cur = conn.cursor()
    for t in ['b_user','product','b_employee','att_log','att_record','company_settings']:
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        print(f"  {t}: {cur.fetchone()[0]} rows")
    cur.close()
    conn.close()
    print("  [OK] DB CONNECTED\n")
except Exception as e:
    print(f"  [FAIL] DB: {e}\n")

print("STORAGE CHECK:")
try:
    s = create_client(
        'https://xpkaoqwywhvliwbbuwoh.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwa2FvcXd5d2h2bGl3YmJ1d29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTMxMzcsImV4cCI6MjEwMDIyOTEzN30.HEG6AD625_UQ8tD8CH-zHMKWOrPPFb-tk_iJCA1i3X4'
    )
    buckets = s.storage.list_buckets()
    names = [b.name for b in buckets]
    if names:
        for b in names:
            files = s.storage.from_(b).list()
            print(f"  Bucket '{b}': {len(files)} files")
    else:
        print("  No buckets yet (will be created on first upload)")
    print("  [OK] STORAGE CONNECTED")
except Exception as e:
    print(f"  [FAIL] Storage: {e}")
