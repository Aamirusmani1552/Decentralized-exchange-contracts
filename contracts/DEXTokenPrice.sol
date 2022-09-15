// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error DEXTokenPrice_dataIsInconsistent();

contract DEXTokenPrice is Ownable {
  mapping(address => address) internal s_tokenUsdPricesV3contracts;

  event chainLinkPriceFeedAdded(
    address[] tokenAddresses,
    address[] contractAddresses,
    address owner
  );

  constructor(
    address[] memory validTokenAddr,
    address[] memory chainlinkAggregatorV3Addr
  ) {
    for (uint8 i = 0; i < validTokenAddr.length; i++) {
      s_tokenUsdPricesV3contracts[
        validTokenAddr[i]
      ] = chainlinkAggregatorV3Addr[i];
    }
  }

  function addChainlinkPriceFeeds(
    address[] memory tokenAddresses,
    address[] memory contractAddresses
  ) external onlyOwner {
    if (
      tokenAddresses.length > contractAddresses.length ||
      tokenAddresses.length < contractAddresses.length
    ) {
      revert DEXTokenPrice_dataIsInconsistent();
    }
    for (uint8 i = 0; i < tokenAddresses.length; i++) {
      s_tokenUsdPricesV3contracts[tokenAddresses[i]] = contractAddresses[i];
    }
    emit chainLinkPriceFeedAdded(
      tokenAddresses,
      contractAddresses,
      _msgSender()
    );
  }

  function getPriceFeedContract(address token) public view returns (address) {
    return s_tokenUsdPricesV3contracts[token];
  }

  function _getPrice(AggregatorV3Interface tokenPriceFeed)
    internal
    view
    returns (int256)
  {
    int256 price = _getLatestPrice(tokenPriceFeed);
    return price;
  }

  function _getLatestPrice(AggregatorV3Interface tokenPriceFeed)
    internal
    view
    returns (int256)
  {
    (
      ,
      /*uint80 roundID*/
      int256 price, /*uint startedAt*/ /*uint timeStamp*/ /*uint80 answeredInRound*/
      ,
      ,

    ) = tokenPriceFeed.latestRoundData();
    return price;
  }
}
