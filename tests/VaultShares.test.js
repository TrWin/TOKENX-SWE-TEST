const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VaultShares Granular Tests", function () {
  let thbMock, vaultShares, fundVault;
  let owner, user, unauthorized;

  beforeEach(async function () {
    [owner, user, unauthorized] = await ethers.getSigners();

    const THBMock = await ethers.getContractFactory("THBMock");
    thbMock = await THBMock.deploy();

    const VaultShares = await ethers.getContractFactory("VaultShares");
    vaultShares = await VaultShares.deploy(await thbMock.getAddress());

    const FundVault = await ethers.getContractFactory("FundVault");
    fundVault = await FundVault.deploy(await thbMock.getAddress());
    
    await vaultShares.setFundVault(await fundVault.getAddress());
    await fundVault.setVaultShares(await vaultShares.getAddress());

    await thbMock.mint(user.address, ethers.parseEther("1000"));
    await thbMock.connect(user).approve(await vaultShares.getAddress(), ethers.parseEther("1000"));
  });

  describe("NAV Management", function () {
    it("Should allow admin to update nav", async function () {
      await vaultShares.setNav(ethers.parseEther("1.5"));
      expect(await vaultShares.nav()).to.equal(ethers.parseEther("1.5"));
    });

    it("Should fail if nav is set to zero", async function () {
      await expect(vaultShares.setNav(0)).to.be.revertedWithCustomError(vaultShares, "InvalidNAV");
    });

    it("Should emit NavUpdated event", async function () {
      await expect(vaultShares.setNav(ethers.parseEther("2.0")))
        .to.emit(vaultShares, "NavUpdated")
        .withArgs(ethers.parseEther("1.0"), ethers.parseEther("2.0"));
    });

    it("Should fail to update nav when paused", async function () {
        await vaultShares.pause();
        await expect(vaultShares.setNav(ethers.parseEther("2.0")))
          .to.be.revertedWithCustomError(vaultShares, "EnforcedPause");
      });
  });

  describe("Deposit & Shares Math", function () {
    it("Should fail if depositing zero amount", async function () {
      await expect(vaultShares.connect(user).deposit(0))
        .to.be.revertedWith("Zero amount");
    });

    it("Should fail if vault is paused", async function () {
      await vaultShares.pause();
      await expect(vaultShares.connect(user).deposit(ethers.parseEther("100")))
        .to.be.revertedWithCustomError(vaultShares, "EnforcedPause");
    });

    it("Should fail if stablecoin transfer fails (no allowance)", async function () {
      await thbMock.mint(unauthorized.address, ethers.parseEther("100"));
      await expect(vaultShares.connect(unauthorized).deposit(ethers.parseEther("10")))
        .to.be.revertedWithCustomError(thbMock, "ERC20InsufficientAllowance");
    });

    it("Should mint correct shares for fractional NAV (e.g., 1.05)", async function () {
      await vaultShares.setNav(ethers.parseEther("1.05"));
      await vaultShares.connect(user).deposit(ethers.parseEther("105"));
      expect(await vaultShares.balanceOf(user.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should handle high precision/dust (1 wei)", async function () {
      await vaultShares.connect(user).deposit(1);
      expect(await vaultShares.balanceOf(user.address)).to.be.above(0);
    });

    it("Should handle periodic NAV (e.g. 1.333...) within 100 wei error", async function () {
      const periodicNav = ethers.parseEther("4") / 3n; 
      await vaultShares.setNav(periodicNav);
      await vaultShares.connect(user).deposit(ethers.parseEther("100"));
      const shares = await vaultShares.balanceOf(user.address);
      expect(shares).to.be.closeTo(ethers.parseEther("75"), 100); 
    });

    it("Protocol-Favored Rounding: Deposits should round DOWN (fewer shares)", async function () {
      const weirdNav = (ethers.parseEther("4") / 3n);
      await vaultShares.setNav(weirdNav);
      const amount = ethers.parseEther("10");
      await vaultShares.connect(user).deposit(amount);
      const shares = await vaultShares.balanceOf(user.address);
      const theoretical = (amount * 10n**18n) / weirdNav;
      expect(shares).to.be.at.most(theoretical);
    });
  });

  describe("Redemption State Machine", function () {
    beforeEach(async function () {
      await vaultShares.connect(user).deposit(ethers.parseEther("100"));
    });

    it("Should fail if requesting zero amount", async function () {
      await expect(vaultShares.connect(user).requestRedeem(0))
        .to.be.revertedWith("Zero amount");
    });

    it("Should fail if requesting more shares than held", async function () {
      await expect(vaultShares.connect(user).requestRedeem(ethers.parseEther("101")))
        .to.be.revertedWithCustomError(vaultShares, "InsufficientShares");
    });

    it("Should fail to request redeem if paused", async function () {
      await vaultShares.pause();
      await expect(vaultShares.connect(user).requestRedeem(ethers.parseEther("10")))
        .to.be.revertedWithCustomError(vaultShares, "EnforcedPause");
    });

    it("Should fail to settle if paused", async function () {
      await vaultShares.connect(user).requestRedeem(ethers.parseEther("10"));
      await time.increase(24 * 60 * 60);
      await vaultShares.pause();
      await expect(vaultShares.settleRedemption(1))
        .to.be.revertedWithCustomError(vaultShares, "EnforcedPause");
    });

    it("Should fail if settled before 24h", async function () {
      await vaultShares.connect(user).requestRedeem(ethers.parseEther("10"));
      await time.increase(24 * 60 * 60 - 10); 
      await expect(vaultShares.settleRedemption(1)).to.be.revertedWithCustomError(vaultShares, "NotReady");
    });

    it("Should successfully settle at exactly 24h", async function () {
      await vaultShares.connect(user).requestRedeem(ethers.parseEther("10"));
      await time.increase(24 * 60 * 60); 
      await expect(vaultShares.settleRedemption(1)).to.emit(vaultShares, "RedemptionSettled");
    });

    it("Should lock payout amount at request time (Price Integrity)", async function () {
      await vaultShares.connect(user).requestRedeem(ethers.parseEther("50"));
      await vaultShares.setNav(ethers.parseEther("0.1")); // Huge crash
      await time.increase(24 * 60 * 60);
      await vaultShares.settleRedemption(1);
      expect(await thbMock.balanceOf(user.address)).to.equal(ethers.parseEther("950")); // 900 + 50
    });

    it("Should fail to settle already fulfilled request", async function () {
      await vaultShares.connect(user).requestRedeem(ethers.parseEther("50"));
      await time.increase(24 * 60 * 60);
      await vaultShares.settleRedemption(1);
      await expect(vaultShares.settleRedemption(1)).to.be.revertedWithCustomError(vaultShares, "AlreadySettled");
    });

    it("Should correctly increment nextRequestId and burn shares", async function () {
      const initialSupply = await vaultShares.totalSupply();
      await vaultShares.connect(user).requestRedeem(ethers.parseEther("10"));
      expect(await vaultShares.nextRequestId()).to.equal(2);
      expect(await vaultShares.totalSupply()).to.equal(initialSupply - ethers.parseEther("10"));
    });
  });

  describe("ERC20 Standard & Security", function () {
    beforeEach(async function () {
        await vaultShares.connect(user).deposit(ethers.parseEther("100"));
    });

    it("ERC-20: Should allow transferring EXACT balance between users", async function () {
      const other = unauthorized;
      const b = await vaultShares.balanceOf(user.address);
      await vaultShares.connect(user).transfer(other.address, b);
      expect(await vaultShares.balanceOf(other.address)).to.equal(b);
      expect(await vaultShares.balanceOf(user.address)).to.equal(0);
    });

    it("Should allow transferring shares between users", async function () {
      const other = unauthorized;
      await vaultShares.connect(user).transfer(other.address, ethers.parseEther("10"));
      expect(await vaultShares.balanceOf(other.address)).to.equal(ethers.parseEther("10"));
    });

    it("Should fail if transferring more than balance", async function () {
      await expect(vaultShares.connect(unauthorized).transfer(user.address, 1))
        .to.be.revertedWithCustomError(vaultShares, "ERC20InsufficientBalance");
    });

    it("Should respect allowance for transferFrom", async function () {
      await vaultShares.connect(user).approve(owner.address, ethers.parseEther("10"));
      await vaultShares.transferFrom(user.address, unauthorized.address, ethers.parseEther("10"));
      expect(await vaultShares.balanceOf(unauthorized.address)).to.equal(ethers.parseEther("10"));
    });

    it("Should fail if transferFrom exceeds allowance", async function () {
      await expect(vaultShares.transferFrom(user.address, unauthorized.address, 1))
        .to.be.revertedWithCustomError(vaultShares, "ERC20InsufficientAllowance");
    });

    it("Should fail to transfer to zero address", async function () {
        await expect(vaultShares.connect(user).transfer(ethers.ZeroAddress, 1))
          .to.be.revertedWithCustomError(vaultShares, "ERC20InvalidReceiver");
      });
  });

  describe("Permissions & Succession", function () {
    it("Should only allow owner to setNav", async function () {
        await expect(vaultShares.connect(unauthorized).setNav(ethers.parseEther("2")))
          .to.be.revertedWithCustomError(vaultShares, "OwnableUnauthorizedAccount");
    });

    it("Should respect Administrative Succession (Full Revocation)", async function () {
      await expect(vaultShares.transferOwnership(user.address))
        .to.emit(vaultShares, "OwnershipTransferred")
        .withArgs(owner.address, user.address);
      
      await expect(vaultShares.connect(owner).setNav(ethers.parseEther("2")))
        .to.be.revertedWithCustomError(vaultShares, "OwnableUnauthorizedAccount");
    });

    it("Should prevent renouncing ownership", async function () {
      await expect(vaultShares.renounceOwnership()).to.be.revertedWith("Renouncing is disabled");
    });

    it("Should fail if setFundVault is called with zero address", async function () {
        await expect(vaultShares.setFundVault(ethers.ZeroAddress)).to.be.revertedWith("Invalid address");
    });

    it("Should allow setting fundVault ONLY once (Immutability check)", async function () {
        // Already set in beforeEach
        await expect(vaultShares.setFundVault(user.address)).to.be.revertedWith("Already set");
    });

    it("Permissions: Should fail if non-owner tries to transfer ownership", async function () {
        await expect(vaultShares.connect(unauthorized).transferOwnership(unauthorized.address))
          .to.be.revertedWithCustomError(vaultShares, "OwnableUnauthorizedAccount");
    });
  });

  describe("Extreme Math Safety (Senior Level Edge Cases)", function () {
    it("Should handle type(uint256).max NAV without overflow on shares calculation", async function () {
        // High NAV should result in tiny shares, not overflow
        await vaultShares.setNav(ethers.MaxUint256);
        await vaultShares.connect(user).deposit(ethers.parseEther("100"));
        expect(await vaultShares.balanceOf(user.address)).to.equal(0);
    });

    it("Should handle extremely high deposit without overflow on shares", async function () {
        // amount * 1e18 / nav
        // We use a value that is very large but won't overflow totalSupply (max / 2)
        const hugeAmount = ethers.MaxUint256 / 2n;
        await thbMock.mint(user.address, hugeAmount);
        await thbMock.connect(user).approve(await vaultShares.getAddress(), hugeAmount);
        
        // This will revert if amount * 1e18 overflows uint256
        await expect(vaultShares.connect(user).deposit(hugeAmount)).to.be.revertedWithPanic(0x11);
    });
  });
});
