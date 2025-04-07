// src/utils/envUpdater.js
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../../.env");

async function updateEnvValue(key, newValue) {
  const envContent = fs.readFileSync(envPath, "utf-8");

  const updatedLines = envContent.split("\n").map((line) => {
    if (line.startsWith(`${key}=`)) {
      return `${key}=${newValue}`;
    }
    return line;
  });

  const updatedEnv = updatedLines.join("\n");

  fs.writeFileSync(envPath, updatedEnv);
  console.log(`✅ Updated .env key: ${key}`);
}

module.exports = { updateEnvValue };
