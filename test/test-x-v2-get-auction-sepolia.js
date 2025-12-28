const { ethers, network } = require("hardhat");

/**
 * V1 版本测试：获取 Sepolia 测试网上的特定拍卖信息
 * 
 * 此脚本用于测试 MyAuction V1 版本的拍卖详情查询功能
 * 可以获取指定拍卖 ID 的详细信息，包括出价信息、时间信息等
 * 
 * 使用方法：
 * AUCTION_ID=0 npx hardhat run test/test-x-v2-get-auction-sepolia.js --network sepolia
 * 
 * Windows:
 * set AUCTION_ID=0 && npx hardhat run test/test-x-v2-get-auction-sepolia.js --network sepolia
 */
async function main() {
  // 检查网络
  if (network.name !== "sepolia") {
    console.error("❌ 此脚本只能在 Sepolia 测试网上运行");
    console.log("请使用: npx hardhat run test/test-x-v2-get-auction-sepolia.js --network sepolia");
    process.exit(1);
  }

  // 加载部署信息
  let myAuctionAddress, myNFTAddress;
  try {
    const auctionDeploy = require("../deployments/sepolia/MyXAuctionV2.json");
    const nftDeploy = require("../deployments/sepolia/MyNFT.json");
    myAuctionAddress = auctionDeploy.address;
    myNFTAddress = nftDeploy.address;
  } catch (error) {
    console.error("❌ 无法加载部署信息，请确保合约已部署到 Sepolia 测试网");
    console.error("错误:", error.message);
    process.exit(1);
  }

  // 获取拍卖 ID
  const auctionIdRaw = process.env.AUCTION_ID ||
    process.argv.find(arg => arg.toLowerCase().startsWith("auction-id="))?.split("=")[1];
  
  if (!auctionIdRaw) {
    console.error("❌ 缺少 AUCTION_ID 环境变量");
    console.log("\n使用方法:");
    console.log("  Windows: set AUCTION_ID=0 && npx hardhat run test/get-auction-sepolia.js --network sepolia");
    console.log("  Linux/Mac: AUCTION_ID=0 npx hardhat run test/get-auction-sepolia.js --network sepolia");
    process.exit(1);
  }

  const auctionId = parseInt(auctionIdRaw.trim());

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("==========================================");
  console.log("V1 版本测试：获取拍卖信息 (Sepolia 测试网)");
  console.log("==========================================");
  console.log(`网络: ${network.name}`);
  console.log(`账户: ${signerAddress}`);
  console.log(`MyAuction 地址: ${myAuctionAddress}`);
  console.log(`MyNFT 地址: ${myNFTAddress}`);
  console.log(`拍卖 ID: ${auctionId}`);
  console.log("==========================================\n");

  // 连接合约
  const myAuction = await ethers.getContractAt("MyXAuctionV2", myAuctionAddress);

  // 获取拍卖信息
  console.log(`📋 获取拍卖 #${auctionId} 信息...\n`);

  try {
    const auction = await myAuction.getAuction(auctionId);
    const currentTime = BigInt(Math.floor(Date.now() / 1000));

    console.log("==========================================");
    console.log(`拍卖 #${auctionId} 详细信息`);
    console.log("==========================================");
    console.log(`NFT 合约地址: ${auction.nftAddress}`);
    console.log(`Token ID: ${auction.tokenId.toString()}`);
    console.log(`卖家: ${auction.seller}`);
    console.log(`起始价格: $${Number(auction.startPrice) / 1e8} USD`);
    console.log(`开始时间: ${new Date(Number(auction.startTime) * 1000).toLocaleString()}`);
    console.log(`结束时间: ${new Date(Number(auction.endTime) * 1000).toLocaleString()}`);
    console.log(`是否已结束: ${auction.ended ? "是" : "否"}`);

    // 计算状态
    let status;
    if (auction.ended) {
      status = "已结束";
    } else if (currentTime < auction.startTime) {
      const timeLeft = Number(auction.startTime - currentTime);
      status = `未开始 (${Math.floor(timeLeft / 3600)} 小时后开始)`;
    } else if (currentTime > auction.endTime) {
      status = "已过期";
    } else {
      const timeLeft = Number(auction.endTime - currentTime);
      const hours = Math.floor(timeLeft / 3600);
      const minutes = Math.floor((timeLeft % 3600) / 60);
      status = `进行中 (剩余 ${hours} 小时 ${minutes} 分钟)`;
    }
    console.log(`状态: ${status}`);

    console.log("\n出价信息:");
    console.log("----------------------------------------");
    if (auction.highestBidder === ethers.ZeroAddress) {
      console.log("  暂无出价");
    } else {
      console.log(`  最高出价者: ${auction.highestBidder}`);
      if (auction.highestBidToken === ethers.ZeroAddress) {
        console.log(`  最高出价: ${ethers.formatEther(auction.highestBid)} ETH`);
      } else {
        // 尝试获取代币信息
        try {
          const ERC20_ABI = ["function decimals() view returns (uint8)", "function symbol() view returns (string)"];
          const token = await ethers.getContractAt(ERC20_ABI, auction.highestBidToken);
          const decimals = await token.decimals();
          const symbol = await token.symbol().catch(() => "Unknown");
          console.log(`  最高出价: ${ethers.formatUnits(auction.highestBid, decimals)} ${symbol}`);
        } catch {
          console.log(`  最高出价: ${auction.highestBid.toString()} 代币`);
        }
      }
      console.log(`  最高出价价值: $${Number(auction.highestBidValue) / 1e8} USD`);
    }
    console.log("----------------------------------------\n");

    // 计算最低出价要求
    const minBidValue = auction.highestBidValue === 0n ? auction.startPrice : auction.highestBidValue;
    console.log(`💰 最低出价要求: $${Number(minBidValue) / 1e8} USD\n`);

  } catch (error) {
    if (error.reason && error.reason.includes("does not exist")) {
      console.error(`❌ 拍卖 #${auctionId} 不存在`);
    } else {
      console.error("❌ 获取拍卖信息失败:");
      console.error(error.message);
    }
    process.exit(1);
  }

  console.log("==========================================");
  console.log("✅ 操作完成");
  console.log("==========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

