const { ethers, network } = require("hardhat");

/**
 * 测试 MyAuctionV2 的平台手续费功能
 * 
 * 使用方法：
 * npx hardhat run test/test-v2-platform-fee-sepolia.js --network sepolia
 * 
 * 设置手续费（基点，100 = 1%）：
 * FEE=200 npx hardhat run test/test-v2-platform-fee-sepolia.js --network sepolia
 */
async function main() {
  // 检查网络
  if (network.name !== "sepolia") {
    console.error("❌ 此脚本只能在 Sepolia 测试网上运行");
    console.log("请使用: npx hardhat run test/test-v2-platform-fee-sepolia.js --network sepolia");
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

  // 获取手续费参数（可选）
  const feeRaw = process.env.FEE || 
    process.argv.find(arg => arg.toLowerCase().startsWith("fee="))?.split("=")[1];
  const newFee = feeRaw ? parseInt(feeRaw.trim()) : null;

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("==========================================");
  console.log("测试 MyAuctionV2 平台手续费功能");
  console.log("==========================================");
  console.log(`网络: ${network.name}`);
  console.log(`账户: ${signerAddress}`);
  console.log(`MyAuction 地址: ${myAuctionAddress}`);
  if (newFee !== null) {
    console.log(`新手续费: ${newFee} 基点 (${newFee / 100}%)`);
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
        console.log("   ❌ 合约版本不是 V2，无法测试平台手续费功能");
        process.exit(1);
      }
    } catch (error) {
      console.log("   ❌ 无法获取版本号（可能尚未升级到 V2）");
      console.log(`   错误: ${error.message}`);
      process.exit(1);
    }
    console.log();

    // 2. 获取当前平台手续费
    console.log("2️⃣  获取当前平台手续费...");
    const currentFee = await myAuction.platformFee();
    const currentFeePercent = Number(currentFee) / 100;
    console.log(`   ✅ 当前平台手续费: ${currentFee.toString()} 基点 (${currentFeePercent}%)`);
    console.log();

    // 3. 检查是否为合约所有者
    console.log("3️⃣  检查账户权限...");
    const owner = await myAuction.owner();
    const isOwner = owner.toLowerCase() === signerAddress.toLowerCase();
    console.log(`   合约所有者: ${owner}`);
    console.log(`   当前账户: ${signerAddress}`);
    console.log(`   是否为所有者: ${isOwner ? "是" : "否"}`);
    console.log();

    // 4. 如果提供了新手续费且是所有者，则更新手续费
    if (newFee !== null) {
      if (!isOwner) {
        console.log("❌ 只有合约所有者可以设置平台手续费");
        process.exit(1);
      }

      if (newFee < 0 || newFee > 1000) {
        console.log("❌ 手续费必须在 0-1000 基点之间 (0-10%)");
        process.exit(1);
      }

      console.log("4️⃣  更新平台手续费...");
      console.log(`   从 ${currentFee.toString()} 基点 (${currentFeePercent}%)`);
      console.log(`   到 ${newFee} 基点 (${newFee / 100}%)`);
      console.log();

      try {
        const tx = await myAuction.setPlatformFee(newFee);
        console.log(`   📝 交易哈希: ${tx.hash}`);
        console.log("   ⏳ 等待交易确认...");
        
        const receipt = await tx.wait();
        console.log(`   ✅ 交易已确认 (区块: ${receipt.blockNumber})`);
        console.log();

        // 验证手续费是否更新
        const updatedFee = await myAuction.platformFee();
        const updatedFeePercent = Number(updatedFee) / 100;
        console.log("5️⃣  验证手续费更新...");
        console.log(`   ✅ 更新后的平台手续费: ${updatedFee.toString()} 基点 (${updatedFeePercent}%)`);
        
        if (updatedFee.toString() === newFee.toString()) {
          console.log("   ✅ 手续费更新成功");
        } else {
          console.log("   ❌ 手续费更新失败");
        }
        console.log();

      } catch (error) {
        console.error("   ❌ 更新手续费失败:");
        console.error(`   错误: ${error.message}`);
        if (error.reason) {
          console.error(`   原因: ${error.reason}`);
        }
        process.exit(1);
      }
    } else {
      console.log("4️⃣  跳过更新手续费（未提供 FEE 参数）");
      console.log("   提示: 使用 FEE=200 设置手续费为 2%");
      console.log();
    }

    // 5. 显示手续费计算示例
    console.log("6️⃣  手续费计算示例...");
    const finalFee = newFee !== null ? newFee : Number(currentFee);
    const examples = [
      { amount: "1.0", token: "ETH" },
      { amount: "100.0", token: "USDC" },
      { amount: "1000.0", token: "USDC" },
    ];

    console.log("   ==========================================");
    console.log("   手续费计算示例 (基于当前手续费):");
    console.log("   ==========================================");
    examples.forEach(example => {
      const amount = parseFloat(example.amount);
      const feeAmount = (amount * finalFee) / 10000;
      const sellerAmount = amount - feeAmount;
      console.log(`   出价金额: ${example.amount} ${example.token}`);
      console.log(`   手续费 (${finalFee / 100}%): ${feeAmount.toFixed(6)} ${example.token}`);
      console.log(`   卖家收到: ${sellerAmount.toFixed(6)} ${example.token}`);
      console.log("   -----------------------------------------");
    });
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

