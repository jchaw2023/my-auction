const { ethers, network } = require("hardhat");

/**
 * V1 版本测试：在 Sepolia 测试网上执行出价
 * 
 * 此脚本用于测试 MyAuction V1 版本的出价功能
 * 支持使用 ETH 或 ERC20 代币（如 USDC）进行出价
 * 
 * 使用方法：
 * 
 * ETH 出价:
 *   Windows: set TOKEN=eth && set AMOUNT=0.2 && set AUCTION_ID=0 && npx hardhat run test/bid-sepolia.js --network sepolia
 *   Linux/Mac: TOKEN=eth AMOUNT=0.1 AUCTION_ID=0 npx hardhat run test/bid-sepolia.js --network sepolia
 * 
 * USDC 出价:
 *   Windows: set TOKEN=usdc && set AMOUNT=150 && set AUCTION_ID=0 && npx hardhat run test/bid-sepolia.js --network sepolia
 *   Linux/Mac: TOKEN=usdc AMOUNT=150 AUCTION_ID=0 npx hardhat run test/bid-sepolia.js --network sepolia
 */
async function main() {
    // 检查网络
    if (network.name !== "sepolia") {
        console.error("❌ 此脚本只能在 Sepolia 测试网上运行");
        console.log("请使用: npx hardhat run test/bid-sepolia.js --network sepolia");
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

    // 解析参数
    const tokenArg = (process.env.TOKEN ||
        process.argv.find(arg => arg.toLowerCase().startsWith("token="))?.split("=")[1]);
    const tokenType = tokenArg ? tokenArg.trim().toUpperCase() : null;
    const amountArgRaw = process.env.AMOUNT ||
        process.argv.find(arg => arg.toLowerCase().startsWith("amount="))?.split("=")[1];
    const amountArg = amountArgRaw ? amountArgRaw.trim() : null;
    const bidAuctionIdRaw = process.env.AUCTION_ID ||
        process.argv.find(arg => arg.toLowerCase().startsWith("auction-id="))?.split("=")[1] ||
        "0";
    const bidAuctionId = bidAuctionIdRaw ? bidAuctionIdRaw.trim() : "0";

    if (!tokenType || !amountArg) {
        console.error("❌ 缺少必需参数 TOKEN 和 AMOUNT");
        console.log("\n使用方法:");
        console.log("  Windows: set TOKEN=eth && set AMOUNT=0.1 && set AUCTION_ID=0 && npx hardhat run test/bid-sepolia.js --network sepolia");
        console.log("  Linux/Mac: TOKEN=eth AMOUNT=0.1 AUCTION_ID=0 npx hardhat run test/bid-sepolia.js --network sepolia");
        process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();

    console.log("==========================================");
    console.log("V1 版本测试：执行出价 (Sepolia 测试网)");
    console.log("==========================================");
    console.log(`网络: ${network.name}`);
    console.log(`账户: ${signerAddress}`);
    console.log(`MyAuction 地址: ${myAuctionAddress}`);
    console.log(`MyNFT 地址: ${myNFTAddress}`);
    console.log(`拍卖 ID: ${bidAuctionId}`);
    console.log(`支付代币: ${tokenType}`);
    console.log(`出价金额: ${amountArg}`);
    console.log("==========================================\n");

    // 连接合约
    const myAuction = await ethers.getContractAt("MyAuction", myAuctionAddress);

    // 清理参数
    const cleanAmount = String(amountArg).trim();
    const cleanAuctionId = parseInt(String(bidAuctionId).trim());

    console.log(`🚀 准备出价...\n`);

    // 先获取拍卖信息
    const auction = await myAuction.getAuction(cleanAuctionId);
    const minBidValue = auction.highestBidValue === 0n ? auction.startPrice : auction.highestBidValue;
    console.log(`当前最低出价要求: $${Number(minBidValue) / 1e8} USD\n`);

    let paymentToken;
    let bidAmount;
    let bidValue;

    // 确保 tokenType 是清理后的字符串
    const cleanTokenType = String(tokenType).trim().toUpperCase();

    if (cleanTokenType === "ETH") {
        paymentToken = ethers.ZeroAddress;
        bidAmount = ethers.parseEther(cleanAmount);

        // 使用合约的 convertToUSDValue 函数计算
        bidValue = await myAuction.convertToUSDValue(ethers.ZeroAddress, bidAmount);

        console.log(`💵 出价金额: ${ethers.formatEther(bidAmount)} ETH`);
        console.log(`💵 出价价值: $${Number(bidValue) / 1e8} USD\n`);

        // 检查余额
        const balance = await ethers.provider.getBalance(signerAddress);
        console.log(`账户 ETH 余额: ${ethers.formatEther(balance)} ETH`);
        if (balance < bidAmount) {
            console.error(`❌ ETH 余额不足，需要至少 ${ethers.formatEther(bidAmount)} ETH`);
            process.exit(1);
        }

    } else if (cleanTokenType === "USDC") {
        // Sepolia 测试网 USDC 地址
        const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
        paymentToken = USDC_ADDRESS;
        bidAmount = ethers.parseUnits(cleanAmount, 6); // USDC 是 6 位小数

        // 使用合约的 convertToUSDValue 函数计算
        bidValue = await myAuction.convertToUSDValue(USDC_ADDRESS, bidAmount);

        console.log(`💵 出价金额: ${ethers.formatUnits(bidAmount, 6)} USDC`);
        console.log(`💵 出价价值: $${Number(bidValue) / 1e8} USD\n`);

        // 连接 USDC 合约
        const ERC20_ABI = [
            "function balanceOf(address) view returns (uint256)",
            "function allowance(address,address) view returns (uint256)",
            "function approve(address,uint256) returns (bool)",
            "function decimals() view returns (uint8)"
        ];
        const usdc = await ethers.getContractAt(ERC20_ABI, USDC_ADDRESS);

        // 检查余额
        const balance = await usdc.balanceOf(signerAddress);
        console.log(`账户 USDC 余额: ${ethers.formatUnits(balance, 6)} USDC`);
        if (balance < bidAmount) {
            console.error(`❌ USDC 余额不足，需要至少 ${ethers.formatUnits(bidAmount, 6)} USDC`);
            process.exit(1);
        }

        // 检查授权
        const allowance = await usdc.allowance(signerAddress, myAuctionAddress);
        console.log(`当前授权额度: ${ethers.formatUnits(allowance, 6)} USDC`);
        if (allowance < bidAmount) {
            console.log(`\n⚠️  授权额度不足，正在授权...`);
            const approveTx = await usdc.connect(signer).approve(myAuctionAddress, bidAmount);
            console.log(`  交易哈希: ${approveTx.hash}`);
            await approveTx.wait();
            console.log(`  ✅ 授权成功\n`);
        }

    } else {
        console.error(`❌ 不支持的代币类型: ${tokenType}`);
        console.log("支持的代币类型: ETH, USDC");
        process.exit(1);
    }

    // 验证出价是否满足最低要求
    if (Number(bidValue) <= Number(minBidValue)) {
        console.error(`❌ 出价价值 $${Number(bidValue) / 1e8} 低于最低要求 $${Number(minBidValue) / 1e8}`);
        process.exit(1);
    }

    // 执行出价
    console.log("🚀 执行出价交易...");
    try {
        const txOptions = paymentToken === ethers.ZeroAddress
            ? { value: bidAmount }
            : {};

        const tx = await myAuction.connect(signer).bid(cleanAuctionId, bidAmount, paymentToken, txOptions);
        console.log(`  交易哈希: ${tx.hash}`);
        console.log(`  等待确认...`);

        const receipt = await tx.wait();
        console.log(`  ✅ 出价成功！`);
        console.log(`  区块号: ${receipt.blockNumber}`);
        console.log(`  Gas 使用: ${receipt.gasUsed.toString()}\n`);

        // 获取更新后的拍卖信息
        console.log("📋 更新后的拍卖信息:");
        const updatedAuction = await myAuction.getAuction(cleanAuctionId);
        console.log(`  最高出价者: ${updatedAuction.highestBidder}`);
        if (updatedAuction.highestBidToken === ethers.ZeroAddress) {
            console.log(`  最高出价: ${ethers.formatEther(updatedAuction.highestBid)} ETH`);
        } else {
            const ERC20_ABI = ["function decimals() view returns (uint8)"];
            const token = await ethers.getContractAt(ERC20_ABI, updatedAuction.highestBidToken);
            const decimals = await token.decimals();
            console.log(`  最高出价: ${ethers.formatUnits(updatedAuction.highestBid, decimals)} 代币`);
        }
        console.log(`  最高出价价值: $${Number(updatedAuction.highestBidValue) / 1e8} USD`);

        // 检查事件
        const bidEvent = receipt.logs.find(log => {
            try {
                const parsed = myAuction.interface.parseLog(log);
                return parsed && parsed.name === "BidPlaced";
            } catch {
                return false;
            }
        });

        if (bidEvent) {
            const parsed = myAuction.interface.parseLog(bidEvent);
            console.log(`\n📢 BidPlaced 事件:`);
            console.log(`  拍卖 ID: ${parsed.args.auctionId.toString()}`);
            console.log(`  出价者: ${parsed.args.bidder}`);
            console.log(`  出价金额: ${parsed.args.amount.toString()}`);
            console.log(`  支付代币: ${parsed.args.paymentToken}`);
        }

    } catch (error) {
        console.error("❌ 出价失败:");
        if (error.reason) {
            console.error(`  错误原因: ${error.reason}`);
        } else if (error.message) {
            console.error(`  错误信息: ${error.message}`);
        } else {
            console.error(error);
        }
        process.exit(1);
    }

    console.log("\n==========================================");
    console.log("✅ 操作完成");
    console.log("==========================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

