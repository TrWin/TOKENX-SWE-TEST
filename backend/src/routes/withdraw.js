const { Router } = require("express");
const { ethers } = require("ethers");
const { fundVault } = require("../config");

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: { code: "INVALID_AMOUNT", message: "Amount must be > 0" } });
    }

    const amountWei = ethers.parseUnits(String(amount), 18);

    const bal = await fundVault.balance();
    if (bal < amountWei) {
      return res.status(400).json({
        error: {
          code: "INSUFFICIENT_TREASURY_BALANCE",
          message: "Vault has less THB than requested",
        },
      });
    }

    const tx = await fundVault.withdraw(amountWei);
    await tx.wait();

    return res.json({ data: { txHash: tx.hash } });
  } catch (err) {
    return res.status(500).json({ error: { code: "TX_FAILED", message: err.message } });
  }
});

module.exports = router;