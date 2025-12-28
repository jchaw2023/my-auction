require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // 较低的 runs 值可以减小合约大小，但会增加 gas 消耗
      },
      viaIR: true, // 启用 IR 编译以解决 "Stack too deep" 错误
    },
  },
  namedAccounts: {
    deployer: {
      default: 0, // 默认使用第一个账户作为部署账户
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      chainId: 31337,
    },
    sepolia: {
      chainId: process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID, 10) : 11155111,
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
