import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ADDRESSES } from "../contracts/addresses";
import { VaultSharesABI, FundVaultABI, THBMockABI } from "../contracts/abis";

export function useVault(account, provider) {
  const [data, setData] = useState({
    nav: "0",
    userShares: "0",
    totalSupply: "0",
    treasuryBalance: "0",
    aum: "0",
    userThbBalance: "0",
  });
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!provider || !account) return;
    setLoading(true);
    try {
      const vaultShares = new ethers.Contract(ADDRESSES.VaultShares, VaultSharesABI, provider);
      const fundVault   = new ethers.Contract(ADDRESSES.FundVault, FundVaultABI, provider);
      const thbMock     = new ethers.Contract(ADDRESSES.THBMock, THBMockABI, provider);

      const [nav, userShares, totalSupply, treasuryBalance, aum, userThb] = await Promise.all([
        vaultShares.nav(),
        vaultShares.balanceOf(account),
        vaultShares.totalSupply(),
        fundVault.balance(),
        fundVault.aum(),
        thbMock.balanceOf(account),
      ]);

      setData({
        nav:              ethers.formatUnits(nav, 18),
        userShares:       ethers.formatUnits(userShares, 18),
        totalSupply:      ethers.formatUnits(totalSupply, 18),
        treasuryBalance:  ethers.formatUnits(treasuryBalance, 18),
        aum:              ethers.formatUnits(aum, 18),
        userThbBalance:   ethers.formatUnits(userThb, 18),
      });
    } catch (err) {
      console.error("fetchData error:", err);
    } finally {
      setLoading(false);
    }
  }, [provider, account]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refetch: fetchData };
}