const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config.js");
const { verify } = require("../utils/verify.js");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deployer } = await getNamedAccounts();
  const { log, deploy } = deployments;
  const supply = "1000000000000000000000000";

  if (developmentChains.includes(network.name)) {
    log("___________________________________________");
    const args = [supply];
    const myToken = await deploy("AKTestToken", {
      from: deployer,
      args: args,
      log: true,
      waitConfirmations: 1,
    });

    if (
      !developmentChains.includes(network.name) &&
      process.env.ETHERSCAN_API_KEY
    ) {
      log("Verifying...");
      await verify(myToken.address, args);
    }

    log("___________________________________________");
    const myToken2 = await deploy("AKTestToken2", {
      from: deployer,
      args: args,
      log: true,
      waitConfirmations: 1,
    });

    if (
      !developmentChains.includes(network.name) &&
      process.env.ETHERSCAN_API_KEY
    ) {
      log("Verifying...");
      await verify(myToken2.address, args);
    }
  }

  log("___________________________________________");
  const args2 = ["0"];
  const wethToken = await deploy("WETH", {
    from: deployer,
    args: args2,
    log: true,
    waitConfirmations: developmentChains.includes(network.name) ? 1 : 6,
  });

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifying...");
    await verify(wethToken.address, args2);
  }
};

module.exports.tags = ["all", "wethToken"];
