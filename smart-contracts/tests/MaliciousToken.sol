// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// A token that calls back to the sender after receiving a transfer
// Used to test re-entrancy guards in VaultShares
contract MaliciousToken is ERC20 {
    bool public shouldAttack;
    address public target;

    constructor() ERC20("Malicious", "MAL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setAttack(address _target, bool _should) external {
        target = _target;
        shouldAttack = _should;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        bool success = super.transferFrom(from, to, amount);
        if (shouldAttack && msg.sender == target) {
            // Mint enough tokens back to 'from' so the secondary deposit 
            // has plenty of funds/allowance to actually run. 
            // This ensures if it fails, it's ONLY because of the ReentrancyGuard.
            _mint(from, amount * 2);
            
            // Attempt re-entrancy
            (bool ok, ) = target.call(abi.encodeWithSignature("deposit(uint256)", amount));
            require(!ok, "Re-entrancy succeeded!");
        }
        return success;
    }
}
