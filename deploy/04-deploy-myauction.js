module.exports = async ({ getNamedAccounts, deployments , ethers, upgrades, network }) => {
    const { log, save } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    log("----------------------------------------------------");
    log("Deploying MyAuction contract (Upgradeable)...");

    // 获取签名者对象（getContractFactory 需要签名者，不是地址字符串）
    const signer = await ethers.getSigner(deployer);
    const MyAuction = await ethers.getContractFactory("MyAuction", signer);

    // 使用透明代理模式部署可升级合约
    const myAuctionProxy = await upgrades.deployProxy(MyAuction, [], {
        initializer: "initialize",
        kind: "transparent",
    });

    await myAuctionProxy.waitForDeployment();
    const proxyAddress = await myAuctionProxy.getAddress();

    log(`MyAuction proxy deployed at: ${proxyAddress}`);

    // 获取实现合约地址
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    log(`MyAuction implementation deployed at: ${implementationAddress}`);

    // 获取 ProxyAdmin 地址（透明代理模式）
    const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    log(`ProxyAdmin deployed at: ${proxyAdminAddress}`);

    // 保存部署信息到 hardhat-deploy
    const artifact = await deployments.getExtendedArtifact("MyAuction");
    await save("MyAuction", {
        address: proxyAddress,
        ...artifact,
    });

    log("Contract is upgradeable using Transparent Proxy pattern");
    log("----------------------------------------------------");
    log("Deployment Summary:");
    log(`  MyAuction Proxy: ${proxyAddress}`);
    log(`  MyAuction Implementation: ${implementationAddress}`);
    log(`  ProxyAdmin: ${proxyAdminAddress}`);
    log("----------------------------------------------------");

    // 如果是 Sepolia 测试网，设置 Chainlink 价格预言机
    if (network.name === "sepolia") {
        log("Setting up Chainlink price feeds for Sepolia testnet...");
        const myAuctionContract = await ethers.getContractAt("MyAuction", proxyAddress);
        
        // Sepolia 测试网 Chainlink 价格源地址
        const ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; // ETH/USD
        const USDC_USD_FEED = "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E"; // USDC/USD (Sepolia)
        
        // 设置 ETH/USD 价格源
        log("Setting ETH/USD price feed...");
        const setETHFeedTx = await myAuctionContract.setPriceFeed(ethers.ZeroAddress, ETH_USD_FEED);
        await setETHFeedTx.wait();
        log(`  ETH/USD Feed: ${ETH_USD_FEED}`);
        
        // 设置 USDC/USD 价格源
        // Sepolia 测试网 USDC 地址：0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
        const USDC_TOKEN_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
        log("Setting USDC/USD price feed...");
        const setUSDCFeedTx = await myAuctionContract.setPriceFeed(USDC_TOKEN_ADDRESS, USDC_USD_FEED);
        await setUSDCFeedTx.wait();
        log(`  USDC Token: ${USDC_TOKEN_ADDRESS}`);
        log(`  USDC/USD Feed: ${USDC_USD_FEED}`);
        
        log("Price feeds configured successfully");
        log("----------------------------------------------------");
    }


    // 获取 MyNFT 合约
    const myNFT = await deployments.get("MyNFT");
    const myNFTContract = await ethers.getContractAt("MyNFT", myNFT.address);
    const balance = await myNFTContract.balanceOf(deployer);
    
    if (balance.toString() === "0") {
        log("⚠️  No NFT found for deployer, skipping auction creation");
        return;
    }
    
    log(`NFT Balance: ${balance.toString()}`);
    log("----------------------------------------------------");
    
    // 支持通过 npm 参数或环境变量指定 tokenId
    // npm 参数格式：npm run deploy:myauction:sepolia --token-id=1
    // 环境变量格式：TOKEN_ID=1 npm run deploy:myauction:sepolia
    let tokenId;
    const specifiedTokenId = process.env.npm_config_token_id || process.env.TOKEN_ID;
    
    if (specifiedTokenId) {
        // 使用指定的 tokenId
        tokenId = BigInt(specifiedTokenId);
        log(`Using specified Token ID: ${specifiedTokenId}`);
        
        // 验证 tokenId 是否存在且属于 deployer
        try {
            const owner = await myNFTContract.ownerOf(tokenId);
            if (owner.toLowerCase() !== deployer.toLowerCase()) {
                throw new Error(`Token ID ${specifiedTokenId} does not belong to deployer`);
            }
            log(`Token ID ${specifiedTokenId} verified: owned by ${deployer}`);
        } catch (e) {
            log(`Error: Token ID ${specifiedTokenId} is invalid or not owned by deployer`);
            throw e;
        }
    } else {
        // 自动查找属于 deployer 的 tokenId
        log("No TOKEN_ID specified, searching for deployer's NFT...");
    const totalSupply = await myNFTContract.totalSupply();
    
    if (Number(totalSupply) === 0) {
        log("⚠️  No NFT minted yet, skipping auction creation");
            log("Hint: Use --token-id=1 parameter or TOKEN_ID=1 environment variable");
        return;
    }
    
        // 从 1 开始查找属于 deployer 的 tokenId
    let foundTokenId = null;
    for (let i = 1; i <= Number(totalSupply); i++) {
        try {
            const owner = await myNFTContract.ownerOf(i);
            if (owner.toLowerCase() === deployer.toLowerCase()) {
                foundTokenId = i;
                break;
            }
        } catch (e) {
            // tokenId 不存在，继续查找
            continue;
        }
    }
    
    if (!foundTokenId) {
        log("No NFT found for deployer, skipping auction creation");
            log("Hint: Use --token-id=1 parameter or TOKEN_ID=1 environment variable");
        return;
        }
        
        tokenId = BigInt(foundTokenId);
        log(`Found Token ID: ${foundTokenId}`);
    }
    
    const tokenIdNumber = Number(tokenId);
    log(`Token ID to auction: ${tokenIdNumber}`);
    
    // 授权 NFT 给代理合约地址（重要：必须授权给代理地址，不是实现地址）
    log("Approving NFT to proxy contract...");
    log(`  NFT Contract: ${myNFT.address}`);
    log(`  Proxy Address: ${proxyAddress}`);
    log(`  Token ID: ${tokenIdNumber}`);
    
    const approveTx = await myNFTContract.approve(proxyAddress, tokenId);
    await approveTx.wait();
    log(`NFT approved to proxy: ${proxyAddress}`);
    
    // 验证授权
    const approvedAddress = await myNFTContract.getApproved(tokenId);
    if (approvedAddress.toLowerCase() === proxyAddress.toLowerCase()) {
        log("Authorization verified");
    } else {
        log(`Authorization mismatch. Expected: ${proxyAddress}, Got: ${approvedAddress}`);
        throw new Error("NFT authorization failed");
    }
    log("----------------------------------------------------");
    
    // 创建拍卖 通过代理拍卖
    const myAuctionContract = await ethers.getContractAt("MyAuction", proxyAddress);
    log("Creating auction...");
    
    // 起始价格：$100（美元价值，8位小数：100 * 1e8 = 10000000000）
    const startPrice = 10000000000; // $100 in 8 decimals
    const startTime = Math.floor(Date.now() / 1000); // 当前时间转换成秒
    const endTime = startTime + 7 * 24 * 60 * 60; // 7天后转换成秒
    
    const createAuctionTx = await myAuctionContract.createAuction(
        myNFT.address,
        tokenIdNumber,
        startPrice,
        startTime,
        endTime
    );
    await createAuctionTx.wait();
    
    log("✅ Auction created successfully");
    log(`  NFT Address: ${myNFT.address}`);
    log(`  Token ID: ${tokenId.toString()}`);
    log(`  Start Price: $${startPrice / 1e8} USD`);
    log(`  Start Time: ${new Date(startTime * 1000).toLocaleString()}`);
    log(`  End Time: ${new Date(endTime * 1000).toLocaleString()}`);
    log("----------------------------------------------------");
};

module.exports.tags = ["myauction"];
