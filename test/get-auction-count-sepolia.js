const { ethers, network } = require("hardhat");

/**
 * V1 版本测试：获取 Sepolia 测试网上的拍卖总数
 * 
 * 此脚本用于测试 MyAuction V1 版本的拍卖查询功能
 * 可以获取合约中创建的拍卖总数，并列出所有拍卖的基本信息
 * 
 * 使用方法：
 * npx hardhat run test/get-auction-count-sepolia.js --network sepolia
 */
async function main() {
  // 检查网络
  if (network.name !== "sepolia") {
    console.error("❌ 此脚本只能在 Sepolia 测试网上运行");
    console.log("请使用: npx hardhat run test/get-auction-count-sepolia.js --network sepolia");
    process.exit(1);
  }

  // 加载部署信息
  let myAuctionAddress, myNFTAddress;
  try {
    const auctionDeploy = require("../deployments/sepolia/MyAuction.json");
    const nftDeploy = require("../deployments/sepolia/MyNFT.json");
    myAuctionAddress = auctionDeploy.address;
    myNFTAddress = nftDeploy.address;
  } catch (error) {
    console.error("❌ 无法加载部署信息，请确保合约已部署到 Sepolia 测试网");
    console.error("错误:", error.message);
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("==========================================");
  console.log("V1 版本测试：获取拍卖总数 (Sepolia 测试网)");
  console.log("==========================================");
  console.log(`网络: ${network.name}`);
  console.log(`账户: ${signerAddress}`);
  console.log(`MyAuction 地址: ${myAuctionAddress}`);
  console.log(`MyNFT 地址: ${myNFTAddress}`);
  console.log("==========================================\n");

  // 连接合约
  const MyAuction = await ethers.getContractFactory("MyAuction");
  const myAuction = await ethers.getContractAt("MyAuction", myAuctionAddress);

  // 获取拍卖总数
  console.log("📊 获取拍卖总数...\n");

  try {
    const count = await myAuction.getAuctionCount();
    console.log(`✅ 当前共有 ${count.toString()} 个拍卖\n`);

    if (count > 0n) {
      console.log("拍卖列表:");
      console.log("----------------------------------------");
      for (let i = 0; i < Number(count); i++) {
        const auction = await myAuction.getAuction(i);
        const status = auction.ended ? "已结束" :
          (BigInt(Math.floor(Date.now() / 1000)) < auction.startTime ? "未开始" : "进行中");
        console.log(`  拍卖 #${i}: ${status}`);
        if (auction.highestBidder !== ethers.ZeroAddress) {
          console.log(`    最高出价者: ${auction.highestBidder}`);
          if (auction.highestBidToken === ethers.ZeroAddress) {
            console.log(`    最高出价: ${ethers.formatEther(auction.highestBid)} ETH`);
          } else {
            try {
              const ERC20_ABI = ["function decimals() view returns (uint8)", "function symbol() view returns (string)"];
              const token = await ethers.getContractAt(ERC20_ABI, auction.highestBidToken);
              const decimals = await token.decimals();
              const symbol = await token.symbol().catch(() => "Unknown");
              console.log(`    最高出价: ${ethers.formatUnits(auction.highestBid, decimals)} ${symbol}`);
            } catch {
              console.log(`    最高出价: ${auction.highestBid.toString()} 代币`);
            }
          }
          console.log(`    最高出价价值: $${Number(auction.highestBidValue) / 1e8} USD`);
        }
      }
      console.log("----------------------------------------\n");
    }
  } catch (error) {
    console.error("❌ 获取拍卖总数失败:");
    console.error(error.message);
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

