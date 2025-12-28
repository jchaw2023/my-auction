/**
 * 升级 MyAuction 合约到 V2 版本
 * 
 * 使用方法：
 * npx hardhat run deploy/05-upgrade-myauction-v2.js --network sepolia
 */
module.exports = async ({ getNamedAccounts, deployments , ethers, upgrades, network }) => {
    const { log, save } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    log("----------------------------------------------------");
    log("Upgrading MyAuction contract to V2...");
    log(`Deployer: ${deployer}`);
    log(`Chain ID: ${chainId}`);
    log(`Network: ${network.name}`);
    log("----------------------------------------------------");

    // 获取已部署的代理合约地址
    let proxyAddress;
    try {
        const myXAuctionDeployment = await deployments.get("MyXAuction");
        proxyAddress = myXAuctionDeployment.address;
        log(`Found MyXAuction proxy at: ${proxyAddress}`);
    } catch (error) {
        log("❌ 无法找到已部署的 MyXAuction 合约");
        log("请先部署 MyXAuction 合约");
        log("错误:", error.message);
        throw error;
    }

    // 验证代理地址
    if (!proxyAddress || proxyAddress === ethers.ZeroAddress) {
        throw new Error("Invalid proxy address");
    }

    // 获取实现合约地址（升级前）
    const oldImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    log(`Current implementation: ${oldImplementationAddress}`);

    // 获取 ProxyAdmin 地址
    const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    log(`ProxyAdmin: ${proxyAdminAddress}`);

    log("----------------------------------------------------");
    log("Deploying MyXAuctionV2 implementation...");

    // 获取签名者对象
    const signer = await ethers.getSigner(deployer);
    const MyXAuctionV2 = await ethers.getContractFactory("MyXAuctionV2", signer);

    // 升级代理合约
    log("Upgrading proxy to V2...");
    const myXAuctionV2Proxy = await upgrades.upgradeProxy(proxyAddress, MyXAuctionV2, {
        kind: "transparent",
        initializer: "initializeV2",
    });

    await myXAuctionV2Proxy.waitForDeployment();
    const upgradedProxyAddress = await myXAuctionV2Proxy.getAddress();

    // 验证代理地址没有改变
    if (upgradedProxyAddress.toLowerCase() !== proxyAddress.toLowerCase()) {
        throw new Error("Proxy address changed after upgrade!");
    }

    log(`✅ Proxy upgraded successfully`);
    log(`Proxy address: ${proxyAddress}`);

    // 获取新的实现合约地址
    const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    log(`New implementation: ${newImplementationAddress}`);

    // 检查实现地址是否改变
    if (oldImplementationAddress.toLowerCase() === newImplementationAddress.toLowerCase()) {
        log("⚠️  WARNING: Implementation address did not change!");
        log("Possible reasons:");
        log("1. The bytecode is identical (compiler optimization)");
        log("2. OpenZeppelin detected no functional changes");
        log("3. The upgrade transaction may not have executed properly");
        log("\nVerifying upgrade by testing V2 features...");
    } else {
        log("✅ Implementation address changed successfully");
    }

    log("----------------------------------------------------");
    log("Initializing V2 features...");

    // 连接升级后的合约
    const myXAuctionV2 = await ethers.getContractAt("MyXAuctionV2", proxyAddress);

    // 检查是否已经初始化 V2
    // try {
    //     // 尝试调用 initializeV2（如果已经初始化会失败）
    //     const initializeV2Tx = await myXAuctionV2.initializeV2();
    //     await initializeV2Tx.wait();
    //     log("✅ V2 features initialized");
    // } catch (error) {
    //     // 如果已经初始化，会抛出错误，这是正常的
    //     if (error.message.includes("Initializable: contract is already initialized") ||
    //         error.message.includes("Initializable: contract is not initializing")) {
    //         log("ℹ️  V2 features already initialized");
    //     } else {
    //         log("⚠️  Warning: Failed to initialize V2 features");
    //         log("错误:", error.message);
    //         log("你可以稍后手动调用 initializeV2() 函数");
    //     }
    // }

    // 更新部署记录
    const artifact = await deployments.getExtendedArtifact("MyXAuctionV2");
    await save("MyXAuctionV2", {
        address: proxyAddress,
        ...artifact,
    });

    log("----------------------------------------------------");
    log("Upgrade Summary:");
    log(`  Proxy Address: ${proxyAddress}`);
    log(`  Old Implementation: ${oldImplementationAddress}`);
    log(`  New Implementation: ${newImplementationAddress}`);
    log(`  ProxyAdmin: ${proxyAdminAddress}`);
    log("----------------------------------------------------");

    // 验证升级后的功能
    log("Verifying V2 features...");
    try {
        const platformFee = await myXAuctionV2.platformFee();
        const paused = await myXAuctionV2.paused();
        const totalAuctions = await myXAuctionV2.totalAuctionsCreated();
        const totalBids = await myXAuctionV2.totalBidsPlaced();

        log("V2 Features Status:");
        log(`  Platform Fee: ${platformFee.toString()} basis points (${Number(platformFee) / 100}%)`);
        log(`  Paused: ${paused}`);
        log(`  Total Auctions Created: ${totalAuctions.toString()}`);
        log(`  Total Bids Placed: ${totalBids.toString()}`);

        // 测试新功能
        log("\nTesting new functions...");
        const stats = await myXAuctionV2.getAuctionStats();
        log(`  Active Auctions: ${stats.activeAuctions.toString()}`);
        log("✅ All V2 features are working correctly");
    } catch (error) {
        log("⚠️  Warning: Some V2 features may not be accessible");
        log("错误:", error.message);
    }

    log("----------------------------------------------------");
    log("✅ Upgrade completed successfully!");
    log("----------------------------------------------------");
    log("\nNext steps:");
    log("1. Verify the upgrade on block explorer");
    log(`2. Test V2 features using the test scripts`);
    log("----------------------------------------------------");
};

module.exports.tags = ["myxaction-v2"];

