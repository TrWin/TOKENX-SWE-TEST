const { Router } = require("express");
const { ethers } = require("ethers");
const { vaultShares } = require("../config");

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { nav } = req.body;
    if (!nav || isNaN(Number(nav)) || Number(nav) <= 0) {
      return res.status(400).json({ error: { code: "INVALID_NAV", message: "NAV must be > 0" } });
    }

    const navWei = ethers.parseUnits(String(nav), 18);
    const tx = await vaultShares.setNav(navWei);
    await tx.wait();

    return res.json({ data: { txHash: tx.hash } });
  } catch (err) {
    return res.status(500).json({ error: { code: "TX_FAILED", message: err.message } });
  }
});

module.exports = router;