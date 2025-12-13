const fs = require("fs");
const path = require("path");

/**
 * 检查 MyAuction 和 MyAuctionV2 的字节码差异
 */
async function main() {
  console.log("==========================================");
  console.log("字节码差异检查");
  console.log("==========================================\n");

  // 读取编译后的合约文件
  const myAuctionPath = path.join(__dirname, "../artifacts/contracts/MyAuction.sol/MyAuction.json");
  const myAuctionV2Path = path.join(__dirname, "../artifacts/contracts/MyAuctionV2.sol/MyAuctionV2.json");

  let myAuctionBytecode, myAuctionV2Bytecode;

  try {
    const myAuction = JSON.parse(fs.readFileSync(myAuctionPath, "utf8"));
    myAuctionBytecode = myAuction.bytecode;
    console.log("✅ 成功读取 MyAuction 字节码");
    console.log(`   长度: ${myAuctionBytecode.length} 字符\n`);
  } catch (error) {
    console.error("❌ 无法读取 MyAuction 字节码:");
    console.error(`   路径: ${myAuctionPath}`);
    console.error(`   错误: ${error.message}`);
    console.log("\n请先运行: npm run compile");
    process.exit(1);
  }

  try {
    const myAuctionV2 = JSON.parse(fs.readFileSync(myAuctionV2Path, "utf8"));
    myAuctionV2Bytecode = myAuctionV2.bytecode;
    console.log("✅ 成功读取 MyAuctionV2 字节码");
    console.log(`   长度: ${myAuctionV2Bytecode.length} 字符\n`);
  } catch (error) {
    console.error("❌ 无法读取 MyAuctionV2 字节码:");
    console.error(`   路径: ${myAuctionV2Path}`);
    console.error(`   错误: ${error.message}`);
    console.log("\n请先运行: npm run compile");
    process.exit(1);
  }

  // 比较字节码
  console.log("==========================================");
  console.log("字节码比较结果");
  console.log("==========================================\n");

  if (myAuctionBytecode === myAuctionV2Bytecode) {
    console.log("⚠️  警告: 两个合约的字节码完全相同！");
    console.log("\n这解释了为什么实现地址没有改变。");
    console.log("\n可能的原因：");
    console.log("1. 编译器优化：新增的代码被优化掉了");
    console.log("2. 新增的变量/函数没有被实际使用");
    console.log("3. OpenZeppelin 检测到字节码相同，重用了实现地址");
    console.log("\n解决方案：");
    console.log("1. 确保 V2 合约有实际的功能变化");
    console.log("2. 在 V2 中添加一些不会被优化掉的代码");
    console.log("3. 检查编译器优化设置");
  } else {
    console.log("✅ 两个合约的字节码不同");
    const diff = Math.abs(myAuctionBytecode.length - myAuctionV2Bytecode.length);
    console.log(`   字节码长度差异: ${diff} 字符`);
    
    // 计算相似度
    let sameChars = 0;
    const minLength = Math.min(myAuctionBytecode.length, myAuctionV2Bytecode.length);
    for (let i = 0; i < minLength; i++) {
      if (myAuctionBytecode[i] === myAuctionV2Bytecode[i]) {
        sameChars++;
      }
    }
    const similarity = (sameChars / minLength * 100).toFixed(2);
    console.log(`   相似度: ${similarity}%`);
    
    if (similarity > 99) {
      console.log("\n⚠️  警告: 字节码高度相似（>99%）");
      console.log("OpenZeppelin 可能认为这是相同的实现");
    }
  }

  // 检查部署字节码（runtime bytecode）
  try {
    const myAuction = JSON.parse(fs.readFileSync(myAuctionPath, "utf8"));
    const myAuctionV2 = JSON.parse(fs.readFileSync(myAuctionV2Path, "utf8"));
    
    const myAuctionDeployed = myAuction.deployedBytecode;
    const myAuctionV2Deployed = myAuctionV2.deployedBytecode;

    console.log("\n==========================================");
    console.log("部署字节码比较（deployedBytecode）");
    console.log("==========================================\n");

    if (myAuctionDeployed === myAuctionV2Deployed) {
      console.log("⚠️  警告: 两个合约的部署字节码完全相同！");
      console.log("这是实现地址没有改变的直接原因。");
    } else {
      console.log("✅ 两个合约的部署字节码不同");
      const diff = Math.abs(myAuctionDeployed.length - myAuctionV2Deployed.length);
      console.log(`   部署字节码长度差异: ${diff} 字符`);
    }
  } catch (error) {
    console.log("⚠️  无法比较部署字节码");
  }

  console.log("\n==========================================");
  console.log("检查完成");
  console.log("==========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

