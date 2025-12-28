const { ethers, network } = require("hardhat");

/**
 * 测试 MyAuctionV2 的统计信息功能
 * 
 * 使用方法：
 * npx hardhat run test/test-v2-stats-sepolia.js --network sepolia
 */
async function main() {
  // 检查网络
  if (network.name !== "sepolia") {
    console.error("❌ 此脚本只能在 Sepolia 测试网上运行");
    console.log("请使用: npx hardhat run test/test-x-v1-stats-sepolia.js --network sepolia");
    process.exit(1);
  }

  // 加载部署信息
  let myXAuctionAddress;
  try {
    const xAuctionDeploy = require("../deployments/sepolia/MyXAuction.json");
    myXAuctionAddress = xAuctionDeploy.address;
  } catch (error) {
    console.error("❌ 无法加载部署信息，请确保合约已部署到 Sepolia 测试网");
    console.error("错误:", error.message);
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("==========================================");
  console.log("测试 MyXAuction 统计信息功能");
  console.log("==========================================");
  console.log(`网络: ${network.name}`);
  console.log(`账户: ${signerAddress}`);
  console.log(`MyXAuction 地址: ${myXAuctionAddress}`);
  console.log("==========================================\n");

  // 连接合约（使用 MyXAuction 接口）
  const myXAuction = await ethers.getContractAt("MyXAuction", myXAuctionAddress);

  try {
    // 1. 检查版本号（验证是否已升级到 V2）
    console.log("1️⃣  检查合约版本...");
    try {
      const version = await myXAuction.version();
      console.log(`   ✅ 合约版本: V${version.toString()}`);
      if (version.toString() !== "1.0.0") {
        console.log("   ⚠️  警告: 合约版本不是 V1，可能尚未升级");
      }
    } catch (error) {
      console.log("   ❌ 无法获取版本号（可能尚未升级到 V1）");
      console.log(`   错误: ${error.message}`);
    }
    console.log();

    // 2. 获取平台手续费
    console.log("2️⃣  获取平台手续费...");
    const platformFee = await myXAuction.platformFee();
    const feePercent = Number(platformFee) / 100;
    console.log(`   ✅ 平台手续费: ${platformFee.toString()} 基点 (${feePercent}%)`);
    console.log();

    // 3. 获取暂停状态
    console.log("3️⃣  获取暂停状态...");
    const paused = await myXAuction.paused();
    console.log(`   ✅ 合约状态: ${paused ? "已暂停" : "正常运行"}`);
    console.log();

    // 4. 获取总创建的拍卖数
    console.log("4️⃣  获取总创建的拍卖数...");
    const totalAuctionsCreated = await myXAuction.totalAuctionsCreated();
    console.log(`   ✅ 总创建的拍卖数: ${totalAuctionsCreated.toString()}`);
    console.log();

    // 5. 获取总出价次数
    console.log("5️⃣  获取总出价次数...");
    const totalBidsPlaced = await myXAuction.totalBidsPlaced();
    console.log(`   ✅ 总出价次数: ${totalBidsPlaced.toString()}`);
    console.log();

    // 6. 获取拍卖统计信息（综合）
    console.log("6️⃣  获取综合统计信息...");
    const stats = await myXAuction.getAuctionStats();
    console.log("   ==========================================");
    console.log("   统计信息详情:");
    console.log("   ==========================================");
    console.log(`   总创建的拍卖数: ${stats.totalAuctions.toString()}`);
    console.log(`   总出价次数: ${stats.totalBids.toString()}`);
    console.log(`   当前平台手续费: ${stats.currentPlatformFee.toString()} 基点 (${Number(stats.currentPlatformFee) / 100}%)`);
    console.log(`   合约状态: ${stats.isPaused ? "已暂停" : "正常运行"}`);
    console.log(`   活跃拍卖数: ${stats.activeAuctions.toString()}`);
    console.log("   ==========================================");
    console.log();

    // 7. 获取拍卖总数（对比）
    console.log("7️⃣  对比拍卖总数...");
    const auctionCount = await myXAuction.getAuctionCount();
    console.log(`   getAuctionCount(): ${auctionCount.toString()}`);
    console.log(`   totalAuctionsCreated: ${totalAuctionsCreated.toString()}`);
    if (auctionCount.toString() === totalAuctionsCreated.toString()) {
      console.log("   ✅ 数据一致");
    } else {
      console.log("   ⚠️  数据不一致（可能是在升级前创建的拍卖）");
    }
    console.log();

    // 8. 测试获取指定拍卖的出价次数
    console.log("8️⃣  测试获取指定拍卖的出价次数...");
    if (auctionCount > 0n) {
      for (let i = 0; i < Math.min(Number(auctionCount), 5); i++) {
        try {
          const bidCount = await myXAuction.getAuctionBidCount(i);
          console.log(`   拍卖 #${i} 的出价次数: ${bidCount.toString()}`);
        } catch (error) {
          console.log(`   拍卖 #${i}: 无法获取出价次数 - ${error.message}`);
        }
      }
    } else {
      console.log("   ℹ️  暂无拍卖，跳过此测试");
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

