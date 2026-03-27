require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  paths: {
    sources: "./smart-contracts",
    tests: "./tests",
    cache: "./cache",
    artifacts: "./artifacts"
  },

  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};
