//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DEXValidTokens is Ownable {
  address[] public s_validTokenAddresses;
  address internal immutable i_wethContractAddress;

  event TokenAddressesSet(address[], address);
  event TokensAdded(address[], address);
  event TokensRemvod(address[], address);

  constructor(address[] memory tokenAddresses, address wethContract) {
    for (uint8 i = 0; i < tokenAddresses.length; i++) {
      s_validTokenAddresses.push(tokenAddresses[i]);
    }
    i_wethContractAddress = wethContract;
    emit TokenAddressesSet(tokenAddresses, _msgSender());
  }

  function addTokens(address[] memory tokenAddresses) external onlyOwner {
    for (uint8 i = 0; i < tokenAddresses.length; i++) {
      s_validTokenAddresses.push(tokenAddresses[i]);
    }
    emit TokensAdded(tokenAddresses, _msgSender());
  }

  function renewAddresses(address[] memory tokenAddresses) external onlyOwner {
    for (uint8 i = 0; i < tokenAddresses.length; i++) {
      s_validTokenAddresses.push(tokenAddresses[i]);
    }
    emit TokenAddressesSet(tokenAddresses, _msgSender());
  }
}
