// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title THBMock
 * @notice A standard ERC20 implementation for testing.
 * @dev Provided as a helper contract for the FundVault challenge.
 */
contract THBMock is ERC20 {
    constructor() ERC20("Thai Baht Stablecoin Mock", "THB_MOCK") {}

    /// @notice Allows anyone to mint tokens for testing purposes.
    /// @param to The address to receive the minted tokens.
    /// @param amount The amount of tokens to mint.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
