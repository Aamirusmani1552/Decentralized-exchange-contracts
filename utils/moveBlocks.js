const { network } = require("hardhat");

async function moveBlocks(delay) {
  console.log("moving blocks...");
  for (i = 0; i < delay; i++) {
    await network.provider.request({ method: "evm_mine", params: [] });
  }
}

module.exports = moveBlocks;
