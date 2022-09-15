const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config.js");

module.exports = async ({ getNamedAccounts, deployments }) => {
  if (network.config.chainId === 31337) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    let tokens;

    log("----------------------------------------------------");
    const args = [8, 716878975];
    const mockV3Aggregator = await deploy("MockV3Aggregator", {
      from: deployer,
      args: args,
      log: true,
      waitConfirmations: 1,
    });

    log("----------------------------------------------------");
    const args2 = [8, 163262812740];
    const mockV3Aggregator2 = await deploy("MockV3Aggregator2", {
      from: deployer,
      args: args2,
      log: true,
      waitConfirmations: 1,
    });

    log("----------------------------------------------------");
    const args3 = [8, 495000000];
    const mockV3Aggregator3 = await deploy("MockV3Aggregator3", {
      from: deployer,
      args: args3,
      log: true,
      waitConfirmations: 1,
    });
  }
};

module.exports.tags = ["all", "v3Aggregator"];
