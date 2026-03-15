const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Security & Re-entrancy", function () {
  let vaultShares, fundVault, thbMock, maliciousToken;
  let owner, user, attacker;

  beforeEach(async function () {
    [owner, user, attacker] = await ethers.getSigners();

    const MaliciousToken = await ethers.getContractFactory("MaliciousToken");
    maliciousToken = await MaliciousToken.deploy();
    await maliciousToken.waitForDeployment();

    const VaultShares = await ethers.getContractFactory("VaultShares");
    vaultShares = await VaultShares.deploy(await maliciousToken.getAddress());
    await vaultShares.waitForDeployment();

    const FundVault = await ethers.getContractFactory("FundVault");
    fundVault = await FundVault.deploy(await maliciousToken.getAddress());
    await fundVault.waitForDeployment();

    await vaultShares.setFundVault(await fundVault.getAddress());
    await fundVault.setVaultShares(await vaultShares.getAddress());
  });

  it("Should block re-entrancy attack via malicious ERC20 callback", async function () {
    const amount = ethers.parseEther("100");
    await maliciousToken.mint(attacker.address, amount);
    await maliciousToken.connect(attacker).approve(await vaultShares.getAddress(), amount);
    
    // Set up the malicious token to attack the vaultShares contract on transfer
    await maliciousToken.setAttack(await vaultShares.getAddress(), true);

    // This should NOT revert the parent call if the internal attack call reverts
    // but the actual re-entrancy MUST be blocked.
    // The requirement in MaliciousToken: require(!ok, "Re-entrancy succeeded!") ensuring we catch it.
    await expect(vaultShares.connect(attacker).deposit(amount)).to.not.be.reverted;
  });

  it("Pause Manipulation: Should prevent non-owner from toggling circuit breaker", async function () {
      await expect(vaultShares.connect(user).pause())
          .to.be.revertedWithCustomError(vaultShares, "OwnableUnauthorizedAccount");
      await expect(vaultShares.connect(user).unpause())
          .to.be.revertedWithCustomError(vaultShares, "OwnableUnauthorizedAccount");
  });

  it("Cross-Contract Security: FundVault should only accept payout triggers from VaultShares", async function () {
      // Trying to call FundVault.payoutRedemption directly should fail if not called by VaultShares
      await expect(fundVault.connect(attacker).payoutRedemption(attacker.address, 100))
          .to.be.revertedWithCustomError(fundVault, "Unauthorized");
  });

  it("Ownership Bypass: Should fail if non-owner tries to renounceOwnership", async function () {
      await expect(vaultShares.connect(user).renounceOwnership())
          .to.be.revertedWithCustomError(vaultShares, "OwnableUnauthorizedAccount");
  });
});
