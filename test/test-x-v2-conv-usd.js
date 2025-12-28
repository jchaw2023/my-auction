async function main() {

    // 检查网络
       if (network.name !== "sepolia") {
           console.error("❌ 此脚本只能在 Sepolia 测试网上运行");
           console.log("请使用: npx hardhat run test/test-x-v1-create-auction-sepolia.js --network sepolia");
           process.exit(1);
       }
   
       // 加载部署信息
       let myXAuctionAddress;
       try {
           const xAuctionDeploy = require("../deployments/sepolia/MyXAuctionV2.json");
           myXAuctionAddress = xAuctionDeploy.address;
       } catch (error) {
           console.error("❌ 无法加载部署信息，请确保合约已部署到 Sepolia 测试网");
           console.error("错误:", error.message);
           process.exit(1);
       }
   
       const [signer] = await ethers.getSigners();
       const signerAddress = await signer.getAddress();
   
       console.log("==========================================");
       console.log("创建 MyXAuction 拍卖测试");
       console.log("==========================================");
       console.log(`网络: ${network.name}`);
       console.log(`账户: ${signerAddress}`);
       console.log(`MyXAuction 地址: ${myXAuctionAddress}`);
     
       console.log("==========================================\n");
   
       // 连接合约（使用 MyXAuction 接口）
       const myXAuction = await ethers.getContractAt("MyXAuctionV2", myXAuctionAddress);
       console.log(await myXAuction.convertToUSDValue(ethers.ZeroAddress, ethers.parseEther("1")));
       console.log("==========================================\n");
   
   }
   main()
       .then(() => process.exit(0))
       .catch((error) => {
           console.error(error);
           process.exit(1);
       });
   