import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server
import json
import urllib.request
import threading
import time

def run_test():
    server.init_users_table()
    server.PORT = 8889
    httpd = server.ServerClass(('127.0.0.1', 8889), server.TelecomPortalAPIHandler)
    t = threading.Thread(target=httpd.serve_forever)
    t.daemon = True
    t.start()
    time.sleep(0.5)

    base = 'http://127.0.0.1:8889'

    # 1. Register test_reg
    req = urllib.request.Request(
        f'{base}/api/auth/register',
        data=json.dumps({'username': 'test_reg', 'password': 'password123', 'full_name': 'Test Teknisi'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as res:
        print('1. REGISTER RESPONSE:', res.read().decode())

    # 2. Try login before approval -> Must fail with 403
    req_login = urllib.request.Request(
        f'{base}/api/auth/login',
        data=json.dumps({'username': 'test_reg', 'password': 'password123'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    try:
        urllib.request.urlopen(req_login)
        print('ERROR: Login succeeded when it should be blocked!')
    except urllib.error.HTTPError as e:
        print('2. LOGIN BLOCKED AS PENDING (HTTP status):', e.code, e.read().decode())

    # 3. Check pending users
    req_pending = urllib.request.Request(f'{base}/api/auth/pending-users')
    with urllib.request.urlopen(req_pending) as res:
        print('3. PENDING USERS LIST:', res.read().decode())

    # 4. Admin approve user
    req_appr = urllib.request.Request(
        f'{base}/api/auth/approve-user',
        data=json.dumps({'username': 'test_reg'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_appr) as res:
        print('4. APPROVE USER RESPONSE:', res.read().decode())

    # 5. Try login after approval -> Must succeed with 200
    with urllib.request.urlopen(req_login) as res:
        print('5. LOGIN AFTER APPROVAL SUCCESS:', res.read().decode())

    # Cleanup test_reg
    conn = server.get_db()
    cur = conn.cursor()
    cur.execute('DELETE FROM users WHERE username = "test_reg"')
    conn.commit()
    conn.close()
    print('6. CLEANUP COMPLETED SUCCESSFULLY')

    httpd.shutdown()

if __name__ == '__main__':
    run_test()
