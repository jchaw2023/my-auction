module.exports = async ({ getNamedAccounts, deployments , ethers, upgrades, network }) => {
    const { log, save } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    log("----------------------------------------------------");
    log("Deploying MyXAuction contract (Upgradeable)...");

    // 获取签名者对象（getContractFactory 需要签名者，不是地址字符串）
    const signer = await ethers.getSigner(deployer);
    const MyXAuction = await ethers.getContractFactory("MyXAuction", signer);

    // 使用透明代理模式部署可升级合约
    const myXAuctionProxy = await upgrades.deployProxy(MyXAuction, [], {
        initializer: "initialize",
        kind: "transparent",
    });

    await myXAuctionProxy.waitForDeployment();
    const proxyAddress = await myXAuctionProxy.getAddress();

    log(`MyXAuction proxy deployed at: ${proxyAddress}`);

    // 获取实现合约地址
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    log(`MyXAuction implementation deployed at: ${implementationAddress}`);

    // 获取 ProxyAdmin 地址（透明代理模式）
    const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    log(`ProxyAdmin deployed at: ${proxyAdminAddress}`);

    // 保存部署信息到 hardhat-deploy
    const artifact = await deployments.getExtendedArtifact("MyXAuction");
    await save("MyXAuction", {
        address: proxyAddress,
        ...artifact,
    });

    log("Contract is upgradeable using Transparent Proxy pattern");
    log("----------------------------------------------------");
    log("Deployment Summary:");
    log(`  MyXAuction Proxy: ${proxyAddress}`);
    log(`  MyXAuction Implementation: ${implementationAddress}`);
    log(`  ProxyAdmin: ${proxyAdminAddress}`);
    log("----------------------------------------------------");

    // 如果是 Sepolia 测试网，设置 Chainlink 价格预言机
    if (network.name === "sepolia") {
        log("Setting up Chainlink price feeds for Sepolia testnet...");
        const myXAuctionContract = await ethers.getContractAt("MyXAuction", proxyAddress);
        
        // Sepolia 测试网 Chainlink 价格源地址
        const ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; // ETH/USD
        const USDC_USD_FEED = "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E"; // USDC/USD (Sepolia)
        
        // 设置 ETH/USD 价格源
        log("Setting ETH/USD price feed...");
        const setETHFeedTx = await myXAuctionContract.setPriceFeed(ethers.ZeroAddress, ETH_USD_FEED);
        await setETHFeedTx.wait();
        log(`  ETH/USD Feed: ${ETH_USD_FEED}`);
        
        // 设置 USDC/USD 价格源
        // Sepolia 测试网 USDC 地址：0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
        const USDC_TOKEN_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
        log("Setting USDC/USD price feed...");
        const setUSDCFeedTx = await myXAuctionContract.setPriceFeed(USDC_TOKEN_ADDRESS, USDC_USD_FEED);
        await setUSDCFeedTx.wait();
        log(`  USDC Token: ${USDC_TOKEN_ADDRESS}`);
        log(`  USDC/USD Feed: ${USDC_USD_FEED}`);
        
        log("Price feeds configured successfully");
        log("----------------------------------------------------");
    }
};

module.exports.tags = ["myxaction"];
