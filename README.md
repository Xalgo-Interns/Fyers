# FYERS Trading API Integration

A Node.js application that integrates with FYERS API V3 for algorithmic trading, providing endpoints for historical data, real-time market updates, and order management.

## Features

- 📊 **Market Data**
  - Historical data retrieval
  - Real-time market updates via WebSocket
- 💰 **Order Management**
  - Place new orders
  - Modify existing orders
  - Cancel orders
- 🔐 **Authentication**
  - Secure API integration
  - Environment-based configuration

## Quick Start

### Prerequisites

- Node.js >= 12.0.0
- FYERS Trading Account
- API Credentials from [FYERS API Dashboard](https://myapi.fyers.in/dashboard)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/fyers-trading-api.git
   cd fyers-trading-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your FYERS credentials:
   ```
   FYERS_APP_ID=your_app_id
   FYERS_ACCESS_TOKEN=your_access_token
   ```

4. Start the server:
   ```bash
   npm start
   ```

## API Endpoints

### Market Data

#### Get Historical Data
```http
GET /historical
```
Query Parameters:
- `symbol` (string): Trading symbol (e.g., "NSE:TATAMOTORS-EQ")
- `resolution` (string): Candle interval (e.g., "1D", "1H", "15")
- `fromDate` (string): Start date (YYYY-MM-DD)
- `toDate` (string): End date (YYYY-MM-DD)

#### Subscribe to Live Data
```http
POST /live/subscribe
```
Body:
```json
{
  "symbols": ["NSE:TATAMOTORS-EQ", "NSE:RELIANCE-EQ"]
}
```

### Order Management

#### Place Order
```http
POST /orders/place
```
Body:
```json
{
  "symbol": "NSE:TATAMOTORS-EQ",
  "quantity": 1,
  "type": "MARKET",
  "side": "BUY"
}
```

#### Modify Order
```http
PUT /orders/modify/:orderId
```
Body:
```json
{
  "quantity": 2,
  "price": 500.50
}
```

#### Cancel Order
```http
DELETE /orders/cancel/:orderId
```

## Project Structure

```
src/
├── auth/
│   └── auth.js         # Authentication setup
├── data/
│   ├── historical.js   # Historical data handling
│   └── live.js        # Real-time data handling
├── orders/
│   └── orders.js      # Order management
├── config.js          # Configuration
└── index.js          # Main application entry
```

## Development

### Running Tests
```bash
npm test
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `FYERS_APP_ID` | Your FYERS API application ID |
| `FYERS_ACCESS_TOKEN` | Access token from FYERS API |
| `PORT` | Server port (default: 3000) |

## Important Notes

- Access tokens expire after 24 hours
- Keep your API credentials secure
- Test thoroughly in development before live trading
- Monitor your positions and risk management
- The application will fail to start if FYERS credentials are not properly configured
- Check logs directory for API communication logs

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For API-related queries, refer to:
- [FYERS API Documentation](https://myapi.fyers.in/docs)
- [FYERS API Support](https://fyers.in/support)

For project-specific issues:
- Open an issue in this repository
- Contact the maintainers
