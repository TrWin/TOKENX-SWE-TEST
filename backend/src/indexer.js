const { ethers } = require("ethers");
const { vaultShares } = require("./config");
const { store } = require("./db/store");

async function syncPastEvents() {
  console.log("🔄 Syncing past events...");

  const requestedFilter = vaultShares.filters.RedemptionRequested();
  const requestedEvents = await vaultShares.queryFilter(requestedFilter, 0, "latest");

  for (const event of requestedEvents) {
    const { requestId, wallet, shares, nav, amount } = event.args;
    const block = await event.getBlock();
    const unlockDate = new Date((Number(block.timestamp) + 86400) * 1000).toISOString();

    store.insert({
      requestId: Number(requestId),
      wallet,
      shares:    ethers.formatUnits(shares, 18),
      nav:       ethers.formatUnits(nav, 18),
      amount:    ethers.formatUnits(amount, 18),
      unlockDate,
      status:    "pending",
    });
  }

  const settledFilter = vaultShares.filters.RedemptionSettled();
  const settledEvents = await vaultShares.queryFilter(settledFilter, 0, "latest");

  for (const event of settledEvents) {
    store.markFulfilled(Number(event.args.requestId));
  }

  console.log(`✅ Synced ${requestedEvents.length} requests`);
}

function startListening() {
  vaultShares.on("RedemptionRequested", (requestId, wallet, shares, nav, amount, event) => {
    event.getBlock().then(block => {
      const unlockDate = new Date((Number(block.timestamp) + 86400) * 1000).toISOString();
      store.insert({
        requestId: Number(requestId),
        wallet,
        shares:    ethers.formatUnits(shares, 18),
        nav:       ethers.formatUnits(nav, 18),
        amount:    ethers.formatUnits(amount, 18),
        unlockDate,
        status:    "pending",
      });
      console.log(`📥 New redemption request #${requestId}`);
    });
  });

  vaultShares.on("RedemptionSettled", (requestId) => {
    store.markFulfilled(Number(requestId));
    console.log(`✅ Settled #${requestId}`);
  });
}

module.exports = { syncPastEvents, startListening };