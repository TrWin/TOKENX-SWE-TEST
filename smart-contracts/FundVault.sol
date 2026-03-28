// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title FundVault
 * @notice Treasury and custodian for the fund's assets.
 * @dev THE CORE TASK:
 * 1. Securely store and manage stablecoin assets.
 * 2. Implement `withdraw(uint256)`: managed withdrawal for investment deployments.
 * 3. Implement authorization: restrict user payouts to `VaultShares` only.
 *
 * 💡 REQUIREMENT:
 * Standard events (Withdrawal, Payout) must be emitted for off-chain reconciliation.
 * You are allowed and encouraged to use standard OpenZeppelin contracts.
 */

interface IVaultShares {
    function nav() external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

contract FundVault is Ownable, Pausable {
    using SafeERC20 for IERC20;

    error Unauthorized();
    error InsufficientLiquidity();

    event Withdrawal(address indexed to, uint256 amount);
    event Payout(address indexed to, uint256 amount);

    // TODO: Define state variables
    // REQUIRED: stablecoin, vaultShares, investedAmount
    IERC20 public stablecoin;
    address public vaultShares;
    uint256 public investedAmount;

    modifier onlyVaultShares() {
        if (msg.sender != vaultShares) revert Unauthorized();
        _;
    }

    constructor(address _stablecoin) Ownable(msg.sender) {
        // TODO: Initialize contract state
        stablecoin = IERC20(_stablecoin);
    }

    /// @notice Sets the authorized VaultShares address.
    /// @dev Only callable by Admin.
    function setVaultShares(address _vaultShares) external onlyOwner {
        // TODO: Implementation
        vaultShares = _vaultShares;
    }

    /// @notice Withdraws stablecoins from the vault for fund deployment.
    /// @dev Access control and pause-state validation required.
    function withdraw(uint256 _amount) external onlyOwner whenNotPaused {
        // TODO: Implementation
        require(_amount > 0, "Zero amount");
        if (stablecoin.balanceOf(address(this)) < _amount) revert InsufficientLiquidity();

        investedAmount += _amount;
        stablecoin.safeTransfer(msg.sender, _amount);

        emit Withdrawal(msg.sender, _amount);
    }

    /// @notice Restricted: Transfers stablecoins directly to a user after settlement.
    /// @dev Must be restricted to the authorized VaultShares contract.
    function payoutRedemption(address _to, uint256 _amount) external onlyVaultShares whenNotPaused {
        // TODO: Implementation
        if (stablecoin.balanceOf(address(this)) < _amount) revert InsufficientLiquidity();

        stablecoin.safeTransfer(_to, _amount);

        emit Payout(_to, _amount);
    }

    /// @notice (Admin Only) Pauses all contract interactions.
    function pause() external onlyOwner {
        // TODO: Implementation
        _pause();
    }

    /// @notice (Admin Only) Unpauses the contract.
    function unpause() external onlyOwner {
        // TODO: Implementation
        _unpause();
    }

    /// @notice Returns the total amount of stablecoins held in this contract.
    function balance() external view returns (uint256) {
        // TODO: Implementation
        return stablecoin.balanceOf(address(this));
    }

    /// @notice Returns the Assets Under Management (AUM).
    /// @dev Calculation must account for both actual balance and deployed investments.
    function aum() external view returns (uint256) {
        // TODO: Implementation
        if (vaultShares == address(0)) {
            // รวม balance ที่ยังอยู่ + เงินที่ถอนออกไปลงทุน
            return stablecoin.balanceOf(address(this)) + investedAmount;
        }
        IVaultShares vs = IVaultShares(vaultShares);
        uint256 supply = vs.totalSupply();
        if (supply == 0) {
            return stablecoin.balanceOf(address(this)) + investedAmount;
        }
        return (supply * vs.nav()) / 1e18;
    }
}