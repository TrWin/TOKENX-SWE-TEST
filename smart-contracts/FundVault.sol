// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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

contract FundVault {
    error Unauthorized();
    error InsufficientLiquidity();
    error Paused();

    event Withdrawal(address indexed to, uint256 amount);
    event Payout(address indexed to, uint256 amount);

    // TODO: Define state variables
    // REQUIRED: stablecoin, vaultShares, investedAmount

    constructor(address _stablecoin) {
        // TODO: Initialize contract state
    }

    /// @notice Sets the authorized VaultShares address.
    /// @dev Only callable by Admin.
    function setVaultShares(address _vaultShares) external {
        // TODO: Implementation
    }

    /// @notice Withdraws stablecoins from the vault for fund deployment.
    /// @dev Access control and pause-state validation required.
    function withdraw(uint256 _amount) external {
        // TODO: Implementation
    }

    /// @notice Restricted: Transfers stablecoins directly to a user after settlement.
    /// @dev Must be restricted to the authorized VaultShares contract.
    function payoutRedemption(address _to, uint256 _amount) external {
        // TODO: Implementation
    }

    /// @notice (Admin Only) Pauses all contract interactions.
    function pause() external {
        // TODO: Implementation
    }

    /// @notice (Admin Only) Unpauses the contract.
    function unpause() external {
        // TODO: Implementation
    }
    
    /// @notice Returns the total amount of stablecoins held in this contract.
    function balance() external view returns (uint256) {
        // TODO: Implementation
    }

    /// @notice Returns the Assets Under Management (AUM).
    /// @dev Calculation must account for both actual balance and deployed investments.
    function aum() external view returns (uint256) {
        // TODO: Implementation
    }
}
