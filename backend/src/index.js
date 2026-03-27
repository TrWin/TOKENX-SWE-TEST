const express = require("express");
const { syncPastEvents, startListening } = require("./indexer");

const navRoute         = require("./routes/nav");
const withdrawRoute    = require("./routes/withdraw");
const redemptionsRoute = require("./routes/redemptions");
const settleRoute      = require("./routes/settle");

const app = express();
app.use(express.json());

app.use("/api/nav",         navRoute);
app.use("/api/withdraw",    withdrawRoute);
app.use("/api/redemptions", redemptionsRoute);
app.use("/api/settle",      settleRoute);

const PORT = process.env.PORT || 3000;

async function main() {
  await syncPastEvents();
  startListening();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

main().catch(console.error);