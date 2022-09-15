// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@chainlink/contracts/src/v0.6/tests/MockV3Aggregator.sol";

contract MockV3Aggregator2 is MockV3Aggregator {
  constructor(uint8 _decimals, int256 _initialAnswer)
    public
    MockV3Aggregator(_decimals, _initialAnswer)
  {}
}
