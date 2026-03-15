// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VaultShares
 * @notice Primary entry point for user interactions and share management.
 * @dev THE CORE TASK:
 * 1. Implement as an ERC-20 token representing vault shares.
 * 2. Implement deposit: minting shares based on NAV and transferring stablecoins.
 * 3. Implement requestRedeem: burning shares and queuing redemption requests.
 * 4. Implement settleRedemption: T+1 settlement execution (24h lock).
 *
 * 💡 ARCHITECTURAL NOTE:
 * Rely on Event Indexing (RedemptionRequested/RedemptionSettled) for data retrieval.
 *
 * 💡 REQUIREMENT NOTE:
 * You are allowed and encouraged to use standard OpenZeppelin contracts.
 */

interface IFundVault {
    function payoutRedemption(address _to, uint256 _amount) external;
}

contract VaultShares {
    error Unauthorized();
    error InvalidNAV();
    error InsufficientShares();
    error NotReady();
    error AlreadySettled();
    error Paused();

    event NavUpdated(uint256 oldNav, uint256 newNav);
    event RedemptionRequested(uint256 indexed requestId, address indexed wallet, uint256 shares, uint256 nav, uint256 amount);
    event RedemptionSettled(uint256 indexed requestId, address indexed wallet, uint256 amount);

    /**
     * 📋 DATA STRUCTURES
     * The following structure is recommended for test compatibility:
     * 
     * struct RedemptionRequest {
     *     uint256 id;
     *     address wallet;
     *     uint256 shares;
     *     uint256 nav;           // Snapshot at request time
     *     uint256 amount;        // Fixed payout amount
     *     uint256 unlockDate;
     *     Status status;
     * }
     */

    // TODO: Define state variables
    // REQUIRED: nav, fundVault, stablecoin, nextRequestId, redemptions mapping

    constructor(address _stablecoin) {
        // TODO: Initialize contract state
    }

    /// @notice Sets the authorized FundVault address.
    /// @dev Only callable by Admin.
    function setFundVault(address _fundVault) external {
        // TODO: Implementation
    }

    /// @notice Returns the current nav price (18 decimals).
    function nav() external view returns (uint256) {
        // TODO: Implementation
    }

    /// @notice Updates the current nav price.
    /// @dev Only callable by Admin. NAV must be > 0.
    function setNav(uint256 _newNAV) external {
        // TODO: Implementation
    }

    /// @notice (Admin Only) Settles a pending redemption request and triggers payout.
    /// @dev Must validate request existence, state, and 24h lock.
    function settleRedemption(uint256 _requestId) external {
        // TODO: Implementation
    }

    /// @notice Deposits stablecoins and mints vault tokens based on nav price.
    /// @dev User must approve this contract to spend stablecoins first.
    function deposit(uint256 _amount) external {
        // TODO: Implementation
    }

    /// @notice Initiates a redemption request.
    /// @dev Burns shares immediately and snapshots payout value.
    function requestRedeem(uint256 _shareAmount) external {
        // TODO: Implementation
    }

    /// @notice Returns the total amount of vault shares in existence.
    function totalSupply() external view returns (uint256) {
        // TODO: Implementation
    }

    /// @notice Returns the amount of vault shares owned by `account`.
    function balanceOf(address account) external view returns (uint256) {
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
}
