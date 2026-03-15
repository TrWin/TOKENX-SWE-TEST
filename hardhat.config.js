require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  paths: {
    sources: "./smart-contracts",
    tests: "./tests",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
