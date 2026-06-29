# Auth-Gated App Testing Playbook (Emergent Google Auth)

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  bio: '',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Backend API
```
curl -X GET "$URL/api/auth/me" -H "Authorization: Bearer $TOKEN"
curl -X GET "$URL/api/posts" -H "Authorization: Bearer $TOKEN"
```

## Step 3: Browser Cookie Set
```python
await page.context.add_cookies([{
    "name": "session_token", "value": "TOKEN",
    "domain": "your-app.com", "path": "/",
    "httpOnly": True, "secure": True, "sameSite": "None"
}])
```

## Checklist
- user_id is custom UUID (MongoDB _id excluded via {"_id": 0} projection)
- Session user_id matches user.user_id exactly
- /api/auth/me returns user (not 401)
- Dashboard loads without redirect
