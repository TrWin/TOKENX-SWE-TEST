import { useState } from "react";
import { ethers } from "ethers";
import { useVault } from "./hooks/useVault";
import StatsPanel from "./components/StatsPanel";
import DepositForm from "./components/DepositForm";
import RedeemForm from "./components/RedeemForm";

export default function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const { data, loading, refetch } = useVault(account, provider);

  async function connectWallet() {
    if (!window.ethereum) return alert("กรุณาติดตั้ง MetaMask ก่อน");

    const _provider = new ethers.BrowserProvider(window.ethereum);
    const _signer   = await _provider.getSigner();
    const _account  = await _signer.getAddress();

    setProvider(_provider);
    setSigner(_signer);
    setAccount(_account);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">🏦 Mutual Fund Vault</h1>
          {!account ? (
            <button
              onClick={connectWallet}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Connect Wallet
            </button>
          ) : (
            <span className="text-xs bg-gray-800 px-3 py-2 rounded-lg text-gray-400">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
          )}
        </div>

        {/* Stats */}
        <StatsPanel data={data} loading={loading} />

        {/* Forms — แสดงเมื่อ connect wallet แล้ว */}
        {account && signer && (
          <>
            <DepositForm signer={signer} onSuccess={refetch} />
            <RedeemForm  signer={signer} onSuccess={refetch} />
          </>
        )}

      </div>
    </div>
  );
}