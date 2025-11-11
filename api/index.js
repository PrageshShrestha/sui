const connect = require("connect");
const serverless = require("serverless-http");

// Create a connect app
const app = connect();

// Example middleware
app.use("/api/hello", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ message: "Hello from Connect on Vercel!" }));
});

app.use("/api/data", async (req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ received: JSON.parse(body || "{}") }));
  });
});

// Export as a serverless handler
module.exports = app;
module.exports.handler = serverless(app);
