# Sepolia 测试网部署指南

本文档详细说明如何将 MyNFT 和 MyAuction 合约部署到 Sepolia 测试网。

## 📋 前置准备

### 1. 环境要求
- Node.js 已安装
- 已安装项目依赖：`npm install`
- 拥有 Sepolia 测试网 ETH（用于支付 gas 费用）

### 2. 网络配置
项目已配置 Sepolia 测试网，配置文件位于 `hardhat.config.js`：
- **Chain ID**: 11155111
- **RPC URL**: 已配置
- **账户**: 使用配置的私钥或环境变量 `PRIVATE_KEY`

### 3. 部署顺序
部署必须按以下顺序进行：
1. 部署 MyNFT 合约
2. 铸造 NFT（Mint NFT）
3. 部署 MyAuction 合约（透明代理模式）
4. 创建拍卖

---

## 🚀 部署步骤

### 步骤 1: 编译合约

**命令：**
```bash
npm run compile
```

**作用：**
- 编译所有 Solidity 合约文件
- 检查语法错误和编译错误
- 生成 ABI 和字节码

**预期输出：**
```
Compiled 3 Solidity files successfully
```

**说明：**
- 编译成功后会在 `artifacts/` 目录生成合约的 ABI 和字节码
- 如果编译失败，需要先修复错误

---

### 步骤 2: 部署 MyNFT 合约

**命令：**
```bash
npm run deploy:mynft:sepolia
```

**作用：**
- 部署 `MyNFT` ERC721 合约到 Sepolia 测试网
- 设置合约参数：名称、符号、最大供应量、初始所有者

**执行过程：**
1. 连接到 Sepolia 测试网
2. 使用配置的账户作为部署者
3. 部署 MyNFT 合约，传入参数：
   - `name`: "MyNFT"
   - `symbol`: "MNFT"
   - `maxSupply`: 10000
   - `initialOwner`: deployer 地址
4. 等待交易确认
5. 保存部署信息到 `deployments/sepolia/MyNFT.json`

**预期输出：**
```
----------------------------------------------------
Deploying MyNFT contract...
Deployer: 0x...
Chain ID: 11155111
deploying "MyNFT" (tx: 0x...) ...: deployed at 0x... with X block confirmations
MyNFT contract deployed at: 0x...
NFT Name: MyNFT
NFT Symbol: MNFT
Max Supply: 10000
----------------------------------------------------
```

**重要信息：**
- 记录下 `MyNFT contract deployed at:` 后面的地址，这是 NFT 合约地址
- 部署信息会保存在 `deployments/sepolia/MyNFT.json`

---

### 步骤 3: 铸造 NFT

**命令：**
```bash
npm run mint:sepolia
```

**作用：**
- 调用已部署的 MyNFT 合约的 `mint` 函数
- 为部署者地址铸造一个 NFT
- 设置 NFT 的元数据 URI

**执行过程：**
1. 获取已部署的 MyNFT 合约地址
2. 检查部署者的 NFT 余额
3. 调用 `mint(deployer, tokenURI)` 函数
4. 等待交易确认
5. 验证余额变化和总供应量

**预期输出：**
```
----------------------------------------------------
Minting NFT...
Deployer: 0x...
Chain ID: 11155111
Balance before minting: 0
Minting NFT with URI: https://ipfs.io/ipfs/...
deploying "MyNFT" (tx: 0x...) ...: deployed at 0x... with X block confirmations
Balance after minting: 1
Total Supply: 1
✅ NFT minted successfully
----------------------------------------------------
```

**重要信息：**
- NFT 的 `tokenId` 从 1 开始递增
- 第一个铸造的 NFT 的 `tokenId` 为 1
- 如果需要指定特定的 `tokenId`，需要修改 mint 脚本

---

### 步骤 4: 部署 MyAuction 合约

**命令：**
```bash
# 不指定 tokenId（自动查找第一个属于 deployer 的 NFT）
npm run deploy:myauction:sepolia

# 或指定 tokenId
npm run deploy:myauction:sepolia --token-id=1
```

**作用：**
- 使用透明代理模式部署可升级的 MyAuction 合约
- 配置 Chainlink 价格预言机（ETH/USD 和 USDC/USD）
- 授权 NFT 给代理合约
- 创建拍卖

**执行过程：**

#### 4.1 部署代理合约
1. 获取签名者对象
2. 使用 `upgrades.deployProxy` 部署透明代理
3. 获取并记录以下地址：
   - **Proxy Address**: 代理合约地址（用户交互的地址）
   - **Implementation Address**: 实现合约地址（业务逻辑）
   - **ProxyAdmin Address**: 代理管理员地址（升级权限）

**预期输出（部署部分）：**
```
----------------------------------------------------
Deploying MyAuction contract (Upgradeable)...
deploying "MyAuction" (tx: 0x...) ...: deployed at 0x... with X block confirmations
MyAuction proxy deployed at: 0x...
MyAuction implementation deployed at: 0x...
ProxyAdmin deployed at: 0x...
Contract is upgradeable using Transparent Proxy pattern
----------------------------------------------------
Deployment Summary:
  MyAuction Proxy: 0x...
  MyAuction Implementation: 0x...
  ProxyAdmin: 0x...
----------------------------------------------------
```

#### 4.2 配置 Chainlink 价格预言机（仅 Sepolia 网络）
1. 设置 ETH/USD 价格源：`0x694AA1769357215DE4FAC081bf1f309aDC325306`
2. 设置 USDC/USD 价格源：`0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E`
3. 设置 USDC 代币地址：`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

**预期输出（价格源配置部分）：**
```
Setting up Chainlink price feeds for Sepolia testnet...
Setting ETH/USD price feed...
  ETH/USD Feed: 0x694AA1769357215DE4FAC081bf1f309aDC325306
Setting USDC/USD price feed...
  USDC Token: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
  USDC/USD Feed: 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E
Price feeds configured successfully
----------------------------------------------------
```

#### 4.3 查找和授权 NFT
1. 检查部署者的 NFT 余额
2. 如果指定了 `--token-id` 参数，使用指定的 tokenId
3. 如果未指定，自动查找第一个属于 deployer 的 NFT
4. 调用 MyNFT 合约的 `approve` 函数，授权代理合约地址可以转移该 NFT

**预期输出（NFT 授权部分）：**
```
NFT Balance: 1
----------------------------------------------------
No TOKEN_ID specified, searching for deployer's NFT...
Found Token ID: 1
Token ID to auction: 1
Approving NFT to proxy contract...
  NFT Contract: 0x...
  Proxy Address: 0x...
  Token ID: 1
NFT approved to proxy: 0x...
Authorization verified
----------------------------------------------------
```

**重要说明：**
- NFT 必须授权给**代理合约地址**，不是实现合约地址
- 授权后，代理合约可以代表所有者转移 NFT
- 如果授权失败，后续的 `createAuction` 会失败

#### 4.4 创建拍卖
1. 调用代理合约的 `createAuction` 函数
2. 传入参数：
   - `nftAddress`: MyNFT 合约地址
   - `tokenId`: 要拍卖的 NFT tokenId
   - `startPrice`: 起始价格（美元价值，8位小数，例如 $100 = 10000000000）
   - `startTime`: 拍卖开始时间（当前时间戳）
   - `endTime`: 拍卖结束时间（7天后）

**预期输出（创建拍卖部分）：**
```
Creating auction...
✅ Auction created successfully
  NFT Address: 0x...
  Token ID: 1
  Start Price: $100 USD
  Start Time: 2024/1/1 12:00:00
  End Time: 2024/1/8 12:00:00
----------------------------------------------------
```

**完整输出示例：**
```
----------------------------------------------------
Deploying MyAuction contract (Upgradeable)...
MyAuction proxy deployed at: 0x...
MyAuction implementation deployed at: 0x...
ProxyAdmin deployed at: 0x...
Contract is upgradeable using Transparent Proxy pattern
----------------------------------------------------
Deployment Summary:
  MyAuction Proxy: 0x...
  MyAuction Implementation: 0x...
  ProxyAdmin: 0x...
----------------------------------------------------
Setting up Chainlink price feeds for Sepolia testnet...
Setting ETH/USD price feed...
  ETH/USD Feed: 0x694AA1769357215DE4FAC081bf1f309aDC325306
Setting USDC/USD price feed...
  USDC Token: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
  USDC/USD Feed: 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E
Price feeds configured successfully
----------------------------------------------------
NFT Balance: 1
----------------------------------------------------
No TOKEN_ID specified, searching for deployer's NFT...
Found Token ID: 1
Token ID to auction: 1
Approving NFT to proxy contract...
  NFT Contract: 0x...
  Proxy Address: 0x...
  Token ID: 1
NFT approved to proxy: 0x...
Authorization verified
----------------------------------------------------
Creating auction...
✅ Auction created successfully
  NFT Address: 0x...
  Token ID: 1
  Start Price: $100 USD
  Start Time: 2024/1/1 12:00:00
  End Time: 2024/1/8 12:00:00
----------------------------------------------------
```

---

## 📝 部署信息记录

部署完成后，所有信息会保存在 `deployments/sepolia/` 目录下：

- `MyNFT.json`: MyNFT 合约地址、ABI、部署参数
- `MyAuction.json`: MyAuction 代理合约地址、ABI

**重要地址记录：**
- **MyNFT 合约地址**: `0x...` (用于查看 NFT 信息)
- **MyAuction 代理地址**: `0x...` (用于交互，出价、结束拍卖等)
- **MyAuction 实现地址**: `0x...` (仅用于升级)
- **ProxyAdmin 地址**: `0x...` (用于管理代理升级)

---

## 🔍 验证部署

### 1. 查看 NFT 信息
```bash
# 使用 Hardhat Console
npx hardhat console --network sepolia

# 在 console 中
const MyNFT = await ethers.getContractAt("MyNFT", "0x..."); // MyNFT 地址
const owner = await MyNFT.ownerOf(1);
const tokenURI = await MyNFT.tokenURI(1);
console.log("Owner:", owner);
console.log("Token URI:", tokenURI);
```

### 2. 查看拍卖信息
```bash
npx hardhat console --network sepolia

# 在 console 中
const MyAuction = await ethers.getContractAt("MyAuction", "0x..."); // 代理地址
const auction = await MyAuction.getAuction(0);
console.log("Auction:", auction);
```

---

## ⚠️ 常见问题

### 1. Gas 费用不足
**错误信息：** `insufficient funds for gas`
**解决方法：** 确保账户有足够的 Sepolia ETH

### 2. NFT 授权失败
**错误信息：** `NFT authorization failed`
**解决方法：** 
- 确保 NFT 属于 deployer
- 确保授权给代理合约地址，不是实现地址
- 检查 tokenId 是否正确

### 3. 价格预言机未设置
**错误信息：** `Price feed not set for this token`
**解决方法：** 确保在 Sepolia 网络上部署，脚本会自动配置价格源

### 4. TokenId 未找到
**错误信息：** `No NFT found for deployer`
**解决方法：**
- 先执行 `npm run mint:sepolia` 铸造 NFT
- 或使用 `--token-id=1` 指定已存在的 tokenId

---

## 📚 相关命令总结

```bash
# 编译合约
npm run compile

# 部署到 Sepolia（按顺序执行）
npm run deploy:mynft:sepolia      # 1. 部署 NFT 合约
npm run mint:sepolia               # 2. 铸造 NFT
npm run deploy:myauction:sepolia   # 3. 部署拍卖合约（自动查找 NFT）
npm run deploy:myauction:sepolia --token-id=1  # 指定 tokenId

# 重置部署（删除部署记录并重新部署）
npm run deploy:reset --network sepolia

# 查看部署信息
cat deployments/sepolia/MyNFT.json
cat deployments/sepolia/MyAuction.json
```

---

## 🎯 部署流程图

```
开始
  ↓
编译合约 (npm run compile)
  ↓
部署 MyNFT (npm run deploy:mynft:sepolia)
  ↓
铸造 NFT (npm run mint:sepolia)
  ↓
部署 MyAuction (npm run deploy:myauction:sepolia)
  ├─ 部署代理合约
  ├─ 配置 Chainlink 价格源
  ├─ 授权 NFT 给代理
  └─ 创建拍卖
  ↓
完成 ✅
```

---

## 📌 注意事项

1. **部署顺序很重要**：必须先部署 NFT，再铸造，最后部署拍卖合约
2. **代理地址 vs 实现地址**：用户交互时使用代理地址，升级时使用实现地址
3. **NFT 授权**：必须授权给代理合约地址，不是实现地址
4. **价格预言机**：仅在 Sepolia 网络自动配置，其他网络需要手动配置
5. **Gas 费用**：确保账户有足够的 Sepolia ETH 支付 gas 费用
6. **TokenId 参数**：可以使用 `--token-id=1` 指定要拍卖的 NFT

---

## 🔗 相关链接

- [Sepolia 测试网浏览器](https://sepolia.etherscan.io/)
- [Chainlink 价格源文档](https://docs.chain.link/data-feeds/price-feeds)
- [OpenZeppelin 透明代理文档](https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies#transparent-proxies)

