// src/index.js
const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const config = require("./config");
const errorHandler = require("./utils/errorHandler");
const bodyParser = require("body-parser");
const { authenticate } = require("./middleware/auth.middleware");
const fs = require("fs");
const path = require("path");

// Ensure logs directory exists
const logDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
  console.log(`Created logs directory at ${logDir}`);
}

// Routes
const authRoutes = require("./auth/auth.routes");
const dataRoutes = require("./data/data.routes");
const ordersRoutes = require("./orders/orders.routes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/broker/auth", authRoutes); // Authentication routes (no auth required)
app.use("/broker/data", authenticate, dataRoutes); // Data routes (auth required)
app.use("/broker/orders", ordersRoutes);

// Health check
app.get("/broker/health", (req, res) =>
  res.send("✅ Broker integration Fyers microservice is live")
);

app.get("/", (req, res) =>
  res.send({
    status: true,
    message: "Fyers Server is running! updated on 13-04-2025  07:57 PM",
  })
);

// Error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).json({
    success: false,
    error: "Server error: " + (err.message || "Unknown error"),
  });
});

app.use(errorHandler);

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGO_URI, {
    ssl: true, // enforce SSL
    tlsAllowInvalidCertificates: false, // ensure certificates are validated properly
  })

  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () =>
      console.log(`🚀 Server running at http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ Failed to connect MongoDB:", err.message);
    process.exit(1);
  });
