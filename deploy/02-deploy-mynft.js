const { network } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;


  log("----------------------------------------------------");
  log("Deploying MyNFT contract...");
  log(`Deployer: ${deployer}`);
  log(`Chain ID: ${chainId}`);

  const nftName = "Neon Ghost Protocol";
  const nftSymbol = "NGP";
  const maxSupply = 10000; // 最大供应量

  const myNFT = await deploy("MyNFT", {
    from: deployer,
    args: [nftName, nftSymbol, maxSupply, deployer],
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });
  
  log(`MyNFT contract deployed at: ${myNFT.address}`);
  log(`NFT Name: ${nftName}`);
  log(`NFT Symbol: ${nftSymbol}`);
  log(`Max Supply: ${maxSupply}`);
  log("----------------------------------------------------");
};

module.exports.tags = ["mynft"];
