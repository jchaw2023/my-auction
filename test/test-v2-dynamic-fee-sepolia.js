const { ethers, network } = require("hardhat");

/**
 * 测试 MyAuctionV2 的动态手续费功能
 * 
 * 使用方法：
 * npx hardhat run test/test-v2-dynamic-fee-sepolia.js --network sepolia
 * 
 * 设置手续费档次（示例）：
 * npx hardhat run test/test-v2-dynamic-fee-sepolia.js --network sepolia
 */
async function main() {
    // 检查网络
    if (network.name !== "sepolia") {
        console.error("❌ 此脚本只能在 Sepolia 测试网上运行");
        console.log("请使用: npx hardhat run test/test-v2-dynamic-fee-sepolia.js --network sepolia");
        process.exit(1);
    }

    // 加载部署信息
    let myAuctionAddress;
    try {
        const auctionDeploy = require("../deployments/sepolia/MyAuction.json");
        myAuctionAddress = auctionDeploy.address;
    } catch (error) {
        console.error("❌ 无法加载部署信息，请确保合约已部署到 Sepolia 测试网");
        console.error("错误:", error.message);
        process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();

    console.log("==========================================");
    console.log("测试 MyAuctionV2 动态手续费功能");
    console.log("==========================================");
    console.log(`网络: ${network.name}`);
    console.log(`账户: ${signerAddress}`);
    console.log(`MyAuction 地址: ${myAuctionAddress}`);
    console.log("==========================================\n");

    // 连接合约（使用 MyAuctionV2 接口）
    const myAuction = await ethers.getContractAt("MyAuctionV2", myAuctionAddress);

    try {
        // 1. 检查版本号
        console.log("1️⃣  检查合约版本...");
        try {
            const version = await myAuction.version();
            console.log(`   ✅ 合约版本: V${version.toString()}`);
            if (version.toString() !== "2") {
                console.log("   ❌ 合约版本不是 V2，无法测试动态手续费功能");
                process.exit(1);
            }
        } catch (error) {
            console.log("   ❌ 无法获取版本号（可能尚未升级到 V2）");
            console.log(`   错误: ${error.message}`);
            process.exit(1);
        }
        console.log();

        // 2. 检查账户权限
        console.log("2️⃣  检查账户权限...");
        const owner = await myAuction.owner();
        const isOwner = owner.toLowerCase() === signerAddress.toLowerCase();
        console.log(`   合约所有者: ${owner}`);
        console.log(`   当前账户: ${signerAddress}`);
        console.log(`   是否为所有者: ${isOwner ? "是" : "否"}`);
        console.log();

        if (!isOwner) {
            console.log("⚠️  只有合约所有者可以设置动态手续费");
            console.log("   将仅显示当前配置信息\n");
        }

        // 3. 获取当前手续费配置
        console.log("3️⃣  获取当前手续费配置...");
        const currentPlatformFee = await myAuction.platformFee();
        const useDynamicFee = await myAuction.useDynamicFee();
        const feeTierCount = await myAuction.getFeeTierCount();

        console.log(`   固定手续费: ${currentPlatformFee.toString()} 基点 (${Number(currentPlatformFee) / 100}%)`);
        console.log(`   动态手续费启用: ${useDynamicFee ? "是" : "否"}`);
        console.log(`   手续费档次数量: ${feeTierCount.toString()}`);
        console.log();

        // 4. 获取所有手续费档次
        if (feeTierCount > 0) {
            console.log("4️⃣  手续费档次详情:");
            console.log("   ==========================================");
            const allTiers = await myAuction.getAllFeeTiers();
            const baseFee = await myAuction.baseFeeRate();
            const baseFeePercent = Number(baseFee) / 100;
            
            // 显示基础费率（用于低于最低阈值的金额）
            if (allTiers.length > 0) {
                const firstThreshold = Number(allTiers[0].threshold) / 1e8;
                console.log(`   档次 0: $0 - $${firstThreshold.toFixed(2)} → ${baseFeePercent}% (baseFeeRate)`);
            }
            
            // 显示其他档次
            for (let i = 0; i < allTiers.length; i++) {
                const tier = allTiers[i];
                const thresholdUSD = Number(tier.threshold) / 1e8;
                const feePercent = Number(tier.feeRate) / 100;
                
                if (i < allTiers.length - 1) {
                    const nextThreshold = Number(allTiers[i + 1].threshold) / 1e8;
                    console.log(`   档次 ${i + 1}: $${thresholdUSD.toFixed(2)} - $${nextThreshold.toFixed(2)} → ${feePercent}%`);
                } else {
                    // 最后一个档次
                    console.log(`   档次 ${i + 1}: $${thresholdUSD.toFixed(2)}+ → ${feePercent}%`);
                }
            }
            console.log("   ==========================================");
            console.log();
        } else {
            console.log("4️⃣  暂无手续费档次配置");
            console.log();
        }

        // 5. 测试动态手续费计算（如果已启用）
        if (useDynamicFee && feeTierCount > 0) {
            console.log("5️⃣  测试动态手续费计算...");
            console.log("   ==========================================");

            const testValues = [
                { usd: 500, desc: "$500" },
                { usd: 1000, desc: "$1,000" },
                { usd: 5000, desc: "$5,000" },
                { usd: 10000, desc: "$10,000" },
                { usd: 50000, desc: "$50,000" },
                { usd: 100000, desc: "$100,000" },
                { usd: 500000, desc: "$500,000" },
            ];

            for (const test of testValues) {
                const usdValue = BigInt(Math.floor(test.usd * 1e8)); // 转换为 8 位小数
                const feeRate = await myAuction.calculateDynamicFeeRate(usdValue);
                const feePercent = Number(feeRate) / 100;
                const feeAmount = (test.usd * feePercent) / 100;
                const sellerAmount = test.usd - feeAmount;

                console.log(`   ${test.desc}:`);
                console.log(`     手续费率: ${feePercent}%`);
                console.log(`     手续费金额: $${feeAmount.toFixed(2)}`);
                console.log(`     卖家收到: $${sellerAmount.toFixed(2)}`);
                console.log("   -----------------------------------------");
            }
            console.log("   ==========================================");
            console.log();
        } else {
            console.log("5️⃣  动态手续费未启用，跳过计算测试");
            console.log();
        }

        // 6. 如果是所有者，提供设置示例
        if (isOwner) {
            console.log("6️⃣  设置动态手续费示例:");
            console.log("   ==========================================");
            console.log("   示例配置（金额越大，手续费率越低）:");
            console.log("   - $0 - $1,000: 5% (500 基点)");
            console.log("   - $1,000 - $10,000: 3% (300 基点)");
            console.log("   - $10,000 - $100,000: 1% (100 基点)");
            console.log("   - $100,000+: 0.5% (50 基点)");
            console.log();
            console.log("   对应的阈值和费率数组:");
            console.log("   thresholds = [");
            console.log("     1000e8,    // $1,000");
            console.log("     10000e8,   // $10,000");
            console.log("     100000e8   // $100,000");
            console.log("   ]");
            console.log("   feeRates = [500, 300, 100, 50]");
            console.log();
            console.log("   注意：费率数组的长度应该比阈值数组多 1");
            console.log("   ==========================================");
            console.log();
        }

        // 7. 显示当前生效的手续费模式
        console.log("7️⃣  当前生效的手续费模式:");
        if (useDynamicFee && feeTierCount > 0) {
            console.log("   ✅ 使用动态手续费");
            console.log("   ℹ️  手续费根据拍卖金额的 USD 价值动态计算");
        } else {
            console.log("   ✅ 使用固定手续费");
            console.log(`   ℹ️  手续费率: ${Number(currentPlatformFee) / 100}%`);
        }
        console.log();

    } catch (error) {
        console.error("❌ 测试失败:");
        console.error(error.message);
        if (error.reason) {
            console.error(`原因: ${error.reason}`);
        }
        process.exit(1);
    }

    console.log("==========================================");
    console.log("✅ 所有测试完成");
    console.log("==========================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

