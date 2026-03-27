// src/config.js
const { ethers } = require("ethers");
require("dotenv").config();

const VaultSharesABI = require("../../artifacts/smart-contracts/VaultShares.sol/VaultShares.json").abi;
const FundVaultABI   = require("../../artifacts/smart-contracts/FundVault.sol/FundVault.json").abi;

// ต่อ local hardhat node
const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || "http://127.0.0.1:8545"
);

// Admin wallet — ใช้ private key ของ deployer
const adminWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const vaultShares = new ethers.Contract(
  process.env.VAULT_SHARES_ADDRESS,
  VaultSharesABI,
  adminWallet   // ← sign tx ได้เลย
);

const fundVault = new ethers.Contract(
  process.env.FUND_VAULT_ADDRESS,
  FundVaultABI,
  adminWallet
);

module.exports = { provider, vaultShares, fundVault };