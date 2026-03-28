// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

contract VaultShares is ERC20, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidNAV();
    error InsufficientShares();
    error NotReady();
    error AlreadySettled();

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

    enum Status { Pending, Ready, Fulfilled }

    struct RedemptionRequest {
        uint256 id;
        address wallet;
        uint256 shares;
        uint256 nav;
        uint256 amount;
        uint256 unlockDate;
        Status status;
    }

    // TODO: Define state variables
    // REQUIRED: nav, fundVault, stablecoin, nextRequestId, redemptions mapping
    uint256 private _nav;
    IFundVault public fundVault;
    IERC20 public stablecoin;
    uint256 public nextRequestId;
    bool private _fundVaultSet;
    mapping(uint256 => RedemptionRequest) public redemptions;

    uint256 private constant SETTLEMENT_DELAY = 24 hours;

    constructor(address _stablecoin) ERC20("Vault Shares", "vTHB") Ownable(msg.sender) {
        // TODO: Initialize contract state
        stablecoin = IERC20(_stablecoin);
        _nav = 1e18;
        nextRequestId = 1;
    }

    /// @notice Sets the authorized FundVault address.
    /// @dev Only callable by Admin.
    function setFundVault(address _fundVault) external onlyOwner {
        // TODO: Implementation
        require(_fundVault != address(0), "Invalid address");
        require(!_fundVaultSet, "Already set");
        _fundVaultSet = true;
        fundVault = IFundVault(_fundVault);
    }

    /// @notice Returns the current nav price (18 decimals).
    function nav() external view returns (uint256) {
        // TODO: Implementation
        return _nav;
    }

    /// @notice Updates the current nav price.
    /// @dev Only callable by Admin. NAV must be > 0.
    function setNav(uint256 _newNAV) external onlyOwner whenNotPaused {
        // TODO: Implementation
        if (_newNAV == 0) revert InvalidNAV();

        uint256 oldNav = _nav;
        _nav = _newNAV;

        emit NavUpdated(oldNav, _newNAV);
    }

    /// @notice (Admin Only) Settles a pending redemption request and triggers payout.
    /// @dev Must validate request existence, state, and 24h lock.
    function settleRedemption(uint256 _requestId) external onlyOwner whenNotPaused nonReentrant {
        // TODO: Implementation
        RedemptionRequest storage request = redemptions[_requestId];

        if (request.wallet == address(0)) revert NotReady();
        if (request.status == Status.Fulfilled) revert AlreadySettled();
        if (block.timestamp < request.unlockDate) revert NotReady();

        request.status = Status.Fulfilled;

        fundVault.payoutRedemption(request.wallet, request.amount);

        emit RedemptionSettled(_requestId, request.wallet, request.amount);
    }

    /// @notice Deposits stablecoins and mints vault tokens based on nav price.
    /// @dev User must approve this contract to spend stablecoins first.
    function deposit(uint256 _amount) external nonReentrant whenNotPaused {
        // TODO: Implementation
        require(_amount > 0, "Zero amount");

        uint256 shares = (_amount * 1e18) / _nav;

        stablecoin.safeTransferFrom(msg.sender, address(fundVault), _amount);
        _mint(msg.sender, shares);
    }

    /// @notice Initiates a redemption request.
    /// @dev Burns shares immediately and snapshots payout value.
    function requestRedeem(uint256 _shareAmount) external nonReentrant whenNotPaused {
        // TODO: Implementation
        require(_shareAmount > 0, "Zero amount");
        if (balanceOf(msg.sender) < _shareAmount) revert InsufficientShares();

        uint256 amount = (_shareAmount * _nav) / 1e18;

        _burn(msg.sender, _shareAmount);

        uint256 requestId = nextRequestId++;
        uint256 unlockDate = block.timestamp + SETTLEMENT_DELAY;

        redemptions[requestId] = RedemptionRequest({
            id:         requestId,
            wallet:     msg.sender,
            shares:     _shareAmount,
            nav:        _nav,
            amount:     amount,
            unlockDate: unlockDate,
            status:     Status.Pending
        });

        emit RedemptionRequested(requestId, msg.sender, _shareAmount, _nav, amount);
    }

    /// @notice Returns the total amount of vault shares in existence.
    function totalSupply() public view override returns (uint256) {
        // TODO: Implementation
        return super.totalSupply();
    }

    /// @notice Returns the amount of vault shares owned by `account`.
    function balanceOf(address account) public view override returns (uint256) {
        // TODO: Implementation
        return super.balanceOf(account);
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

    /// @notice Prevents ownership renouncement for security.
    function renounceOwnership() public override onlyOwner {
        revert("Renouncing is disabled");
    }
}