// src/index.js
const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const config = require("./config");
const errorHandler = require("./utils/errorHandler");

// Routes
const authRoutes = require("./auth/auth.routes");
const dataRoutes = require("./data/data.routes");
const ordersRoutes = require("./orders/orders.routes");

const app = express();

// Middleware
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/broker/auth", authRoutes);
app.use("/broker/data", dataRoutes);
app.use("/broker/orders", ordersRoutes);

// Health check
app.get("/health", (req, res) =>
  res.send("✅ Broker integration Fyers microservice is live")
);

app.get("/", (req, res) =>
  res.send({ status: true, message: "Fyers Server is running!" })
);

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.message);
  res.status(500).json({ success: false, error: "Internal Server Error" });
});

app.use(errorHandler);

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ssl: true, // enforce SSL
    tlsAllowInvalidCertificates: false, // ensure certificates are validated properly
  })

  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(config.port, () =>
      console.log(`🚀 Server running at http://localhost:${config.port}`)
    );
  })
  .catch((err) => {
    console.error("❌ Failed to connect MongoDB:", err.message);
    process.exit(1);
  });
