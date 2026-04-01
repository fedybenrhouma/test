# Quick Start Guide

## 1. Start MongoDB

Make sure MongoDB is running locally:
```bash
# Windows (if MongoDB is installed)
# Start MongoDB service or run mongod
mongod
```

Or use MongoDB Cloud if you prefer (update `MONGODB_URI` in `.env`)

## 2. Start Backend Server

```bash
cd backend
npm run dev
```

You should see:
```
Server running on port 3000
MongoDB connected successfully
```

## 3. Start Frontend Application

In a new terminal:
```bash
cd frontend
npm start
```

You should see:
```
✔ Compiled successfully
```

Frontend will open at `http://localhost:4200`

## 4. Test Authentication System

### Test Registration
1. Click "Register here" link on login page
2. Fill in form:
   - First Name: John
   - Last Name: Doe
   - Username: johndoe
   - Email: john@example.com
   - Password: Password123
   - Confirm Password: Password123
3. Click "Register"
4. You should be redirected to Dashboard

### Test Login
1. Click "Logout" button on dashboard
2. Login with:
   - Email: john@example.com
   - Password: Password123
3. Click "Login"
4. You should be redirected to Dashboard

### Test Protected Routes
1. Try accessing `http://localhost:4200/dashboard` without logging in
   - Should redirect to login page
2. Try accessing `http://localhost:4200/login` while logged in
   - Should redirect to dashboard

### Test Profile Management
1. On dashboard, edit profile:
   - Change first name to "Jane"
   - Click "Update Profile"
   - Should show success message
2. Change password:
   - Enter current password
   - Enter new password
   - Confirm new password
   - Click "Change Password"
   - Should show success message
3. Try logging in with old password - should fail
4. Try logging in with new password - should succeed

### Test Token Expiration
1. Open browser DevTools (F12)
2. Go to Application > Local Storage
3. Find `auth_token` 
4. Manually delete it
5. Try navigating or clicking buttons that need authentication
6. Should redirect to login page

## Testing with API Client (Optional)

### Using cURL or Postman

**Register:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Get Profile (use token from login response):**
```bash
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer <your_jwt_token>"
```

## Common Issues & Solutions

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Make sure MongoDB is running. Start with `mongod` command.

### CORS Error in Frontend
```
Access to XMLHttpRequest has been blocked by CORS policy
```
**Solution:** Check `FRONTEND_URL` in backend `.env` matches your frontend origin.

### Invalid Token Error
```
Token has expired / Invalid token
```
**Solution:** 
- Login again to get a new token
- Check JWT_SECRET in `.env` hasn't changed
- Check token wasn't modified

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:** Change PORT in `.env` or kill process using port 3000.

## What's Working

✅ User Registration with validation
✅ Password hashing and security
✅ JWT-based authentication
✅ Protected routes with guards
✅ HTTP interceptor for token attachment
✅ Token storage and restoration
✅ User profile management
✅ Password change functionality
✅ Logout functionality
✅ Form validation (frontend & backend)
✅ Error handling and messages
✅ Responsive UI design
✅ CORS configuration

## Next Steps

- Add email verification
- Add password reset functionality
- Add refresh token logic
- Add role-based access control (RBAC)
- Add user profile picture upload
- Add OAuth2 integration (Google, Facebook)
- Add rate limiting
- Add request logging/monitoring
