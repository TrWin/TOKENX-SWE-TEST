const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. Deploy THBMock (stablecoin)
  const THBMock = await ethers.getContractFactory("THBMock");
  const thbMock = await THBMock.deploy();
  await thbMock.waitForDeployment();
  console.log("THBMock deployed to:     ", await thbMock.getAddress());

  // 2. Deploy FundVault (ส่ง stablecoin address เข้าไป)
  const FundVault = await ethers.getContractFactory("FundVault");
  const fundVault = await FundVault.deploy(await thbMock.getAddress());
  await fundVault.waitForDeployment();
  console.log("FundVault deployed to:   ", await fundVault.getAddress());

  // 3. Deploy VaultShares (ส่ง stablecoin address เข้าไป)
  const VaultShares = await ethers.getContractFactory("VaultShares");
  const vaultShares = await VaultShares.deploy(await thbMock.getAddress());
  await vaultShares.waitForDeployment();
  console.log("VaultShares deployed to: ", await vaultShares.getAddress());

  // 4. เชื่อม 2 contracts เข้าหากัน
  await fundVault.setVaultShares(await vaultShares.getAddress());
  await vaultShares.setFundVault(await fundVault.getAddress());
  console.log("✅ Contracts linked");

  // 5. Mint THB ให้ deployer สำหรับ test (1,000,000 THB)
  await thbMock.mint(deployer.address, ethers.parseUnits("1000000", 18));
  console.log("✅ Minted 1,000,000 THB to deployer");

  // 6. เขียน address ลงไฟล์ให้ Frontend และ Backend ใช้ต่อ
  const addresses = {
    THBMock:     await thbMock.getAddress(),
    FundVault:   await fundVault.getAddress(),
    VaultShares: await vaultShares.getAddress(),
  };

  // เขียน deployment.json ไว้กลาง project
  fs.writeFileSync(
    path.join(__dirname, "../../deployment.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("✅ Saved to deployment.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});