const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FundVault Granular Tests", function () {
  let thbMock, vaultShares, fundVault;
  let owner, user, unauthorized;

  beforeEach(async function () {
    [owner, user, unauthorized] = await ethers.getSigners();

    const THBMock = await ethers.getContractFactory("THBMock");
    thbMock = await THBMock.deploy();

    const FundVault = await ethers.getContractFactory("FundVault");
    fundVault = await FundVault.deploy(await thbMock.getAddress());
  });

  describe("Treasury Management", function () {
    it("Should track balance correctly", async function () {
      await thbMock.mint(await fundVault.getAddress(), ethers.parseEther("100"));
      expect(await fundVault.balance()).to.equal(ethers.parseEther("100"));
    });

    it("Should allow manager to withdraw", async function () {
      await thbMock.mint(await fundVault.getAddress(), ethers.parseEther("100"));
      await fundVault.withdraw(ethers.parseEther("40"));
      expect(await fundVault.balance()).to.equal(ethers.parseEther("60"));
      expect(await fundVault.investedAmount()).to.equal(ethers.parseEther("40"));
    });

    it("Should calculate AUM correctly based on vaultShares totalSupply and nav", async function () {
      const VaultShares = await ethers.getContractFactory("VaultShares");
      vaultShares = await VaultShares.deploy(await thbMock.getAddress());
      await vaultShares.setFundVault(await fundVault.getAddress());
      await fundVault.setVaultShares(await vaultShares.getAddress());

      await vaultShares.setNav(ethers.parseEther("2"));
      await thbMock.mint(user.address, ethers.parseEther("100"));
      await thbMock.connect(user).approve(await vaultShares.getAddress(), ethers.parseEther("100"));
      await vaultShares.connect(user).deposit(ethers.parseEther("100")); // Mints 50 shares
      
      expect(await fundVault.aum()).to.equal(ethers.parseEther("100")); // 50 * 2.0
    });

    it("AUM Divergence: Should include manual stablecoin transfers in AUM if shares are zero", async function () {
      await thbMock.mint(await fundVault.getAddress(), ethers.parseEther("500"));
      expect(await fundVault.aum()).to.equal(ethers.parseEther("500"));
    });

    it("Should fail if manager withdraws zero amount", async function () {
        await expect(fundVault.withdraw(0))
          .to.be.revertedWith("Zero amount"); // If not implemented, this might fail, let's check
    });

    it("Should fail if manager withdraws more than available balance", async function () {
      await thbMock.mint(await fundVault.getAddress(), ethers.parseEther("100"));
      await expect(fundVault.withdraw(ethers.parseEther("101")))
        .to.be.revertedWithCustomError(fundVault, "InsufficientLiquidity");
    });

    it("AUM Precision: Should handle extremely high NAV (1,000,000)", async function () {
        const VaultShares = await ethers.getContractFactory("VaultShares");
        vaultShares = await VaultShares.deploy(await thbMock.getAddress());
        await vaultShares.setFundVault(await fundVault.getAddress());
      await fundVault.setVaultShares(await vaultShares.getAddress());

        await vaultShares.setNav(ethers.parseEther("1000000"));
        await thbMock.mint(user.address, ethers.parseEther("1000000"));
        await thbMock.connect(user).approve(await vaultShares.getAddress(), ethers.parseEther("1000000"));
        await vaultShares.connect(user).deposit(ethers.parseEther("1000000")); // 1 share
        
        expect(await fundVault.aum()).to.equal(ethers.parseEther("1000000"));
    });
  });

  describe("Permissions & Security", function () {
    it("Should only allow authorized VaultShares to trigger payouts", async function () {
      const VaultShares = await ethers.getContractFactory("VaultShares");
      vaultShares = await VaultShares.deploy(await thbMock.getAddress());
      await fundVault.setVaultShares(await vaultShares.getAddress());

      await expect(fundVault.connect(unauthorized).payoutRedemption(user.address, 100))
        .to.be.revertedWithCustomError(fundVault, "Unauthorized");
    });

    it("Should fail if non-owner tries to set vaultShares contract", async function () {
      await expect(fundVault.connect(unauthorized).setVaultShares(user.address))
        .to.be.revertedWithCustomError(fundVault, "OwnableUnauthorizedAccount");
    });

    it("Should fail if non-owner tries to withdraw", async function () {
      await expect(fundVault.connect(unauthorized).withdraw(ethers.parseEther("10")))
        .to.be.revertedWithCustomError(fundVault, "OwnableUnauthorizedAccount");
    });

    it("Should fail if non-owner tries to pause or unpause", async function () {
      await expect(fundVault.connect(unauthorized).pause())
        .to.be.revertedWithCustomError(fundVault, "OwnableUnauthorizedAccount");
    });

    it("Security: Should fail if payoutRedemption results in insufficient liquidity", async function () {
        await fundVault.setVaultShares(owner.address); // Temporarily authorized
        await expect(fundVault.payoutRedemption(user.address, 100))
          .to.be.revertedWithCustomError(fundVault, "InsufficientLiquidity");
      });
  });

  describe("Circuit Breaker (Pausable)", function () {
    it("Should prevent withdrawals when paused", async function () {
      await fundVault.pause();
      await expect(fundVault.withdraw(ethers.parseEther("10")))
        .to.be.revertedWithCustomError(fundVault, "EnforcedPause");
    });

    it("Should allow withdrawals after unpausing", async function () {
      await thbMock.mint(await fundVault.getAddress(), ethers.parseEther("100"));
      await fundVault.pause();
      await fundVault.unpause();
      await fundVault.withdraw(ethers.parseEther("10"));
      expect(await fundVault.balance()).to.equal(ethers.parseEther("90"));
    });

    it("Should emit Withdrawal and Payout events correctly", async function () {
        await thbMock.mint(await fundVault.getAddress(), ethers.parseEther("100"));
        await expect(fundVault.withdraw(ethers.parseEther("10")))
          .to.emit(fundVault, "Withdrawal")
          .withArgs(owner.address, ethers.parseEther("10"));
        
        await fundVault.setVaultShares(owner.address);
        await expect(fundVault.payoutRedemption(user.address, ethers.parseEther("5")))
          .to.emit(fundVault, "Payout")
          .withArgs(user.address, ethers.parseEther("5"));
    });
  });
});
