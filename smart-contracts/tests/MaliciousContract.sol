// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../THBMock.sol";

interface IVaultShares {
    function deposit(uint256 amount) external;
    function requestRedeem(uint256 shareAmount) external;
    function settleRedemption(uint256 requestId) external;
}

contract MaliciousContract {
    THBMock public stablecoin;
    IVaultShares public vaultShares;
    bool public attackOn;

    constructor(address _stablecoin, address _vaultShares) {
        stablecoin = THBMock(_stablecoin);
        vaultShares = IVaultShares(_vaultShares);
    }

    // Set allowance for vaultShares
    function setup() external {
        stablecoin.approve(address(vaultShares), type(uint256).max);
    }

    function startAttack() external {
        attackOn = true;
        vaultShares.deposit(1e18);
    }

    // Attempt re-entrancy during token transfer (if not guarded)
    fallback() external payable {
        if (attackOn) {
            attackOn = false;
            vaultShares.deposit(1e18);
        }
    }

    receive() external payable {}
}
