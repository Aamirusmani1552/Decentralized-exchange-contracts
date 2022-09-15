const { network, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config.js");

const { verify } = require("../utils/verify.js");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  let myToken, myToken2, mockV3Aggregator, mockV3Aggregator2, mockV3Aggregator3;
  if (developmentChains.includes(network.name)) {
    myToken = await ethers.getContract("AKTestToken");
    myToken2 = await ethers.getContract("AKTestToken2");
    mockV3Aggregator = await ethers.getContract("MockV3Aggregator");
    mockV3Aggregator2 = await ethers.getContract("MockV3Aggregator2");
    mockV3Aggregator3 = await ethers.getContract("MockV3Aggregator3");
  }
  let tokens;
  let chainlinkContracts;
  let wethToken;

  if (developmentChains.includes(network.name)) {
    chainlinkContracts = [
      mockV3Aggregator.address,
      mockV3Aggregator2.address,
      mockV3Aggregator3.address,
    ];
    let wethTokenCont = await ethers.getContract("WETH");
    wethToken = wethTokenCont.address;
    tokens = [myToken.address, wethToken, myToken2.address];
  } else {
    chainlinkContracts =
      networkConfig[network.config.chainId].chainLinkContracts;
    tokens = networkConfig[network.config.chainId].tokens;
    wethToken = networkConfig[network.config.chainId].wethToken;
  }

  log("----------------------------------------------------");
  const args = [tokens, chainlinkContracts, wethToken];
  const DEX = await deploy("DEX", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: developmentChains.includes(network.name) ? 1 : 6,
  });

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifying...");
    await verify(DEX.address, args);
  }
  log("----------------------------------------------------");
};

module.exports.tags = ["all", "DEX"];

// DEX: 0xBcc4d22F8D73698A238Bf9fb5c1Cc049132Aba6D

// tokens:
// link: 0x326C977E6efc84E512bB9C30f76E30c160eD06FB
