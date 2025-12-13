const { network, ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    log("----------------------------------------------------");
    log("Minting NFT...");
    log(`Deployer: ${deployer}`);
    log(`Chain ID: ${chainId}`);

    // 获取已部署的 MyNFT 合约
    const myNFT = await deployments.get("MyNFT");
    const myNFTContract = await ethers.getContractAt("MyNFT", myNFT.address);

    // 检查当前余额
    const balanceBefore = await myNFTContract.balanceOf(deployer);
    log(`Balance before minting: ${balanceBefore.toString()}`);

    // Mint NFT
    const tokenURI = "https://ipfs.io/ipfs/bafybeibni3xe5ipdu2dlbwlymbzg7kbppkdtbs3vv4cef2gwzgv3tksmd4/e2.json";
    log(`Minting NFT with URI: ${tokenURI}`);
    
    const mintTx = await myNFTContract.mint(deployer, tokenURI);
    await mintTx.wait();

    // 检查余额变化
    const balanceAfter = await myNFTContract.balanceOf(deployer);
    log(`Balance after minting: ${balanceAfter.toString()}`);

    // 获取新 mint 的 tokenId
    const totalSupply = await myNFTContract.totalSupply();
    log(`Total Supply: ${totalSupply.toString()}`);

    log("✅ NFT minted successfully");
    log("----------------------------------------------------");
};

module.exports.tags = ["mint"];

