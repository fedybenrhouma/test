# Complete Account System - Setup Guide

A full-stack authentication system with Angular frontend and Express + MongoDB backend, featuring JWT, interceptors, guards, and user management.

## Architecture Overview

### Backend (Express + MongoDB)
- JWT-based authentication
- Password hashing with bcryptjs
- User model with validation
- Protected routes with middleware
- User profile management
- Password change functionality

### Frontend (Angular)
- Standalone components (Angular 20)
- Reactive forms with validation
- HTTP interceptor for JWT attachment
- Route guards (Auth & No-Auth)
- Token storage and management
- Automatic session restoration
- User service for profile operations

## Setup Instructions

### Prerequisites
- Node.js (v16+)
- MongoDB (local or cloud)
- Angular CLI (v20+)

### Backend Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install mongoose bcryptjs jsonwebtoken
   ```

2. **Configure Environment Variables** (`.env`)
   ```
   MONGODB_URI=mongodb://localhost:27017/account-system
   JWT_SECRET=your_super_secret_jwt_key_change_in_production
   JWT_EXPIRE=7d
   PORT=3000
   FRONTEND_URL=http://localhost:4200
   NODE_ENV=development
   ```

3. **Start Backend**
   ```bash
   cd backend
   npm run dev  # or npm start for production
   ```

   Backend will run on `http://localhost:3000`

### Frontend Setup

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Start Frontend**
   ```bash
   cd frontend
   npm start
   ```

   Frontend will run on `http://localhost:4200`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
  ```json
  {
    "email": "user@example.com",
    "username": "username",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }
  ```

- `POST /api/auth/login` - Login user
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

### User Routes (Protected - Requires JWT)

- `GET /api/users/profile` - Get user profile
  - Headers: `Authorization: Bearer <token>`

- `PUT /api/users/profile` - Update profile
  - Headers: `Authorization: Bearer <token>`
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "username": "newusername"
  }
  ```

- `POST /api/users/change-password` - Change password
  - Headers: `Authorization: Bearer <token>`
  ```json
  {
    "currentPassword": "oldpass123",
    "newPassword": "newpass123"
  }
  ```

## Frontend Project Structure

```
src/app/
├── components/
│   ├── login/
│   │   ├── login.component.ts
│   │   ├── login.component.html
│   │   └── login.component.scss
│   ├── register/
│   │   ├── register.component.ts
│   │   ├── register.component.html
│   │   └── register.component.scss
│   └── dashboard/
│       ├── dashboard.component.ts
│       ├── dashboard.component.html
│       └── dashboard.component.scss
├── services/
│   ├── auth.service.ts        # Authentication logic & token management
│   └── user.service.ts        # User profile operations
├── guards/
│   ├── auth.guard.ts          # Protects authenticated routes
│   └── no-auth.guard.ts       # Prevents access to login/register if authenticated
├── interceptors/
│   └── auth.interceptor.ts    # Attaches JWT to requests, handles 401
├── app.routes.ts              # Route configuration
├── app.config.ts              # AppConfig with HTTP interceptor
└── app.ts                      # Root component
```

## Backend Project Structure

```
backend/
├── models/
│   └── User.js              # MongoDB User schema
├── middleware/
│   └── auth.js              # JWT verification & token generation
├── routes/
│   ├── auth.js              # Register & Login endpoints
│   └── users.js             # Protected user routes
├── server.js                # Express server setup
├── .env                     # Environment variables
└── package.json
```

## Key Features

### Authentication Flow

1. **Registration**
   - User fills signup form with validation
   - Password is hashed with bcryptjs
   - User saved to MongoDB
   - JWT token generated and returned
   - Token stored in localStorage

2. **Login**
   - User enters credentials
   - Backend verifies password
   - JWT token generated
   - Token stored in localStorage

3. **Token Management**
   - Stored in `auth_token` localStorage key
   - Automatically attached to all HTTP requests via interceptor
   - Restored from localStorage on app reload
   - Cleared on logout

4. **Protected Routes**
   - `AuthGuard` prevents unauthenticated access to `/dashboard`
   - `NoAuthGuard` redirects authenticated users away from `/login` and `/register`
   - Automatic redirect to login on token expiration

### HTTP Interceptor
- Automatically adds `Authorization: Bearer <token>` header
- Handles 401 responses (token expired/invalid)
- Logs user out and redirects to login on 401

### Data Binding
- Two-way binding in reactive forms
- Real-time form validation
- Observable streams for user state management
- Automatic UI updates on auth state changes

## Usage Examples

### Login Flow
1. Navigate to `http://localhost:4200/login`
2. Enter email and password
3. Click "Login"
4. Redirect to dashboard on success

### Register Flow
1. Navigate to `http://localhost:4200/register`
2. Fill form with required details
3. Click "Register"
4. Redirect to dashboard on success

### Protected Dashboard
- View user profile information
- Edit profile (name, username)
- Change password
- Logout

## Security Notes

- JWT secret should be changed in production
- Use HTTPS in production
- Token expiration set to 7 days (configurable)
- Passwords hashed with 10 salt rounds
- CORS configured to allow only frontend origin
- Protected routes require valid JWT

## Troubleshooting

### Backend won't start
- Check MongoDB connection: `mongodb://localhost:27017/account-system`
- Ensure all environment variables in `.env` are set
- Check port 3000 is available

### Login fails
- Verify correct credentials
- Check MongoDB is running
- Check backend server is running

### Token expires without response
- Check JWT_SECRET in `.env`
- Verify JWT_EXPIRE value
- Check backend logs for token errors

### CORS errors
- Ensure FRONTEND_URL in backend `.env` matches frontend origin
- Check backend is allowing credentials

## Development Notes

### Adding New Protected Routes
1. Create service method in `user.service.ts`
2. Create backend route in `backend/routes/users.js`
3. Add `verifyToken` middleware to protect the route
4. Use service method in component

### Modifying JWT Expiration
- Edit `JWT_EXPIRE` in `.env`
- Update interceptor if needed for custom refresh logic

### Customizing Validation
- Update form validators in components
- Update server-side validation in backend routes

## License
MIT
