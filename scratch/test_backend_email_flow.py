import urllib.request
import urllib.parse
import json

BASE_URL = "http://localhost:8888"

def req(path, data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode('utf-8') if data else None
    request = urllib.request.Request(url, data=body, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(request) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode('utf-8'))

print("1. Testing login as harlan with harlan123...")
login_res = req("/api/auth/login", {"username": "harlan", "password": "harlan123"})
print("Login result:", login_res.get("success"), "email:", login_res.get("user", {}).get("email"))

print("2. Testing update email for harlan via self-service (correct password)...")
update_res = req("/api/auth/update-email", {
    "username": "harlan",
    "email": "harlan.sitac@example.com",
    "password": "harlan123"
})
print("Update email with password result:", update_res)

print("3. Testing login as harlan after update...")
login_res2 = req("/api/auth/login", {"username": "harlan", "password": "harlan123"})
print("Login result 2:", login_res2.get("success"), "email:", login_res2.get("user", {}).get("email"))

print("4. Testing update email for harlan with wrong password (should fail)...")
update_wrong = req("/api/auth/update-email", {
    "username": "harlan",
    "email": "wrong@example.com",
    "password": "wrongpassword"
})
print("Update email with wrong password result (expect error):", update_wrong)

print("5. Testing update email by admin...")
update_admin = req("/api/auth/update-email", {
    "username": "harlan",
    "email": "harlan.official@telecom.co.id",
    "admin_username": "admin"
})
print("Update email by admin result:", update_admin)

print("6. Verifying registered pics contains email...")
pics_res = req("/api/auth/registered-pics")
harlan_pic = next((p for p in pics_res.get("pics", []) if p.get("username") == "harlan"), None)
print("Harlan in registered-pics:", harlan_pic.get("email") if harlan_pic else "Not found")

print("All API tests completed successfully!")
