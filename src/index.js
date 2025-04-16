const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

// Import middlewares
const { authenticate } = require("./middleware/auth.middleware");
const errorHandler = require("./utils/errorHandler");

// Import routes
const authRoutes = require("./auth/auth.routes");
const dataRoutes = require("./data/data.routes");
const ordersRoutes = require("./orders/orders.routes");
const marketDataRoutes = require("./data/market-data.routes");

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Ensure logs directory exists
const logDir = path.join(__dirname, "../logs");
!fs.existsSync(logDir) && fs.mkdirSync(logDir, { recursive: true });

// Security and parsing middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
      },
    },
  })
);
app.use(express.json());
app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// API Routes
app.use("/broker/auth", authRoutes);
app.use("/broker/data", authenticate, dataRoutes);
app.use("/broker/orders", authenticate, ordersRoutes);
app.use("/broker/market", authenticate, marketDataRoutes);

// Health check endpoints
app.get("/broker/health", (_, res) =>
  res.send("✅ Broker integration Fyers microservice is live")
);
app.get("/", (_, res) =>
  res.json({
    status: true,
    message: `Fyers Server is running! Last updated: ${new Date().toLocaleString()}`,
  })
);

// Error handling
app.use(errorHandler);
app.use((err, req, res, next) => {
  console.error("❌ Global error:", err);
  res.status(500).json({
    success: false,
    error: `Server error: ${err.message || "Unknown error"}`,
  });
});

// Database connection and server startup
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      ssl: true,
      tlsAllowInvalidCertificates: false,
    });
    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(`
🚀 Server started successfully
📍 Local:   http://localhost:${PORT}
🔒 Mode:    ${process.env.NODE_ENV || "development"}
⏱  Started: ${new Date().toLocaleString()}
      `);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

startServer();
