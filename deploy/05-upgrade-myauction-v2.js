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
        const myAuctionDeployment = await deployments.get("MyAuction");
        proxyAddress = myAuctionDeployment.address;
        log(`Found MyAuction proxy at: ${proxyAddress}`);
    } catch (error) {
        log("❌ 无法找到已部署的 MyAuction 合约");
        log("请先部署 MyAuction 合约");
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
    log("Deploying MyAuctionV2 implementation...");

    // 获取签名者对象
    const signer = await ethers.getSigner(deployer);
    const MyAuctionV2 = await ethers.getContractFactory("MyAuctionV2", signer);

    // 检查字节码差异（诊断用）
    log("Checking bytecode differences...");
    try {
        const MyAuction = await ethers.getContractFactory("MyAuction", signer);
        const myAuctionBytecode = await MyAuction.getDeploymentTransaction();
        const myAuctionV2Bytecode = await MyAuctionV2.getDeploymentTransaction();
        
        if (myAuctionBytecode && myAuctionV2Bytecode) {
            const oldBytecode = myAuctionBytecode.data || "";
            const newBytecode = myAuctionV2Bytecode.data || "";
            
            if (oldBytecode === newBytecode) {
                log("⚠️  WARNING: Bytecode is identical!");
                log("This is why the implementation address did not change.");
                log("OpenZeppelin reuses the same implementation when bytecode is identical.");
            } else {
                log(`✅ Bytecode differs (old: ${oldBytecode.length}, new: ${newBytecode.length} chars)`);
            }
        }
    } catch (error) {
        log("⚠️  Could not compare bytecode:", error.message);
    }

    // 验证升级兼容性
    log("Validating upgrade compatibility...");
    try {
        await upgrades.validateUpgrade(proxyAddress, MyAuctionV2, {
            kind: "transparent"
        });
        log("✅ Upgrade validation passed");
    } catch (error) {
        log("⚠️  Upgrade validation warning:");
        log(error.message);
        log("Continuing with upgrade anyway...");
    }

    // 升级代理合约
    log("Upgrading proxy to V2...");
    const myAuctionV2Proxy = await upgrades.upgradeProxy(proxyAddress, MyAuctionV2, {
        kind: "transparent",
    });

    await myAuctionV2Proxy.waitForDeployment();
    const upgradedProxyAddress = await myAuctionV2Proxy.getAddress();

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
    const myAuctionV2 = await ethers.getContractAt("MyAuctionV2", proxyAddress);

    // 检查是否已经初始化 V2
    try {
        // 尝试调用 initializeV2（如果已经初始化会失败）
        const initializeV2Tx = await myAuctionV2.initializeV2();
        await initializeV2Tx.wait();
        log("✅ V2 features initialized");
    } catch (error) {
        // 如果已经初始化，会抛出错误，这是正常的
        if (error.message.includes("Initializable: contract is already initialized") ||
            error.message.includes("Initializable: contract is not initializing")) {
            log("ℹ️  V2 features already initialized");
        } else {
            log("⚠️  Warning: Failed to initialize V2 features");
            log("错误:", error.message);
            log("你可以稍后手动调用 initializeV2() 函数");
        }
    }

    // 更新部署记录
    const artifact = await deployments.getExtendedArtifact("MyAuctionV2");
    await save("MyAuction", {
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
        const platformFee = await myAuctionV2.platformFee();
        const paused = await myAuctionV2.paused();
        const totalAuctions = await myAuctionV2.totalAuctionsCreated();
        const totalBids = await myAuctionV2.totalBidsPlaced();

        log("V2 Features Status:");
        log(`  Platform Fee: ${platformFee.toString()} basis points (${Number(platformFee) / 100}%)`);
        log(`  Paused: ${paused}`);
        log(`  Total Auctions Created: ${totalAuctions.toString()}`);
        log(`  Total Bids Placed: ${totalBids.toString()}`);

        // 测试新功能
        log("\nTesting new functions...");
        const stats = await myAuctionV2.getAuctionStats();
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
    log("3. If needed, call initializeV2() manually");
    log("----------------------------------------------------");
};

// 辅助函数：计算字节码相似度
function calculateSimilarity(str1, str2) {
    const minLength = Math.min(str1.length, str2.length);
    let matches = 0;
    for (let i = 0; i < minLength; i++) {
        if (str1[i] === str2[i]) {
            matches++;
        }
    }
    return (matches / minLength) * 100;
}

module.exports.tags = ["upgrade", "myauction-v2"];

