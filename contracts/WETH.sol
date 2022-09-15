//SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error WETH_AnErrorOccured();

contract WETH is ERC20, ReentrancyGuard {
  event Deposit(address, uint256);
  event Withdraw(address, uint256);

  constructor(uint256 initialSupply) ERC20("Wrapped Ether", "WETH") {}

  function deposit() public payable {
    _mint(msg.sender, msg.value);
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint256 amount) external nonReentrant {
    _burn(msg.sender, amount);
    (bool success, ) = payable(msg.sender).call{ value: amount }("");

    if (!success) {
      revert WETH_AnErrorOccured();
    }
    emit Withdraw(msg.sender, amount);
  }

  function ethBalance() public view returns (uint256) {
    return address(this).balance;
  }

  fallback() external payable {
    revert();
  }

  receive() external payable {
    revert();
  }
}
