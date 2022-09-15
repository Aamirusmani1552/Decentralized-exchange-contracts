const networkConfig = {
  5: {
    tokens: [
      "0x4450c8e799D036DE36e9eC096C2D14A33Abc96F7",
      "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
    ],
    chainLinkContracts: [
      "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e",
      "0x48731cF7e84dc94C5f84577882c14Be11a5B7456",
    ],
    wethToken: "0x4450c8e799D036DE36e9eC096C2D14A33Abc96F7",
  },
  80001: {
    token: [
      "0xBeB7D8b083D6A915fa80Ac5Da34E8D2222Fe6b07",
      "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
    ],
    chainLinkContracts: [
      "0x0715A7794a1dc8e42615F059dD6e406A6594651A",
      //don't deploy to polygon mumbai yet
    ],
    wethToken: "0xBeB7D8b083D6A915fa80Ac5Da34E8D2222Fe6b07",
  },
  31337: {},
};

const developmentChains = ["localhost", "hardhat"];

module.exports = {
  networkConfig,
  developmentChains,
};
