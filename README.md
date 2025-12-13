# MyAuction NFT 拍卖平台

MyAuction 是一个基于以太坊的去中心化 NFT 拍卖平台，支持使用 ETH 或 ERC20 代币进行出价。项目采用透明代理模式实现合约升级功能，并集成了 Chainlink 价格预言机来实现多币种出价的统一价值比较。

## 📚 项目文档

所有项目文档位于 `docs/` 目录：

- **[项目总结报告](./docs/PROJECT_SUMMARY.md)** - 完整的项目总结，包括部署、升级、功能实现和测试结果
- **[测试报告](./docs/TEST_REPORT.md)** - 详细的测试结果和验证数据
- **[测试总结](./docs/TEST_SUMMARY.md)** - 测试用例说明和执行指南
- **[部署文档](./docs/DEPLOYMENT.md)** - 详细的部署说明和步骤
- **[Sepolia 部署文档](./docs/DEPLOYMENT_SEPOLIA.md)** - Sepolia 测试网部署指南
- **[升级分析](./docs/UPGRADE_ANALYSIS.md)** - 合约升级机制分析

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

1. 复制环境变量示例文件：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入你的敏感信息：
```bash
# Sepolia 测试网 RPC URL
SEPOLIA_RPC_URL=https://your-rpc-url-here

# 部署账户的私钥（不带 0x 前缀）
PRIVATE_KEY=your-private-key-here
```

**⚠️ 重要提示**：
- `.env` 文件已添加到 `.gitignore`，不会被提交到版本控制系统
- 请勿将包含真实私钥的 `.env` 文件提交到 Git
- 如果使用公共 RPC，可以不设置 `SEPOLIA_RPC_URL`，将使用默认的公共 RPC

### 编译合约

```bash
npm run compile
```

### 部署到 Sepolia 测试网

```bash
# 部署 NFT 合约
npm run deploy:mynft:sepolia

# 铸造 NFT
npm run mint:sepolia

# 部署拍卖合约
npm run deploy:myauction:sepolia

# 升级到 V2
npm run upgrade:v2:sepolia
```

## 📦 项目结构

```
my-auction/
├── contracts/          # 智能合约源码
│   ├── MyNFT.sol      # NFT 合约
│   ├── MyAuction.sol  # 拍卖合约 V1
│   └── MyAuctionV2.sol # 拍卖合约 V2
├── deploy/             # 部署脚本
├── test/               # 测试脚本
├── docs/               # 项目文档
│   ├── images/        # 文档图片
│   ├── PROJECT_SUMMARY.md
│   ├── TEST_REPORT.md
│   ├── TEST_SUMMARY.md
│   ├── DEPLOYMENT.md
│   └── ...
└── package.json
```

## 🎯 核心功能

- ✅ NFT 拍卖创建和管理
- ✅ 多币种出价（ETH/ERC20）
- ✅ Chainlink 价格预言机集成
- ✅ 透明代理升级机制
- ✅ 动态手续费系统
- ✅ 紧急暂停功能
- ✅ 统计和批量查询

## 📝 测试

### V1 基础功能测试

```bash
# 获取拍卖总数
npx hardhat run test/get-auction-count-sepolia.js --network sepolia

# 获取拍卖详情
npx hardhat run test/get-auction-sepolia.js --network sepolia

# 出价
npx hardhat run test/bid-sepolia.js --network sepolia
```

### V2 功能测试

```bash
# 统计信息
npm run test:v2:stats

# 动态手续费
npm run test:v2:dynamic-fee

# 强制结束拍卖
npm run test:v2:force-end
```

## 🔗 相关链接

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Chainlink Price Feeds](https://docs.chain.link/data-feeds/price-feeds)

## 📄 License

MIT
