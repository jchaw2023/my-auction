const { ethers, network } = require("hardhat");

/**
 * V2 版本测试：测试强制结束拍卖功能
 * 
 * 使用方法：
 * npx hardhat run test/test-v2-force-end-sepolia.js --network sepolia
 * 
 * 指定拍卖 ID：
 * AUCTION_ID=0 npx hardhat run test/test-v2-force-end-sepolia.js --network sepolia
 */
async function main() {
  // 检查网络
  if (network.name !== "sepolia") {
    console.error("❌ 此脚本只能在 Sepolia 测试网上运行");
    console.log("请使用: npx hardhat run test/test-v2-force-end-sepolia.js --network sepolia");
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

  // 获取拍卖 ID
  const auctionIdRaw = process.env.AUCTION_ID ||
    process.argv.find(arg => arg.toLowerCase().startsWith("auction-id="))?.split("=")[1] ||
    "0";
  
  const auctionId = parseInt(auctionIdRaw.trim());

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("==========================================");
  console.log("V2 版本测试：强制结束拍卖功能");
  console.log("==========================================");
  console.log(`网络: ${network.name}`);
  console.log(`账户: ${signerAddress}`);
  console.log(`MyAuction 地址: ${myAuctionAddress}`);
  console.log(`拍卖 ID: ${auctionId}`);
  console.log("==========================================\n");

  // 连接合约（使用 MyAuctionV2 接口）
  const myAuction = await ethers.getContractAt("MyAuctionV2", myAuctionAddress);

  try {
    // 1. 检查版本号
    console.log("1️⃣  检查合约版本...");
    try {
      const version = await myAuction.version();
      console.log(`   ✅ 合约版本: V${version.toString()}`);
      if (version < 2) {
        console.error("❌ 合约版本低于 V2，请先升级合约。");
        process.exit(1);
      }
    } catch (error) {
      console.error("❌ 无法获取合约版本，请确保合约已升级到 MyAuctionV2。");
      console.error("错误:", error.message);
      process.exit(1);
    }
    console.log();

    // 2. 检查账户权限
    console.log("2️⃣  检查账户权限...");
    const owner = await myAuction.owner();
    if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
      console.error(`❌ 当前账户 (${signerAddress}) 不是合约所有者 (${owner})。`);
      console.error("   只有合约所有者才能强制结束拍卖。");
      process.exit(1);
    }
    console.log(`   ✅ 当前账户 (${signerAddress}) 是合约所有者。`);
    console.log();

    // 3. 获取拍卖信息（强制结束前）
    console.log("3️⃣  获取拍卖信息（强制结束前）...");
    const auctionBefore = await myAuction.getAuction(auctionId);
    const currentTime = BigInt(Math.floor(Date.now() / 1000));

    console.log("   ==========================================");
    console.log(`   拍卖 #${auctionId} 信息:`);
    console.log("   ==========================================");
    console.log(`   NFT 合约地址: ${auctionBefore.nftAddress}`);
    console.log(`   Token ID: ${auctionBefore.tokenId.toString()}`);
    console.log(`   卖家: ${auctionBefore.seller}`);
    console.log(`   是否已结束: ${auctionBefore.ended ? "是" : "否"}`);
    console.log(`   开始时间: ${new Date(Number(auctionBefore.startTime) * 1000).toLocaleString()}`);
    console.log(`   结束时间: ${new Date(Number(auctionBefore.endTime) * 1000).toLocaleString()}`);
    console.log(`   当前时间: ${new Date(Number(currentTime) * 1000).toLocaleString()}`);
    
    if (auctionBefore.ended) {
      console.error("   ❌ 拍卖已经结束，无法强制结束");
      process.exit(1);
    }

    // 计算时间差
    const timeDiff = Number(auctionBefore.endTime - currentTime);
    if (timeDiff > 0) {
      const hours = Math.floor(timeDiff / 3600);
      const minutes = Math.floor((timeDiff % 3600) / 60);
      console.log(`   距离结束时间: ${hours} 小时 ${minutes} 分钟`);
    } else {
      console.log(`   拍卖已过期`);
    }

    if (auctionBefore.highestBidder !== ethers.ZeroAddress) {
      console.log(`   最高出价者: ${auctionBefore.highestBidder}`);
      if (auctionBefore.highestBidToken === ethers.ZeroAddress) {
        console.log(`   最高出价: ${ethers.formatEther(auctionBefore.highestBid)} ETH`);
      } else {
        try {
          const ERC20_ABI = ["function decimals() view returns (uint8)", "function symbol() view returns (string)"];
          const token = await ethers.getContractAt(ERC20_ABI, auctionBefore.highestBidToken);
          const decimals = await token.decimals();
          const symbol = await token.symbol().catch(() => "Unknown");
          console.log(`   最高出价: ${ethers.formatUnits(auctionBefore.highestBid, decimals)} ${symbol}`);
        } catch {
          console.log(`   最高出价: ${auctionBefore.highestBid.toString()} 代币`);
        }
      }
      console.log(`   最高出价价值: $${Number(auctionBefore.highestBidValue) / 1e8} USD`);
    } else {
      console.log(`   暂无出价`);
    }
    console.log("   ==========================================");
    console.log();

    // 4. 执行强制结束
    console.log("4️⃣  执行强制结束拍卖...");
    console.log("   ==========================================");
    console.log("   注意：强制结束将：");
    console.log("   1. 修改拍卖结束时间为当前时间");
    console.log("   2. 将拍卖状态标记为已结束");
    console.log("   3. 执行正常的结束流程（转移 NFT 和资金）");
    console.log("   ==========================================");
    console.log();

    console.log("   📝 发送强制结束交易...");
    const forceEndTx = await myAuction.forceEndAuctionAndClaimNFT(auctionId); // 调用新的强制结束函数
    console.log(`   ✅ 交易哈希: ${forceEndTx.hash}`);
    console.log("   ⏳ 等待交易确认...");

    const receipt = await forceEndTx.wait();
    console.log(`   ✅ 交易已确认 (区块: ${receipt.blockNumber})`);
    console.log(`   Gas 使用: ${receipt.gasUsed.toString()}`);
    console.log();

    // 5. 检查事件
    console.log("5️⃣  检查事件...");
    const forceEndEvent = receipt.logs.find(log => {
      try {
        const parsed = myAuction.interface.parseLog(log);
        return parsed && parsed.name === "AuctionForceEnded";
      } catch {
        return false;
      }
    });

    if (forceEndEvent) {
      const parsed = myAuction.interface.parseLog(forceEndEvent);
      console.log("   ✅ AuctionForceEnded 事件:");
      console.log(`      拍卖 ID: ${parsed.args.auctionId.toString()}`);
      console.log(`      结束者: ${parsed.args.endedBy}`);
    } else {
      console.log("   ⚠️  未找到 AuctionForceEnded 事件");
    }
    console.log();

    // 6. 验证强制结束结果
    console.log("6️⃣  验证强制结束结果...");
    const auctionAfter = await myAuction.getAuction(auctionId);
    const currentTimeAfter = BigInt(Math.floor(Date.now() / 1000));

    console.log("   ==========================================");
    console.log(`   拍卖 #${auctionId} 信息（强制结束后）:`);
    console.log("   ==========================================");
    console.log(`   是否已结束: ${auctionAfter.ended ? "是 ✅" : "否 ❌"}`);
    console.log(`   结束时间: ${new Date(Number(auctionAfter.endTime) * 1000).toLocaleString()}`);
    console.log(`   当前时间: ${new Date(Number(currentTimeAfter) * 1000).toLocaleString()}`);
    
    // 验证结束时间是否被修改为当前时间（允许一定误差）
    const endTimeDiff = Math.abs(Number(auctionAfter.endTime - currentTimeAfter));
    if (endTimeDiff <= 60) { // 允许 60 秒误差
      console.log(`   ✅ 结束时间已修改为当前时间（误差: ${endTimeDiff} 秒）`);
    } else {
      console.log(`   ⚠️  结束时间修改异常（差异: ${endTimeDiff} 秒）`);
    }

    // 验证结束时间是否被修改（应该等于或接近当前时间）
    if (auctionAfter.endTime <= currentTimeAfter && auctionAfter.endTime >= currentTimeAfter - 60n) {
      console.log(`   ✅ 结束时间已正确修改为当前时间`);
    } else {
      console.log(`   ⚠️  结束时间修改可能不正确`);
    }

    if (auctionAfter.ended) {
      console.log(`   ✅ 拍卖状态已标记为已结束`);
    } else {
      console.log(`   ❌ 拍卖状态未正确标记为已结束`);
    }
    console.log("   ==========================================");
    console.log();

    // 7. 验证 NFT 和资金转移
    console.log("7️⃣  验证 NFT 和资金转移...");
    if (auctionAfter.highestBidder !== ethers.ZeroAddress) {
      console.log("   ✅ 有最高出价者，NFT 和资金应该已经转移");
      console.log(`   最高出价者: ${auctionAfter.highestBidder}`);
      
      // 验证 NFT 所有权
      try {
        const ERC721_ABI = ["function ownerOf(uint256) view returns (address)"];
        const nftContract = await ethers.getContractAt(ERC721_ABI, auctionAfter.nftAddress);
        const nftOwner = await nftContract.ownerOf(auctionAfter.tokenId);
        if (nftOwner.toLowerCase() === auctionAfter.highestBidder.toLowerCase()) {
          console.log(`   ✅ NFT 已成功转移给最高出价者`);
        } else {
          console.log(`   ⚠️  NFT 所有权异常，当前所有者: ${nftOwner}`);
        }
      } catch (error) {
        console.log(`   ⚠️  无法验证 NFT 所有权: ${error.message}`);
      }
    } else {
      console.log("   ✅ 无出价者，NFT 应该已归还给卖家");
      console.log(`   卖家: ${auctionAfter.seller}`);
      
      // 验证 NFT 所有权
      try {
        const ERC721_ABI = ["function ownerOf(uint256) view returns (address)"];
        const nftContract = await ethers.getContractAt(ERC721_ABI, auctionAfter.nftAddress);
        const nftOwner = await nftContract.ownerOf(auctionAfter.tokenId);
        if (nftOwner.toLowerCase() === auctionAfter.seller.toLowerCase()) {
          console.log(`   ✅ NFT 已成功归还给卖家`);
        } else {
          console.log(`   ⚠️  NFT 所有权异常，当前所有者: ${nftOwner}`);
        }
      } catch (error) {
        console.log(`   ⚠️  无法验证 NFT 所有权: ${error.message}`);
      }
    }
    console.log();

    // 8. 检查 AuctionEnded 事件
    console.log("8️⃣  检查 AuctionEnded 事件...");
    const auctionEndedEvent = receipt.logs.find(log => {
      try {
        const parsed = myAuction.interface.parseLog(log);
        return parsed && parsed.name === "AuctionEnded";
      } catch {
        return false;
      }
    });

    if (auctionEndedEvent) {
      const parsed = myAuction.interface.parseLog(auctionEndedEvent);
      console.log("   ✅ AuctionEnded 事件:");
      console.log(`      拍卖 ID: ${parsed.args.auctionId.toString()}`);
      console.log(`      获胜者: ${parsed.args.winner}`);
      console.log(`      最终出价: ${parsed.args.finalBid.toString()}`);
      console.log(`      卖家: ${parsed.args.seller}`);
      console.log(`      支付代币: ${parsed.args.paymentToken}`);
    } else {
      console.log("   ⚠️  未找到 AuctionEnded 事件");
    }
    console.log();

  } catch (error) {
    console.error("❌ 测试失败:");
    if (error.reason) {
      console.error(`   错误原因: ${error.reason}`);
    } else if (error.message) {
      console.error(`   错误信息: ${error.message}`);
    } else {
      console.error(error);
    }
    process.exit(1);
  }

  console.log("==========================================");
  console.log("✅ 强制结束拍卖测试完成");
  console.log("==========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

