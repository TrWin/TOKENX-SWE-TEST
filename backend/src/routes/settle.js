const { Router } = require("express");
const { ethers } = require("ethers");
const { vaultShares, fundVault } = require("../config");
const { store } = require("../db/store");

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: { code: "INVALID_REQUEST_ID", message: "ID does not exist" } });
    }

    const record = store.getById(Number(requestId));

    if (!record) {
      return res.status(400).json({ error: { code: "INVALID_REQUEST_ID", message: "ID does not exist" } });
    }
    if (record.status === "fulfilled") {
      return res.status(400).json({ error: { code: "ALREADY_SETTLED", message: "Status is already 'fulfilled'" } });
    }
    if (record.status === "pending") {
      return res.status(400).json({ error: { code: "UNLOCK_PERIOD_NOT_PASSED", message: "Status is still 'pending'" } });
    }

    const amountWei = ethers.parseUnits(record.amount, 18);
    const bal = await fundVault.balance();
    if (bal < amountWei) {
      return res.status(400).json({ error: { code: "INSUFFICIENT_LIQUIDITY", message: "Vault lacks THBMock to payout" } });
    }

    const tx = await vaultShares.settleRedemption(requestId);
    await tx.wait();

    return res.json({ data: { txHash: tx.hash } });
  } catch (err) {
    return res.status(500).json({ error: { code: "TX_FAILED", message: err.message } });
  }
});

module.exports = router;