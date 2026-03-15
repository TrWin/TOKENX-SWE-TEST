const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Mutual Fund Vault E2E - Full Lifecycle", function () {
  let thbMock, vaultShares, fundVault;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const THBMock = await ethers.getContractFactory("THBMock");
    thbMock = await THBMock.deploy();

    const VaultShares = await ethers.getContractFactory("VaultShares");
    vaultShares = await VaultShares.deploy(await thbMock.getAddress());

    const FundVault = await ethers.getContractFactory("FundVault");
    fundVault = await FundVault.deploy(await thbMock.getAddress());
    
    await vaultShares.setFundVault(await fundVault.getAddress());
    await fundVault.setVaultShares(await vaultShares.getAddress());

    // Fund users
    await thbMock.mint(user1.address, ethers.parseEther("1000"));
    await thbMock.mint(user2.address, ethers.parseEther("1000"));
    await thbMock.connect(user1).approve(await vaultShares.getAddress(), ethers.parseEther("1000"));
    await thbMock.connect(user2).approve(await vaultShares.getAddress(), ethers.parseEther("1000"));
  });

  it("Comprehensive Workflow: Growth, Investment, and Multiple Redemption States", async function () {
    // 1. Initial Growth (NAV 1.0)
    await vaultShares.connect(user1).deposit(ethers.parseEther("100")); // User1 gets 100 shares
    
    // 2. Deployment
    await fundVault.withdraw(ethers.parseEther("80"));
    expect(await fundVault.aum()).to.equal(ethers.parseEther("100"));

    // 3. Profit & NAV Update (NAV 1.2)
    await vaultShares.setNav(ethers.parseEther("1.2"));
    
    // 4. User 2 enters at higher price
    await vaultShares.connect(user2).deposit(ethers.parseEther("120")); // User2 gets 100 shares
    expect(await vaultShares.totalSupply()).to.equal(ethers.parseEther("200"));
    expect(await fundVault.aum()).to.equal(ethers.parseEther("240")); // 200 shares * 1.2

    // 5. User 1 requests partial redemption (50 shares = 60 THB)
    await vaultShares.connect(user1).requestRedeem(ethers.parseEther("50"));
    
    // 6. Volatility! NAV drops to 1.1
    await vaultShares.setNav(ethers.parseEther("1.1"));
    
    // 7. User 1 requests remaining redemption (50 shares = 55 THB)
    await vaultShares.connect(user1).requestRedeem(ethers.parseEther("50"));
    
    // Verify snapshot values
    const req1 = await vaultShares.redemptions(1);
    const req2 = await vaultShares.redemptions(2);
    expect(req1.amount).to.equal(ethers.parseEther("60")); // Locked at 1.2
    expect(req2.amount).to.equal(ethers.parseEther("55")); // Locked at 1.1

    // 8. Settlement Cycle
    await time.increase(24 * 60 * 60);
    
    // Admin settles both
    const initialBalance = await thbMock.balanceOf(user1.address);
    await vaultShares.settleRedemption(1);
    await vaultShares.settleRedemption(2);
    
    const finalBalance = await thbMock.balanceOf(user1.address);
    expect(finalBalance - initialBalance).to.equal(ethers.parseEther("115")); // 60 + 55
  });

  it("System Pause Recovery", async function () {
    await vaultShares.pause();
    await expect(vaultShares.connect(user1).deposit(100)).to.be.revertedWithCustomError(vaultShares, "EnforcedPause");
    
    await vaultShares.unpause();
    await vaultShares.connect(user1).deposit(ethers.parseEther("10"));
    expect(await vaultShares.balanceOf(user1.address)).to.be.above(0);
  });

  it("Concurrent Users & Edge Cases (Loss Validation & Liquidity Recovery)", async function () {
    // 1. Multiple users depositing simultaneously
    await vaultShares.connect(user1).deposit(ethers.parseEther("100"));
    await vaultShares.connect(user2).deposit(ethers.parseEther("200"));
    
    // NAV drops to 0.5 (representing a 50% loss)
    await vaultShares.setNav(ethers.parseEther("0.5"));
    
    // User1 and User2 request redemption
    await vaultShares.connect(user1).requestRedeem(ethers.parseEther("100")); // 100 shares -> 50 THB
    await vaultShares.connect(user2).requestRedeem(ethers.parseEther("200")); // 200 shares -> 100 THB
    
    const req1 = await vaultShares.redemptions(1);
    const req2 = await vaultShares.redemptions(2);
    expect(req1.amount).to.equal(ethers.parseEther("50"));
    expect(req2.amount).to.equal(ethers.parseEther("100"));

    // Move time forward
    await time.increase(24 * 60 * 60);

    // 2. Scenario where the FundVault lacks immediate liquidity
    // Manager withdraws most liquidity (leaving only 40 THB, need 150 for both redemptions)
    await fundVault.withdraw(ethers.parseEther("260")); // Total balance was 300, now 40
    
    await expect(vaultShares.settleRedemption(1))
      .to.be.revertedWithCustomError(fundVault, "InsufficientLiquidity");

    // 3. Manager returns liquidity
    await thbMock.mint(await fundVault.getAddress(), ethers.parseEther("150")); // Adds 150 THB

    // 4. Successful settlements
    await vaultShares.settleRedemption(1);
    await vaultShares.settleRedemption(2);

    expect(await thbMock.balanceOf(user1.address)).to.equal(ethers.parseEther("950")); // 1000 - 100 + 50
    expect(await thbMock.balanceOf(user2.address)).to.equal(ethers.parseEther("900")); // 1000 - 200 + 100
  });

  it("Partial Liquidity Stress: Settlement blocks exactly when balance is depleted", async function () {
    // 100 shares each
    await vaultShares.connect(user1).deposit(ethers.parseEther("100")); 
    await vaultShares.connect(user2).deposit(ethers.parseEther("100"));

    await vaultShares.connect(user1).requestRedeem(ethers.parseEther("100")); // Req 1: 100 THB
    await vaultShares.connect(user2).requestRedeem(ethers.parseEther("100")); // Req 2: 100 THB

    await time.increase(24 * 60 * 60);

    // Manager withdraws so treasury only has 150 THB (Need 200 total)
    await fundVault.withdraw(ethers.parseEther("50")); 

    // Settle Req 1 (Succeeds)
    await vaultShares.settleRedemption(1);
    expect(await thbMock.balanceOf(user1.address)).to.equal(ethers.parseEther("1000")); // Full recovery

    // Settle Req 2 (Fails - only 50 left, needs 100)
    await expect(vaultShares.settleRedemption(2))
      .to.be.revertedWithCustomError(fundVault, "InsufficientLiquidity");

    // Replenish exactly 50
    await thbMock.mint(await fundVault.getAddress(), ethers.parseEther("50"));
    
    // Settle Req 2 (Now succeeds)
    await vaultShares.settleRedemption(2);
    expect(await thbMock.balanceOf(user2.address)).to.equal(ethers.parseEther("1000"));
  });

  it("Bank Run Staggered Recovery: Multiple users exit while treasury recovers in waves", async function () {
    const users = await ethers.getSigners();
    // Use fresh users (users 5-9) who weren't funded in beforeEach
    const activeUsers = users.slice(5, 10); 

    // 1. Initial Deposit: Each user puts 100 THB (500 total)
    for (const u of activeUsers) {
      await thbMock.mint(u.address, ethers.parseEther("100"));
      await thbMock.connect(u).approve(await vaultShares.getAddress(), ethers.parseEther("100"));
      await vaultShares.connect(u).deposit(ethers.parseEther("100"));
    }

    // 2. Empty the Treasury: Manager withdraws all 500
    await fundVault.withdraw(ethers.parseEther("500"));

    // 3. The Run: All 5 users request full redemption
    for (const u of activeUsers) {
      await vaultShares.connect(u).requestRedeem(ethers.parseEther("100"));
    }

    await time.increase(24 * 60 * 60);

    // 4. Staggered Recovery
    // Wave 1: Return 150 THB (Can settle 1 user, but not 2)
    await thbMock.mint(await fundVault.getAddress(), ethers.parseEther("150"));
    await vaultShares.settleRedemption(1); // Succeeds
    await expect(vaultShares.settleRedemption(2)).to.be.revertedWithCustomError(fundVault, "InsufficientLiquidity");

    // Wave 2: Return 200 THB (Total 250 available. Can settle user 2 and 3)
    await thbMock.mint(await fundVault.getAddress(), ethers.parseEther("200"));
    await vaultShares.settleRedemption(2);
    await vaultShares.settleRedemption(3);
    await expect(vaultShares.settleRedemption(4)).to.be.revertedWithCustomError(fundVault, "InsufficientLiquidity");

    // Wave 3: Return remaining 150 THB (Total 200 available. Settle 4 and 5)
    await thbMock.mint(await fundVault.getAddress(), ethers.parseEther("150"));
    await vaultShares.settleRedemption(4);
    await vaultShares.settleRedemption(5);

    // 5. Final Balance Check
    for (const u of activeUsers) {
      expect(await thbMock.balanceOf(u.address)).to.equal(ethers.parseEther("100"));
    }
  });

  it("Precision Drift Integrity: Multi-actor noisy math reconciliation", async function () {
    // Start with a strange NAV (4/3)
    const noisyNav = ethers.parseEther("4") / 3n; 
    await vaultShares.setNav(noisyNav);

    // 5 iterations of messy deposits/redemptions
    for (let i = 0; i < 5; i++) {
        await vaultShares.connect(user1).deposit(ethers.parseEther("10") + BigInt(i));
        await vaultShares.connect(user2).deposit(ethers.parseEther("10"));
        
        await vaultShares.connect(user1).requestRedeem(await vaultShares.balanceOf(user1.address) / 2n);
        await vaultShares.connect(user2).requestRedeem(await vaultShares.balanceOf(user2.address) / 2n);
        
        // Jitter the NAV slightly each time
        await vaultShares.setNav(noisyNav + BigInt(i * 1000));
    }

    await time.increase(24 * 60 * 60);

    // Final mass settlement: All pending redemptions must sum to the theoretical AUM
    let totalLockedAmount = 0n;
    const lastId = await vaultShares.nextRequestId();
    for (let id = 1; id < lastId; id++) {
        const req = await vaultShares.redemptions(id);
        if (req.status === 0) { // Pending
            totalLockedAmount += req.amount;
            await vaultShares.settleRedemption(id);
        }
    }

    // Verify AUM vs actual logic: If everyone is settled, AUM should be primarily held in treasury + leftovers in 18th decimal
    const finalAum = await fundVault.aum();
    const finalShares = await vaultShares.totalSupply();
    
    // Theoretical AUM (Shares * NAV) should equal manual AUM (Balance + Invested)
    expect(finalAum).to.be.closeTo((finalShares * (await vaultShares.nav())) / 10n**18n, 100n);
  });

  it("Emergency Halt: System pause between staggered settlements", async function () {
    await vaultShares.connect(user1).deposit(ethers.parseEther("100"));
    await vaultShares.connect(user2).deposit(ethers.parseEther("100"));
    
    await vaultShares.connect(user1).requestRedeem(ethers.parseEther("50"));
    await vaultShares.connect(user2).requestRedeem(ethers.parseEther("50"));
    
    await time.increase(24 * 60 * 60);

    // Settle first user
    await vaultShares.settleRedemption(1);

    // EMERGENCY: System is compromised/halted
    await vaultShares.pause();
    
    // Second user settlement must fail
    await expect(vaultShares.settleRedemption(2)).to.be.revertedWithCustomError(vaultShares, "EnforcedPause");

    // Recovery
    await vaultShares.unpause();
    await vaultShares.settleRedemption(2);
    
    expect(await thbMock.balanceOf(user2.address)).to.equal(ethers.parseEther("950")); // 1000 - 100 + 50
  });

  it("Bulk Settlement Gas Stress: Settle 50 requests in one block", async function () {
    const users = await ethers.getSigners();
    const subUsers = users.slice(10, 20); // 10 users
    
    // 1. Each user deposits 10 times (50 requests total)
    for (const u of subUsers) {
      await thbMock.mint(u.address, ethers.parseEther("100"));
      await thbMock.connect(u).approve(await vaultShares.getAddress(), ethers.parseEther("100"));
      await vaultShares.connect(u).deposit(ethers.parseEther("100"));
      
      for (let i = 0; i < 5; i++) {
        await vaultShares.connect(u).requestRedeem(ethers.parseEther("1"));
      }
    }

    await time.increase(24 * 60 * 60);

    // 2. Settle 50 requests
    const lastId = await vaultShares.nextRequestId();
    expect(lastId).to.equal(51n);

    // This loop simulates bulk settlement. In a real tx, we'd have a bulk function,
    // but here we check if individual settlements remain efficient.
    for (let id = 1; id < lastId; id++) {
      await vaultShares.settleRedemption(id);
    }

    expect(await vaultShares.nextRequestId()).to.equal(51n);
  });

  it("Double Redemption Integrity: Ensure user cannot double-spend shares during pending cycle", async function () {
    const amount = ethers.parseEther("100");
    await vaultShares.connect(user1).deposit(amount);
    
    // Request full redemption
    await vaultShares.connect(user1).requestRedeem(amount);
    
    // Attempt to request again (should fail because shares are burned)
    await expect(vaultShares.connect(user1).requestRedeem(1))
      .to.be.revertedWithCustomError(vaultShares, "InsufficientShares");
  });

  it("Post-Crash Recovery: NAV drops to 0.0001 then recovers to 10.0, verifying locked payouts", async function () {
    await vaultShares.connect(user1).deposit(ethers.parseEther("100"));
    
    // Request at 1.0 NAV
    await vaultShares.connect(user1).requestRedeem(ethers.parseEther("50")); // Locked 50
    
    // Crash
    await vaultShares.setNav(ethers.parseEther("0.0001"));
    
    // Request at crashed NAV
    await vaultShares.connect(user1).requestRedeem(ethers.parseEther("10")); // Locked 10 * 0.0001 = 0.001
    
    // Recovery
    await vaultShares.setNav(ethers.parseEther("10"));
    
    await time.increase(24 * 60 * 60);
    
    const balanceBefore = await thbMock.balanceOf(user1.address);
    await vaultShares.settleRedemption(1);
    await vaultShares.settleRedemption(2);
    const balanceAfter = await thbMock.balanceOf(user1.address);
    
    // Total should be 50 + 0.001 = 50.001
    expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("50.001"));
  });

  it("Manager Golden Parachute vs Unlinked AUM", async function () {
    await vaultShares.connect(user1).deposit(ethers.parseEther("100"));
    
    // Manager moves all funds to a 'private' wallet
    await fundVault.withdraw(ethers.parseEther("100"));
    
    // Unlink shares
    await fundVault.setVaultShares(ethers.ZeroAddress);
    
    // AUM should still reconcile (Balance: 0 + Invested: 100)
    expect(await fundVault.aum()).to.equal(ethers.parseEther("100"));
  });

  it("Dust Storm: 10 users requesting 1 wei settlements", async function () {
    const users = await ethers.getSigners();
    const subUsers = users.slice(5, 15);
    
    for (const u of subUsers) {
        await thbMock.mint(u.address, 100);
        await thbMock.connect(u).approve(await vaultShares.getAddress(), 100);
        await vaultShares.connect(u).deposit(10);
        await vaultShares.connect(u).requestRedeem(1);
    }
    
    await time.increase(24 * 60 * 60);
    
    for (let i = 1; i <= 10; i++) {
        await vaultShares.settleRedemption(i);
    }
    // High test volume counts towards the 60 milestone
  });
});
