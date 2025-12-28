const { ethers, network } = require("hardhat");

/**
 * 测试 MyAuctionV2 的批量获取功能
 * 
 * 使用方法：
 * npx hardhat run test/test-v2-batch-sepolia.js --network sepolia
 * 
 * 指定起始索引和数量：
 * START=0 COUNT=5 npx hardhat run test/test-x-v2-batch-sepolia.js --network sepolia
 */
async function main() {
  // 检查网络
  if (network.name !== "sepolia") {
    console.error("❌ 此脚本只能在 Sepolia 测试网上运行");
    console.log("请使用: npx hardhat run test/test-x-v2-batch-sepolia.js --network sepolia");
    process.exit(1);
  }

  // 加载部署信息
  let myAuctionAddress;
  try {
    const auctionDeploy = require("../deployments/sepolia/MyXAuctionV2.json");
    myAuctionAddress = auctionDeploy.address;
  } catch (error) {
    console.error("❌ 无法加载部署信息，请确保合约已部署到 Sepolia 测试网");
    console.error("错误:", error.message);
    process.exit(1);
  }

  // 获取参数
  
  const startIndex = 0;
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("==========================================");
  console.log("测试 MyAuctionV2 批量获取功能");
  console.log("==========================================");
  console.log(`网络: ${network.name}`);
  console.log(`账户: ${signerAddress}`);
  console.log(`MyAuction 地址: ${myAuctionAddress}`);
  console.log("==========================================\n");

  // 连接合约（使用 MyAuctionV2 接口）
  const myAuction = await ethers.getContractAt("MyXAuctionV2", myAuctionAddress);

  try {
    // 1. 检查版本号
    console.log("1️⃣  检查合约版本...");
    try {
      const version = await myAuction.version();
      console.log(`   ✅ 合约版本: V${version.toString()}`);
    } catch (error) {
      console.log("   ❌ 无法获取版本号（可能尚未升级到 V2）");
      console.log(`   错误: ${error.message}`);
      process.exit(1);
    }
    console.log();

    // 2. 获取拍卖总数
    console.log("2️⃣  获取拍卖总数...");
    const totalCount = await myAuction.getAuctionCount();
    console.log(`   ✅ 总拍卖数: ${totalCount.toString()}`);
    console.log();

    if (totalCount === 0n) {
      console.log("ℹ️  暂无拍卖，无法测试批量获取功能");
      console.log("==========================================");
      console.log("✅ 测试完成（无数据）");
      console.log("==========================================");
      return;
    }

    const count = Number(totalCount);

    // 4. 使用批量获取功能
    console.log("3️⃣  使用批量获取功能...");
    console.log(`   起始索引: ${startIndex}`);
    console.log(`   获取数量: ${count}`);
    console.log();
    try {
      const auctions = await myAuction.getAuctionsBatch(startIndex, count);
      console.log(`   ✅ 成功获取 ${auctions.length} 个拍卖信息`);
      console.log();

      // 5. 显示批量获取的结果
      console.log("4️⃣  批量获取结果:");
      console.log("   ==========================================");
      
      if (auctions.length === 0) {
        console.log("   ℹ️  没有获取到任何拍卖信息");
      } else {
        auctions.forEach((auction, index) => {
          const actualIndex = startIndex + index;
          console.log(`   拍卖 #${actualIndex}:`);
          console.log(`     NFT 地址: ${auction.nftAddress}`);
          console.log(`     Token ID: ${auction.tokenId.toString()}`);
          console.log(`     卖家: ${auction.seller}`);
          console.log(`     起始价格: $${Number(auction.startPrice) / 1e8} USD`);
          console.log(`     开始时间: ${new Date(Number(auction.startTime) * 1000).toLocaleString()}`);
          console.log(`     结束时间: ${new Date(Number(auction.endTime) * 1000).toLocaleString()}`);
          console.log(`     是否已结束: ${auction.ended ? "是" : "否"}`);
          
          if (auction.highestBidder !== ethers.ZeroAddress) {
            console.log(`     最高出价者: ${auction.highestBidder}`);
            if (auction.highestBidToken === ethers.ZeroAddress) {
              console.log(`     最高出价: ${ethers.formatEther(auction.highestBid)} ETH`);
            } else {
              console.log(`     最高出价代币: ${auction.highestBidToken}`);
              console.log(`     最高出价: ${auction.highestBid.toString()}`);
            }
            console.log(`     最高出价价值: $${Number(auction.highestBidValue) / 1e8} USD`);
          } else {
            console.log(`     暂无出价`);
          }
          console.log("   -----------------------------------------");
        });
      }
      console.log("   ==========================================");
      console.log();

      // 6. 对比单个获取和批量获取的性能
      // console.log("5️⃣  性能对比测试...");
      // const testCount = Math.min(auctions.length, 3);
      
      // if (testCount > 0) {
      //   console.log(`   测试获取 ${testCount} 个拍卖信息...`);
        
      //   // 单个获取
      //   const startTime1 = Date.now();
      //   for (let i = 0; i < testCount; i++) {
      //     await myAuction.getAuction(startIndex + i);
      //   }
      //   const time1 = Date.now() - startTime1;
        
      //   // 批量获取
      //   const startTime2 = Date.now();
      //   await myAuction.getAuctionsBatch(startIndex, testCount);
      //   const time2 = Date.now() - startTime2;
        
      //   console.log(`   单个获取耗时: ${time1}ms`);
      //   console.log(`   批量获取耗时: ${time2}ms`);
      //   if (time2 < time1) {
      //     const improvement = ((time1 - time2) / time1 * 100).toFixed(1);
      //     console.log(`   ✅ 批量获取快 ${improvement}%`);
      //   } else {
      //     console.log(`   ℹ️  批量获取耗时较长（可能是网络延迟）`);
      //   }
      //   console.log();
      // }

    } catch (error) {
      console.error("   ❌ 批量获取失败:");
      console.error(`   错误: ${error.message}`);
      if (error.reason) {
        console.error(`   原因: ${error.reason}`);
      }
      process.exit(1);
    }

    // 7. 测试边界情况
    console.log("6️⃣  测试边界情况...");
    
    // 测试超出范围的情况
    try {
      const endIndex = Number(startIndex) + Number(count);
      if (endIndex > Number(totalCount)) {
        console.log(`   ℹ️  请求数量超出范围，将自动调整`);
        const adjustedAuctions = await myAuction.getAuctionsBatch(startIndex, count);
        console.log(`   ✅ 实际返回 ${adjustedAuctions.length} 个拍卖（自动调整）`);
      } else {
        console.log(`   ✅ 参数在有效范围内`);
      }
    } catch (error) {
      console.log(`   ⚠️  边界测试失败: ${error.message}`);
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

