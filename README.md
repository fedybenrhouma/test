# Cryptocurrency Account Management System

A full-stack web application for managing cryptocurrency portfolios with real-time market data, user authentication, and profile management.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Features](#features)
5. [Installation & Setup](#installation--setup)
6. [Running the Application](#running-the-application)
7. [API Endpoints](#api-endpoints)
8. [How It Works](#how-it-works)

---

## 🚀 Project Overview

This is a modern cryptocurrency management platform built with:
- **Frontend**: Angular 20 with zoneless architecture and SSR (Server-Side Rendering)
- **Backend**: Express.js v5.2.1 with PostgreSQL
- **Caching**: Redis for optimized performance
- **Data Source**: CoinGecko API for live cryptocurrency market data

The application features authentication, profile management, and an infinite-scroll cryptocurrency markets table with all 250 top coins.

---

## 🛠️ Tech Stack

### Frontend
- **Angular 20** - Latest Angular with standalone components and zoneless mode (no zone.js)
- **TypeScript** - Strict typing
- **Reactive Forms** - Form validation and management
- **RxJS** - Reactive programming for async operations
- **Intersection Observer API** - Efficient infinite scrolling
- **SCSS** - Styling with variables and mixins

### Backend
- **Express.js 5.2.1** - HTTP server and routing
- **PostgreSQL** - Relational database
- **Sequelize ORM** - Database models and queries
- **Redis** - In-memory caching
- **JWT (jsonwebtoken)** - Stateless authentication
- **Axios** - HTTP client for external APIs
- **dotenv** - Environment configuration

### External APIs
- **CoinGecko** - Free cryptocurrency market data API

---

## 🏗️ Architecture

### Directory Structure

```
PFE/
├── backend/
│   ├── config/
│   │   ├── database.js       # Sequelize configuration
│   │   └── redis.js           # Redis client setup
│   ├── models/
│   │   └── User.js            # User database model
│   ├── routes/
│   │   ├── auth.js            # Login/Register endpoints
│   │   ├── users.js           # Profile management endpoints
│   │   └── markets.js         # Cryptocurrency markets endpoint
│   ├── middleware/
│   │   └── verifyToken.js     # JWT verification
│   ├── server.js              # Express app initialization
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── components/
    │   │   │   ├── header/              # Global sticky header
    │   │   │   ├── login-modal/         # Authentication modal
    │   │   │   ├── dashboard/           # Profile management
    │   │   │   ├── markets/             # Cryptocurrency table
    │   │   │   └── portfolio/           # Portfolio page (placeholder)
    │   │   ├── services/
    │   │   │   ├── auth.service.ts      # Authentication logic
    │   │   │   ├── user.service.ts      # User profile API
    │   │   │   └── crypto-market.service.ts  # Markets API
    │   │   ├── interceptors/
    │   │   │   └── auth.interceptor.ts  # JWT token injection
    │   │   ├── directives/
    │   │   │   └── click-outside.directive.ts  # Close modals
    │   │   ├── app.ts                   # Root component
    │   │   ├── app.routes.ts            # Route definitions
    │   │   └── app.config.ts            # App configuration
    │   ├── main.ts                      # Application entry point
    │   └── index.html
    ├── angular.json
    └── package.json
```

---

## ✨ Features

### Authentication
- ✅ **User Registration** - Create new account with email/password
- ✅ **Login** - JWT-based stateless authentication
- ✅ **Session Persistence** - Token stored in localStorage
- ✅ **Protected Routes** - AuthGuard prevents unauthorized access
- ✅ **Logout** - Clear session and redirect to login

### User Profile Management
- ✅ **View Profile** - Display user info (firstName, lastName, username, email)
- ✅ **Edit Profile** - Update firstName, lastName, username
- ✅ **Change Password** - Secure password updates with current password verification
- ✅ **Unique Username** - Server validates username uniqueness (except current value)

### Markets & Cryptocurrencies
- ✅ **View Top 250 Coins** - Display all top cryptocurrencies by market cap
- ✅ **Live Price Data** - Real-time USD prices from CoinGecko API
- ✅ **Price Changes** - Show 1h, 24h, and 7-day percentage changes
- ✅ **Market Data** - Display market cap and 24-hour trading volume
- ✅ **Infinite Scroll** - Load coins automatically as user scrolls
- ✅ **Smart Caching** - Redis caches all 250 coins for 5 minutes

### UI/UX
- ✅ **Global Header** - Persistent navigation on all pages with login/account menu
- ✅ **Modal Authentication** - Pop-up login/signup form in header
- ✅ **Account Dropdown** - Display user info and logout option
- ✅ **Responsive Design** - Mobile-first layout for all screen sizes
- ✅ **Loading States** - Visual feedback during data fetching
- ✅ **Error Handling** - User-friendly error messages

---

## 🔧 Installation & Setup

### Prerequisites
- Node.js v22.20.0+
- PostgreSQL (local or remote)
- Redis (local or remote)
- npm or yarn

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables** - Create `.env` file:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=pfe_db
   DB_USER=postgres
   DB_PASSWORD=your_password
   
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   
   JWT_SECRET=your_secret_key_here
   JWT_EXPIRE=7d
   
   NODE_ENV=development
   PORT=3000
   ```

4. **Initialize database** (automatic on first run with Sequelize sync)

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build frontend** (optional, for production)
   ```bash
   ng build
   ```

---

## 🚀 Running the Application

### Development Mode

**Terminal 1 - Start Backend**
```bash
cd backend
npm run dev
```
Backend runs on: `http://localhost:3000`

**Terminal 2 - Start Frontend**
```bash
cd frontend
ng s
```
Frontend runs on: `http://localhost:4200`

Open browser: `http://localhost:4200`

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/register` | `{email, password, firstName, lastName, username}` | `{success, token, user}` |
| POST | `/api/auth/login` | `{email, password}` | `{success, token, user}` |

### User Profile

| Method | Endpoint | Auth | Body | Response |
|--------|----------|------|------|----------|
| GET | `/api/users/profile` | ✓ JWT | - | `{success, user}` |
| PUT | `/api/users/profile` | ✓ JWT | `{firstName, lastName, username}` | `{success, user}` |
| POST | `/api/users/change-password` | ✓ JWT | `{currentPassword, newPassword}` | `{success, message}` |

### Cryptocurrency Markets

| Method | Endpoint | Query Params | Response |
|--------|----------|--------------|----------|
| GET | `/api/crypto/markets` | - | `{success, data: [250 coins]}` |

**Response Data Format**
```json
{
  "success": true,
  "message": "Markets data (all 250 coins)",
  "data": [
    {
      "id": "bitcoin",
      "symbol": "btc",
      "name": "Bitcoin",
      "image": "https://...",
      "current_price": 45000,
      "market_cap_rank": 1,
      "price_change_percentage_1h_in_currency": 0.5,
      "price_change_percentage_24h_in_currency": 2.3,
      "price_change_percentage_7d_in_currency": -1.2,
      "market_cap": 900000000000,
      "total_volume": 30000000000
    },
    ...249 more coins
  ]
}
```

---

## 🔍 How It Works

### 1. Authentication Flow

```
User → Register/Login → Backend validates → JWT token generated → 
Stored in localStorage → Token sent with every API request via Interceptor → 
Backend verifies JWT → Protected resources unlocked
```

**Key Implementation Details:**
- JWT payload includes user ID and expiration (7 days)
- Token stored in localStorage for session persistence
- Functional HTTP interceptor (not class-based) attached to all requests
- 401 errors trigger logout and redirect to login

### 2. Infinite Scroll Implementation

**Backend (One-Time Fetch)**
```javascript
// Backend fetches ALL 250 coins in single request
GET /api/crypto/markets → CoinGecko (250 coins) → Redis cache → Response
```

**Frontend (Local Pagination)**
```typescript
// 1. Component loads ALL 250 coins on init
loadMarkets() {
  this.cryptoService.getMarkets().subscribe({
    next: (response) => {
      this.allCoins = response.data;        // All 250 stored in memory
      this.displayedCoins = this.allCoins.slice(0, 50);  // Show first 50
    }
  });
}

// 2. Intersection Observer watched sentinel element
// When user scrolls to sentinel:
// → detectScroll() triggers
// → loadMoreCoins() called
// → this.displayedCoins = this.allCoins.slice(0, endIndex)
// → More coins appear instantly (no API call!)
```

**Why This Works:**
- ✅ **Zero Rate Limiting** - Only 1 API call per 5 minutes (Redis cache)
- ✅ **Instant Scroll** - Slicing local array is microseconds
- ✅ **No 429 Errors** - Never exceeds CoinGecko rate limits
- ✅ **Memory Efficient** - 250 coins (~200KB) insignificant in modern browsers

### 3. Zoneless Change Detection

Angular 20 runs **without zone.js**, requiring manual change detection after async operations:

```typescript
// After observable emits
this.cryptoService.getData().subscribe({
  next: (data) => {
    this.data = data;
    this.cdr.markForCheck();  // ← Crucial in zoneless mode!
  }
});
```

### 4. Server-Side Rendering (SSR)

The app supports SSR using Angular's hydration. To prevent `window` errors:

```typescript
// Check platform before using browser APIs
if (isPlatformBrowser(this.platformId)) {
  this.setupIntersectionObserver();
}
```

---

## 🔐 Security

- **JWT Authentication** - Stateless, tamper-proof tokens
- **Password Hashing** - Bcrypt hashing (handled by Sequelize)
- **CORS Enabled** - Allows frontend to communicate with backend
- **Protected Routes** - AuthGuard validates tokens before access
- **Current Password Verification** - Password changes require verification

---

## 📊 Performance Optimizations

1. **Redis Caching** - API responses cached 5 minutes
2. **Local Pagination** - Scroll events don't trigger network requests
3. **Lazy Change Detection** - Zoneless mode avoids change detection overhead
4. **Intersection Observer** - Efficient scroll detection (native browser API)
5. **Browser Storage** - JWT in localStorage avoids session server overhead

---

## 🐛 Troubleshooting

### "Rate limited (429)" Error
- **Cause**: CoinGecko API rate limiting
- **Solution**: Wait for automatic retry (max 5 attempts with exponential backoff)
- **Prevention**: Using 250-coin batch with caching prevents this

### "Window is not defined" Error
- **Cause**: Browser API called during SSR
- **Solution**: Added `isPlatformBrowser()` check ✓ Fixed

### Profile Updates Not Showing
- **Cause**: Zoneless change detection not triggered
- **Solution**: Added `markForCheck()` after async operations ✓ Fixed

### 401 Unauthorized on Protected Routes
- **Cause**: Token not attached to requests
- **Solution**: Switched to functional interceptor pattern ✓ Fixed

---

## 📝 Notes

- **API Key**: CoinGecko free tier doesn't require API key
- **Database**: Automatically syncs models on startup
- **Environment**: App works in development and production modes
- **Browser Support**: Modern browsers with ES2020+ support

---

## 🎯 Future Enhancements

- [ ] Portfolio tracking (buy/sell history)
- [ ] Watchlist functionality
- [ ] Advanced charting
- [ ] Email verification
- [ ] Two-factor authentication
- [ ] Mobile app (React Native)
- [ ] WebSocket for real-time price updates

---

## 📄 License

MIT License - This project is open source and available for educational purposes.

---

**Last Updated**: April 2, 2026  
**Status**: ✅ Production Ready - Infinite scroll fully functional with 250 coins
