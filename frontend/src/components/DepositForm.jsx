import { useState } from "react";
import { ethers } from "ethers";
import { ADDRESSES } from "../contracts/addresses";
import { VaultSharesABI, THBMockABI } from "../contracts/abis";

export default function DepositForm({ signer, onSuccess }) {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDeposit() {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    setStatus("กำลัง approve...");
    try {
      const thbMock     = new ethers.Contract(ADDRESSES.THBMock, THBMockABI, signer);
      const vaultShares = new ethers.Contract(ADDRESSES.VaultShares, VaultSharesABI, signer);
      const amountWei   = ethers.parseUnits(amount, 18);

      // ขั้นที่ 1: approve ให้ VaultShares ดึงเงินได้
      const approveTx = await thbMock.approve(ADDRESSES.VaultShares, amountWei);
      await approveTx.wait();

      setStatus("กำลัง deposit...");

      // ขั้นที่ 2: deposit
      const depositTx = await vaultShares.deposit(amountWei);
      await depositTx.wait();

      setStatus("✅ Deposit สำเร็จ!");
      setAmount("");
      onSuccess();
    } catch (err) {
      setStatus(`❌ ${err.reason || err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <h2 className="font-semibold mb-4">💰 Deposit THB</h2>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="จำนวน THB"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none"
        />
        <button
          onClick={handleDeposit}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium"
        >
          {loading ? "..." : "Deposit"}
        </button>
      </div>
      {status && <p className="text-xs text-gray-400 mt-2">{status}</p>}
    </div>
  );
}