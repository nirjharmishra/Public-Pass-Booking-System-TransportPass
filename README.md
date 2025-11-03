# TransportPass - Public Transport Pass Management System

A comprehensive web-based platform for managing public transport passes across buses, trains, and flights. Users can browse, purchase, and manage transport passes through an integrated wallet system.

## 🚀 Features

**User Features:**
- Secure authentication (JWT-based registration/login)
- Wallet system with customizable top-up (minimum ₹100)
- Browse passes by category (Bus, Train, Flight) and type (Daily, Weekly, Monthly, Student, Corporate)
- Purchase passes with automatic expiry calculation
- Renew expired passes
- Complete transaction history with receipts
- Track active and expired passes

**Admin Features:**
- Manage passes (create, update, delete)
- User management and account oversight
- Monitor all bookings and transactions
- View system statistics (users, passes, revenue, bookings)

## 🛠️ Technology Stack

**Backend:** Node.js with Express.js  
**Database:** SQLite3  
**Authentication:** JWT with bcryptjs password hashing  
**Frontend:** HTML5, CSS3, Vanilla JavaScript  
**Icons:** Font Awesome 6.4.0

## 📋 Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Initialize database:**
   ```bash
   npm run init-db
   ```
   Creates tables and sample passes. Default admin: `admin@transportpass.com` / `admin123`

3. **Start server:**
   ```bash
   npm start
   ```
   Or for development: `npm run dev`

4. **Access application:** `http://localhost:3000`

## 📁 Project Structure

- `server.js` - Express server and API routes
- `init-db.js` - Database initialization
- `index.html` - Home page
- `login.html` / `register.html` - Authentication pages
- `dashboard.html` - User dashboard
- `admin.html` - Admin panel
- `css/style.css` - Stylesheet
- `js/` - Client-side JavaScript modules

## 🔐 Key API Endpoints

**Authentication:** `POST /api/auth/register`, `POST /api/auth/login`  
**User:** `GET /api/users/wallet`, `POST /api/transactions/topup`, `GET /api/transactions`  
**Passes:** `GET /api/passes`, `GET /api/passes/:id`  
**Bookings:** `POST /api/bookings`, `GET /api/bookings/active`, `POST /api/bookings/:id/renew`  
**Admin:** `GET|POST|PUT|DELETE /api/admin/passes`, `GET /api/admin/users`, `GET /api/admin/bookings`, `GET /api/admin/statistics`

## 🔒 Security

- Password hashing with bcryptjs (10 salt rounds)
- JWT token-based authentication
- Protected routes with authentication middleware
- Admin role-based access control
- Parameterized queries for SQL injection prevention

## 📝 Default Admin Credentials

- **Email:** `admin@transportpass.com`
- **Password:** `admin123`

## 🎯 Usage

**Users:** Register → Top-up wallet → Browse and purchase passes → Manage active passes → View transactions  
**Admins:** Login as admin → Access admin panel → Manage passes/users → Monitor bookings and transactions → View statistics

## 📄 License

ISC

---

**Note:** Run `npm run init-db` before starting the server for the first time to initialize the database.

*Made by Nirjhar Mishra*
