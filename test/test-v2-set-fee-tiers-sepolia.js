const { ethers, network } = require("hardhat");

/**
 * 测试设置 MyAuctionV2 的动态手续费档次
 * 
 * 使用方法：
 * npx hardhat run test/test-v2-set-fee-tiers-sepolia.js --network sepolia
 * 
 * 设置自定义手续费档次（示例）：
 * npx hardhat run test/test-v2-set-fee-tiers-sepolia.js --network sepolia
 */
async function main() {
    // 检查网络
    if (network.name !== "sepolia") {
        console.error("❌ 此脚本只能在 Sepolia 测试网上运行");
        console.log("请使用: npx hardhat run test/test-v2-set-fee-tiers-sepolia.js --network sepolia");
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
    console.log("设置 MyAuctionV2 动态手续费档次");
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
                console.log("   ❌ 合约版本不是 V2，无法设置动态手续费");
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
            console.log("❌ 只有合约所有者可以设置动态手续费档次");
            process.exit(1);
        }

        // 3. 获取当前配置
        console.log("3️⃣  获取当前手续费配置...");
        const currentPlatformFee = await myAuction.platformFee();
        const useDynamicFee = await myAuction.useDynamicFee();
        const feeTierCount = await myAuction.getFeeTierCount();

        console.log(`   固定手续费: ${currentPlatformFee.toString()} 基点 (${Number(currentPlatformFee) / 100}%)`);
        console.log(`   动态手续费启用: ${useDynamicFee ? "是" : "否"}`);
        console.log(`   当前手续费档次数量: ${feeTierCount.toString()}`);
        console.log();

        // 4. 显示当前手续费档次（如果存在）
        if (feeTierCount > 0) {
            console.log("4️⃣  当前手续费档次:");
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
        }

    // 5. 设置新的手续费档次
    console.log("5️⃣  设置新的动态手续费档次...");
    console.log("   ==========================================");
    console.log("   配置方案：金额越大，手续费率越低");
    console.log("   - $0 - $1,000: 5% (500 基点)");
    console.log("   - $1,000 - $10,000: 3% (300 基点)");
    console.log("   - $10,000 - $100,000: 1% (100 基点)");
    console.log("   - $100,000+: 0.5% (50 基点)");
    console.log("   注意：费率数组应该比阈值数组多一个元素");
    console.log("   ==========================================");
    console.log();

        // 定义阈值和费率
        // 重要：费率数组应该比阈值数组多一个元素！
        // 合约逻辑：
        // - feeRates[0] (baseFeeRate) 用于金额 < thresholds[0]
        // - feeRates[i+1] 用于 thresholds[i] <= 金额 < thresholds[i+1]
        // - feeRates[last] 用于金额 >= thresholds[last-1]

        // 阈值：USD 价值（8位小数），按从低到高排序
        const thresholds = [
          ethers.parseUnits("1000", 8),    // $1,000
          ethers.parseUnits("10000", 8),   // $10,000
          ethers.parseUnits("100000", 8),   // $100,000
        ];

        // 费率：基点（100 = 1%）
        // 费率数组应该比阈值数组多一个元素
        // 费率设计：金额越大，手续费率越低（递减）
        // - feeRates[0] 用于 $0 - $1,000 (baseFeeRate) - 最高费率
        // - feeRates[1] 用于 $1,000 - $10,000 - 次高费率
        // - feeRates[2] 用于 $10,000 - $100,000 - 中等费率
        // - feeRates[3] 用于 $100,000+ - 最低费率
        const feeRates = [
          500,  // 5% for $0 - $1,000 (baseFeeRate) - 最高费率
          300,  // 3% for $1,000 - $10,000 - 递减
          100,  // 1% for $10,000 - $100,000 - 递减
          50,   // 0.5% for $100,000+ - 最低费率
        ];

        // 验证数组长度
        if (feeRates.length !== thresholds.length + 1) {
            console.error(`❌ 数组长度不匹配！阈值数组长度: ${thresholds.length}, 费率数组长度应该是: ${thresholds.length + 1}, 实际: ${feeRates.length}`);
            process.exit(1);
        }

        console.log("   阈值数组:");
        thresholds.forEach((threshold, i) => {
            const usd = Number(threshold) / 1e8;
            console.log(`     [${i}]: ${threshold.toString()} ($${usd.toFixed(2)})`);
        });
        console.log();

        console.log("   费率数组:");
        feeRates.forEach((rate, i) => {
            const percent = Number(rate) / 100;
            console.log(`     [${i}]: ${rate} 基点 (${percent}%)`);
        });
        console.log();

        try {
            console.log("   📝 发送设置手续费档次交易...");
            const tx = await myAuction.setFeeTiers(thresholds, feeRates);
            console.log(`   ✅ 交易哈希: ${tx.hash}`);
            console.log("   ⏳ 等待交易确认...");

            const receipt = await tx.wait();
            console.log(`   ✅ 交易已确认 (区块: ${receipt.blockNumber})`);
            console.log();

            // 6. 验证设置结果
            console.log("6️⃣  验证手续费档次设置...");
            const newFeeTierCount = await myAuction.getFeeTierCount();
            const newUseDynamicFee = await myAuction.useDynamicFee();

            console.log(`   ✅ 手续费档次数量: ${newFeeTierCount.toString()}`);
            console.log(`   ✅ 动态手续费启用: ${newUseDynamicFee ? "是" : "否"}`);
            console.log();

      // 7. 显示设置后的手续费档次
      console.log("7️⃣  设置后的手续费档次:");
      console.log("   ==========================================");
      const newAllTiers = await myAuction.getAllFeeTiers();
      const newBaseFee = await myAuction.baseFeeRate();
      const newBaseFeePercent = Number(newBaseFee) / 100;
      
      // 显示基础费率（用于低于最低阈值的金额）
      if (newAllTiers.length > 0) {
        const firstThreshold = Number(newAllTiers[0].threshold) / 1e8;
        console.log(`   档次 0: $0 - $${firstThreshold.toFixed(2)} → ${newBaseFeePercent}% (baseFeeRate)`);
      }
      
      // 显示其他档次
      for (let i = 0; i < newAllTiers.length; i++) {
        const tier = newAllTiers[i];
        const thresholdUSD = Number(tier.threshold) / 1e8;
        const feePercent = Number(tier.feeRate) / 100;
        
        if (i < newAllTiers.length - 1) {
          const nextThreshold = Number(newAllTiers[i + 1].threshold) / 1e8;
          console.log(`   档次 ${i + 1}: $${thresholdUSD.toFixed(2)} - $${nextThreshold.toFixed(2)} → ${feePercent}%`);
        } else {
          // 最后一个档次
          console.log(`   档次 ${i + 1}: $${thresholdUSD.toFixed(2)}+ → ${feePercent}%`);
        }
      }
      console.log("   ==========================================");
      console.log();

            // 8. 测试不同金额的手续费计算
            console.log("8️⃣  测试不同金额的手续费计算:");
            console.log("   ==========================================");

      const testCases = [
        { usd: 500, desc: "$500", expected: "5%" },
        { usd: 1000, desc: "$1,000", expected: "3%" },
        { usd: 5000, desc: "$5,000", expected: "3%" },
        { usd: 10000, desc: "$10,000", expected: "1%" },
        { usd: 50000, desc: "$50,000", expected: "1%" },
        { usd: 100000, desc: "$100,000", expected: "0.5%" },
        { usd: 500000, desc: "$500,000", expected: "0.5%" },
      ];

            for (const testCase of testCases) {
                const usdValue = BigInt(Math.floor(testCase.usd * 1e8)); // 转换为 8 位小数
                const feeRate = await myAuction.calculateDynamicFeeRate(usdValue);
                const feePercent = Number(feeRate) / 100;
                const feeAmount = (testCase.usd * feePercent) / 100;
                const sellerAmount = testCase.usd - feeAmount;
                const match = feePercent.toFixed(1) + "%" === testCase.expected ? "✅" : "⚠️";

                console.log(`   ${testCase.desc}:`);
                console.log(`     手续费率: ${feePercent}% ${match} (预期: ${testCase.expected})`);
                console.log(`     手续费金额: $${feeAmount.toFixed(2)}`);
                console.log(`     卖家收到: $${sellerAmount.toFixed(2)}`);
                console.log("   -----------------------------------------");
            }
            console.log("   ==========================================");
            console.log();

        } catch (error) {
            console.error("   ❌ 设置手续费档次失败:");
            console.error(`   错误: ${error.message}`);
            if (error.reason) {
                console.error(`   原因: ${error.reason}`);
            }
            if (error.data) {
                console.error(`   数据: ${error.data}`);
            }
            process.exit(1);
        }

        // 9. 测试启用/禁用动态手续费
        console.log("9️⃣  测试启用/禁用动态手续费...");
        try {
            // 先禁用
            console.log("   禁用动态手续费...");
            const disableTx = await myAuction.setDynamicFeeEnabled(false);
            await disableTx.wait();
            const disabled = await myAuction.useDynamicFee();
            console.log(`   ✅ 动态手续费已禁用: ${disabled ? "否" : "是"}`);
            console.log();

            // 再启用
            console.log("   启用动态手续费...");
            const enableTx = await myAuction.setDynamicFeeEnabled(true);
            await enableTx.wait();
            const enabled = await myAuction.useDynamicFee();
            console.log(`   ✅ 动态手续费已启用: ${enabled ? "是" : "否"}`);
            console.log();
        } catch (error) {
            console.log(`   ⚠️  启用/禁用测试失败: ${error.message}`);
            console.log();
        }

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
    console.log("\n提示:");
    console.log("- 动态手续费已设置并启用");
    console.log("- 可以使用 test-v2-dynamic-fee-sepolia.js 查看当前配置");
    console.log("- 可以使用 test-v2-platform-fee-sepolia.js 设置固定手续费");
    console.log("==========================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

