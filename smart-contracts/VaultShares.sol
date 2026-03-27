// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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

contract VaultShares is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

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

    enum Status { Pending, Ready, Fulfilled }

    struct RedemptionRequest {
        uint256 id;
        address wallet;
        uint256 shares;
        uint256 nav;           // Snapshot at request time
        uint256 amount;        // Fixed payout amount
        uint256 unlockDate;
        Status status;
    }

    // TODO: Define state variables
    // REQUIRED: nav, fundVault, stablecoin, nextRequestId, redemptions mapping
    uint256 private _nav;
    IFundVault public fundVault;
    IERC20 public stablecoin;
    uint256 public nextRequestId;
    mapping(uint256 => RedemptionRequest) public redemptions;

    address private _admin;
    bool private _paused;

    uint256 private constant SETTLEMENT_DELAY = 24 hours;

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        if (msg.sender != _admin) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (_paused) revert Paused();
        _;
    }

    constructor(address _stablecoin) ERC20("Vault Shares", "vTHB") {
        // TODO: Initialize contract state
        stablecoin = IERC20(_stablecoin);
        _admin = msg.sender;
        _nav = 1e18;       // เริ่มต้น NAV = 1.0 (18 decimals)
        nextRequestId = 1; // เริ่ม id จาก 1 ให้ 0 เป็น invalid sentinel
        _paused = false;
    }

    /// @notice Sets the authorized FundVault address.
    /// @dev Only callable by Admin.
    function setFundVault(address _fundVault) external onlyAdmin {
        // TODO: Implementation
        fundVault = IFundVault(_fundVault);
    }

    /// @notice Returns the current nav price (18 decimals).
    function nav() external view returns (uint256) {
        // TODO: Implementation
        return _nav;
    }

    /// @notice Updates the current nav price.
    /// @dev Only callable by Admin. NAV must be > 0.
    function setNav(uint256 _newNAV) external onlyAdmin {
        // TODO: Implementation
        if (_newNAV == 0) revert InvalidNAV();

        uint256 oldNav = _nav;
        _nav = _newNAV;

        emit NavUpdated(oldNav, _newNAV);
    }

    /// @notice (Admin Only) Settles a pending redemption request and triggers payout.
    /// @dev Must validate request existence, state, and 24h lock.
    function settleRedemption(uint256 _requestId) external onlyAdmin nonReentrant {
        // TODO: Implementation
        RedemptionRequest storage request = redemptions[_requestId];

        // ตรวจสอบว่า request มีอยู่จริง
        if (request.wallet == address(0)) revert NotReady();

        // ตรวจสอบว่ายังไม่ได้ settle
        if (request.status == Status.Fulfilled) revert AlreadySettled();

        // ตรวจสอบว่าผ่าน 24h แล้ว
        if (block.timestamp < request.unlockDate) revert NotReady();

        request.status = Status.Fulfilled;

        // สั่ง FundVault โอน stablecoin ตรงไปให้ user
        fundVault.payoutRedemption(request.wallet, request.amount);

        emit RedemptionSettled(_requestId, request.wallet, request.amount);
    }

    /// @notice Deposits stablecoins and mints vault tokens based on nav price.
    /// @dev User must approve this contract to spend stablecoins first.
    function deposit(uint256 _amount) external nonReentrant whenNotPaused {
        // TODO: Implementation

        // คำนวณ shares ที่จะ mint = amount / NAV
        // ใช้ 1e18 เพื่อรักษา precision (ทั้ง amount และ nav เป็น 18 decimals)
        uint256 shares = (_amount * 1e18) / _nav;

        // ดึง stablecoin จาก user ไปเก็บไว้ที่ FundVault โดยตรง
        stablecoin.safeTransferFrom(msg.sender, address(fundVault), _amount);

        // mint shares ให้ user
        _mint(msg.sender, shares);
    }

    /// @notice Initiates a redemption request.
    /// @dev Burns shares immediately and snapshots payout value.
    function requestRedeem(uint256 _shareAmount) external nonReentrant whenNotPaused {
        // TODO: Implementation
        if (balanceOf(msg.sender) < _shareAmount) revert InsufficientShares();

        // คำนวณ payout = shares × NAV snapshot ณ เวลานี้
        uint256 amount = (_shareAmount * _nav) / 1e18;

        // burn shares ทันที — user จะไม่ได้คืนถ้า cancel (ไม่มี cancel ใน spec)
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
    function pause() external onlyAdmin {
        // TODO: Implementation
        _paused = true;
    }

    /// @notice (Admin Only) Unpauses the contract.
    function unpause() external onlyAdmin {
        // TODO: Implementation
        _paused = false;
    }
}