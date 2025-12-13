const { ethers, network } = require("hardhat");

/**
 * 测试 MyAuctionV2 的暂停/恢复功能
 * 
 * 使用方法：
 * npx hardhat run test/test-v2-pause-sepolia.js --network sepolia
 * 
 * 执行暂停：
 * ACTION=pause npx hardhat run test/test-v2-pause-sepolia.js --network sepolia
 * 
 * 执行恢复：
 * ACTION=unpause npx hardhat run test/test-v2-pause-sepolia.js --network sepolia
 */
async function main() {
  // 检查网络
  if (network.name !== "sepolia") {
    console.error("❌ 此脚本只能在 Sepolia 测试网上运行");
    console.log("请使用: npx hardhat run test/test-v2-pause-sepolia.js --network sepolia");
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

  // 获取操作类型
  const actionRaw = process.env.ACTION || 
    process.argv.find(arg => arg.toLowerCase().startsWith("action="))?.split("=")[1];
  const action = actionRaw ? actionRaw.trim().toLowerCase() : null;

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("==========================================");
  console.log("测试 MyAuctionV2 暂停/恢复功能");
  console.log("==========================================");
  console.log(`网络: ${network.name}`);
  console.log(`账户: ${signerAddress}`);
  console.log(`MyAuction 地址: ${myAuctionAddress}`);
  if (action) {
    console.log(`操作: ${action}`);
  }
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
        console.log("   ❌ 合约版本不是 V2，无法测试暂停功能");
        process.exit(1);
      }
    } catch (error) {
      console.log("   ❌ 无法获取版本号（可能尚未升级到 V2）");
      console.log(`   错误: ${error.message}`);
      process.exit(1);
    }
    console.log();

    // 2. 获取当前暂停状态
    console.log("2️⃣  获取当前暂停状态...");
    const currentPaused = await myAuction.paused();
    console.log(`   ✅ 当前状态: ${currentPaused ? "已暂停" : "正常运行"}`);
    console.log();

    // 3. 检查是否为合约所有者
    console.log("3️⃣  检查账户权限...");
    const owner = await myAuction.owner();
    const isOwner = owner.toLowerCase() === signerAddress.toLowerCase();
    console.log(`   合约所有者: ${owner}`);
    console.log(`   当前账户: ${signerAddress}`);
    console.log(`   是否为所有者: ${isOwner ? "是" : "否"}`);
    console.log();

    // 4. 根据操作类型执行相应操作
    if (action) {
      if (!isOwner) {
        console.log("❌ 只有合约所有者可以执行暂停/恢复操作");
        process.exit(1);
      }

      if (action === "pause") {
        if (currentPaused) {
          console.log("ℹ️  合约已经处于暂停状态，无需再次暂停");
        } else {
          console.log("4️⃣  执行暂停操作...");
          try {
            const tx = await myAuction.pause();
            console.log(`   📝 交易哈希: ${tx.hash}`);
            console.log("   ⏳ 等待交易确认...");
            
            const receipt = await tx.wait();
            console.log(`   ✅ 交易已确认 (区块: ${receipt.blockNumber})`);
            console.log();

            // 验证暂停状态
            const newPaused = await myAuction.paused();
            console.log("5️⃣  验证暂停状态...");
            console.log(`   ✅ 当前状态: ${newPaused ? "已暂停" : "正常运行"}`);
            if (newPaused) {
              console.log("   ✅ 暂停操作成功");
            } else {
              console.log("   ❌ 暂停操作失败");
            }
            console.log();
          } catch (error) {
            console.error("   ❌ 暂停操作失败:");
            console.error(`   错误: ${error.message}`);
            if (error.reason) {
              console.error(`   原因: ${error.reason}`);
            }
            process.exit(1);
          }
        }
      } else if (action === "unpause") {
        if (!currentPaused) {
          console.log("ℹ️  合约已经处于运行状态，无需恢复");
        } else {
          console.log("4️⃣  执行恢复操作...");
          try {
            const tx = await myAuction.unpause();
            console.log(`   📝 交易哈希: ${tx.hash}`);
            console.log("   ⏳ 等待交易确认...");
            
            const receipt = await tx.wait();
            console.log(`   ✅ 交易已确认 (区块: ${receipt.blockNumber})`);
            console.log();

            // 验证恢复状态
            const newPaused = await myAuction.paused();
            console.log("5️⃣  验证恢复状态...");
            console.log(`   ✅ 当前状态: ${newPaused ? "已暂停" : "正常运行"}`);
            if (!newPaused) {
              console.log("   ✅ 恢复操作成功");
            } else {
              console.log("   ❌ 恢复操作失败");
            }
            console.log();
          } catch (error) {
            console.error("   ❌ 恢复操作失败:");
            console.error(`   错误: ${error.message}`);
            if (error.reason) {
              console.error(`   原因: ${error.reason}`);
            }
            process.exit(1);
          }
        }
      } else {
        console.log(`❌ 不支持的操作: ${action}`);
        console.log("   支持的操作: pause, unpause");
        process.exit(1);
      }
    } else {
      console.log("4️⃣  跳过操作（未提供 ACTION 参数）");
      console.log("   提示:");
      console.log("   - 使用 ACTION=pause 暂停合约");
      console.log("   - 使用 ACTION=unpause 恢复合约");
      console.log();
    }

    // 5. 显示暂停功能的影响
    console.log("6️⃣  暂停功能说明...");
    console.log("   ==========================================");
    console.log("   当合约暂停时，以下操作将被阻止:");
    console.log("   - createAuction() - 创建拍卖");
    console.log("   - bid() - 出价");
    console.log("   - endAuctionAndClaimNFT() - 结束拍卖");
    console.log("   ==========================================");
    console.log("   以下操作仍然可用:");
    console.log("   - getAuction() - 查询拍卖信息");
    console.log("   - getAuctionCount() - 查询拍卖数量");
    console.log("   - getAuctionStats() - 查询统计信息");
    console.log("   - setPlatformFee() - 设置手续费（仅所有者）");
    console.log("   ==========================================");
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

