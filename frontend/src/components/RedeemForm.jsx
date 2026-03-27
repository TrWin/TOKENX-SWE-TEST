import { useState } from "react";
import { ethers } from "ethers";
import { ADDRESSES } from "../contracts/addresses";
import { VaultSharesABI } from "../contracts/abis";

export default function RedeemForm({ signer, onSuccess }) {
  const [shares, setShares] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRedeem() {
    if (!shares || Number(shares) <= 0) return;
    setLoading(true);
    setStatus("กำลังส่ง request...");
    try {
      const vaultShares = new ethers.Contract(ADDRESSES.VaultShares, VaultSharesABI, signer);
      const sharesWei   = ethers.parseUnits(shares, 18);

      const tx = await vaultShares.requestRedeem(sharesWei);
      await tx.wait();

      setStatus("✅ Request สำเร็จ! รอ 24h แล้ว Admin จะ settle");
      setShares("");
      onSuccess();
    } catch (err) {
      setStatus(`❌ ${err.reason || err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <h2 className="font-semibold mb-4">🔁 Request Redeem</h2>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="จำนวน vTHB shares"
          value={shares}
          onChange={e => setShares(e.target.value)}
          className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none"
        />
        <button
          onClick={handleRedeem}
          disabled={loading}
          className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium"
        >
          {loading ? "..." : "Request"}
        </button>
      </div>
      {status && <p className="text-xs text-gray-400 mt-2">{status}</p>}
    </div>
  );
}