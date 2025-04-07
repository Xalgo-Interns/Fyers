# FYERS Broker Integration Microservice

A production-ready Node.js microservice that integrates with the FYERS Trading API V3 to support multi-user algorithmic trading. It handles authentication, market data access, and order execution.

---

## 🚀 Features

### 📊 Market Data

- Historical OHLC data (with candle resolution)
- WebSocket-based live market updates

### 💰 Order Management

- Place orders (Market/Limit/SL)
- Easy integration with scheduling logic for auto-trading

### 🔐 Secure Authentication

- Fyers OAuth 2.0 integration
- Token exchange and auto-storage per user

### 🧩 Microservice Architecture

- Works standalone or as part of a full-stack trading platform
- Supports MongoDB for user/token/strategy persistence

---

## ⚙️ Quick Start

### Prerequisites

- Node.js >= 18
- MongoDB (local or Atlas)
- FYERS Trading Account + App Credentials

### Setup

1. **Clone the repo**

```bash
git clone https://github.com/yourusername/broker-integration.git
cd broker-integration/services/broker-integration
```

2. **Install dependencies**

```bash
npm install
```

3. **Environment Configuration**

```bash
cp .env.example .env
```

Edit `.env` and update with your details:

```env
FYERS_APP_ID=your_app_id
FYERS_SECRET_KEY=your_secret
FYERS_REDIRECT_URI=http://localhost:4001/broker/auth/callback
MONGO_URI=mongodb://localhost:27017/brokerDB
PORT=4001
```

4. **Seed test user (optional)**

```bash
node scripts/seed-user.js
 
 test user 
✅ User created: new ObjectId('67f37ce0e236f91c8da3659e')
```

5. **Start the server**

```bash
npm run dev
```

---

## 📡 API Endpoints

### 🔐 Authentication

#### Get Redirect URL

```
GET /broker/auth/redirect-url?userId=abc123
```

Returns a Fyers login URL.

#### Callback from Fyers

```
GET /broker/auth/callback?auth_code=xyz&state=abc123
```

Handles token exchange & saves it.

---

### 📊 Market Data

#### Get Historical Data

```
GET /broker/data/historical
```

**Query Params:**

- `userId`
- `symbol`
- `resolution`
- `fromDate`
- `toDate`

---

### 💰 Orders

#### Place Order

```
POST /broker/orders/place
```

**Body:**

```json
{
  "userId": "abc123",
  "symbol": "NSE:TATAMOTORS-EQ",
  "qty": 1,
  "side": 1,
  "type": 2,
  "productType": "INTRADAY"
}
```

---

## 🗂️ Project Structure

```
services/broker-integration/
├── src/
│   ├── auth/              # Token flow and client setup
│   ├── data/              # Market data (historical/live)
│   ├── orders/            # Order placement
│   ├── users/             # User DB model and logic
│   ├── utils/             # Scheduler, logging, env updates
│   ├── config.js
│   └── index.js           # App entrypoint
│
├── scripts/              # DB seeding, admin utilities
├── tests/                # API tests (auth, data, orders)
├── .env.example
├── package.json
└── README.md
```

---

## 🧪 Development

### Run Tests

```bash
npm test
```

---

## 🔐 Environment Variables

| Key | Description |
|-----|-------------|
| `FYERS_APP_ID` | Your app ID from Fyers Developer Portal |
| `FYERS_SECRET_KEY` | App secret key |
| `FYERS_REDIRECT_URI` | Must match what’s registered in your Fyers App |
| `MONGO_URI` | Connection string for MongoDB |
| `PORT` | API server port |

---

## 📝 Notes

- FYERS access tokens are short-lived (valid ~12–24h)
- Store per-user tokens in DB (we use MongoDB)
- Integrate this microservice with your main backend to automate trades
- Test in sandbox or with small positions before going live

---

## 🙌 Contributing

1. Fork this repo
2. Create feature branch (`git checkout -b feat/your-feature`)
3. Commit changes (`git commit -m 'feat: add new feature'`)
4. Push to origin (`git push origin feat/your-feature`)
5. Open a PR

---

## 📚 Resources

- [FYERS Developer Portal](https://myapi.fyers.in/dashboard)
- [FYERS API Docs](https://myapi.fyers.in/docs/)
- [FYERS API Support](https://fyers.in/support)

---

## 📄 License

MIT
