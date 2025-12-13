// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MyAuction is Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    // 代币到 Chainlink 价格预言机的映射
    // address(0) 表示 ETH，需要 ETH/USD 预言机地址
    // 其他地址表示 ERC20 代币，需要对应的代币/USD 预言机地址
    mapping(address => address) public priceFeeds; // 代币地址 => Chainlink 预言机地址

    struct Auction {
        address nftAddress;
        uint256 tokenId;
        address seller; // 拍卖创建者（NFT 原所有者）
        address highestBidder;
        address highestBidToken; // 最高出价使用的代币类型
        uint256 highestBid; // 最高出价的实际金额（原始代币数量）
        uint256 highestBidValue; // 最高出价的统一价值（换算成美元价值，8位小数）
        uint256 startPrice; // 起始价格（美元价值，8位小数，例如：$1000 = 100000000000）
        uint256 startTime;
        uint256 endTime;
        bool ended;
    }

    Auction[] public auctions;

    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount, address indexed paymentToken);
    event AuctionEnded(uint256 indexed auctionId, address indexed winner, uint256 finalBid, address indexed seller, address paymentToken);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 初始化函数，替代构造函数
     */
    function initialize() public initializer {
        __Ownable_init(msg.sender);
    }

    /**
     * @dev 设置代币的价格预言机地址
     * @param _token 代币地址，address(0) 表示 ETH
     * @param _priceFeed Chainlink 价格预言机地址（例如：ETH/USD 或 USDC/USD）
     */
    function setPriceFeed(address _token, address _priceFeed) public onlyOwner {
        require(_priceFeed != address(0), "Invalid price feed address");
        priceFeeds[_token] = _priceFeed;
    }

    /**
     * @dev 批量设置代币价格预言机地址
     * @param _tokens 代币地址数组
     * @param _priceFeeds 价格预言机地址数组
     */
    function setPriceFeeds(address[] memory _tokens, address[] memory _priceFeeds) public onlyOwner {
        require(_tokens.length == _priceFeeds.length, "Arrays length mismatch");
        for (uint256 i = 0; i < _tokens.length; i++) {
            require(_priceFeeds[i] != address(0), "Invalid price feed address");
            priceFeeds[_tokens[i]] = _priceFeeds[i];
        }
    }

    /**
     * @dev 从 Chainlink 预言机获取代币的美元价格
     * @param _token 代币地址，address(0) 表示 ETH
     * @return price 美元价格（8位小数，例如：$3000 = 300000000000）
     * @return decimals 价格精度（Chainlink 通常是 8）
     */
    function getTokenPrice(address _token) public view returns (uint256 price, uint8 decimals) {
        address priceFeed = priceFeeds[_token];
        require(priceFeed != address(0), "Price feed not set");
        
        AggregatorV3Interface oracle = AggregatorV3Interface(priceFeed);
        (, int256 priceInt, , , ) = oracle.latestRoundData();
        require(priceInt > 0, "Invalid price");
        
        decimals = oracle.decimals();
        price = uint256(priceInt);
    }

    /**
     * @dev 将代币数量换算成美元价值
     * @param _token 代币地址，address(0) 表示 ETH
     * @param _amount 代币数量（原始精度，例如：ETH 是 18 位，USDC 是 6 位）
     * @return usdValue 美元价值（8位小数，Chainlink 标准）
     */
    function convertToUSDValue(address _token, uint256 _amount) public view returns (uint256) {
        (uint256 price, ) = getTokenPrice(_token);
        
        // 获取代币精度
        uint8 tokenDecimals;
        if (_token == address(0)) {
            // ETH 是 18 位小数
            tokenDecimals = 18;
        } else {
            // ERC20 代币，尝试获取 decimals（如果失败则假设 18）
            try IERC20Metadata(_token).decimals() returns (uint8 dec) {
                tokenDecimals = dec;
            } catch {
                tokenDecimals = 18; // 默认 18 位
            }
        }
        
        // 计算美元价值
        // Chainlink 价格是 8 位小数
        // 公式：usdValue = (amount * price) / (10^tokenDecimals)
        // 结果已经是 8 位小数（因为 price 是 8 位小数）
        
        // 例如：
        // - 1 ETH (1e18) * $3000 (300000000000, 8位) / 1e18 = 300000000000 (8位，即 $3000)
        // - 1000 USDC (1000e6) * $1 (100000000, 8位) / 1e6 = 100000000000 (8位，即 $1000)
        
        return (_amount * price) / (10 ** uint256(tokenDecimals));
    }

    /**
     * @dev 创建拍卖（支持 ETH 和 ERC20 代币出价）
     * @param _nftAddress NFT 合约地址
     * @param _tokenId NFT token ID
     * @param _startPrice 起始价格（美元价值，8位小数，例如：$1000 = 100000000000）
     * @param _startTime 开始时间
     * @param _endTime 结束时间
     */
    function createAuction(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _startPrice,
        uint256 _startTime,
        uint256 _endTime
    ) public onlyOwner {
        require(_startTime < _endTime, "Start time must be before end time");
        require(_startPrice > 0, "Start price must be greater than 0");
        
        IERC721 nft = IERC721(_nftAddress);
        require(nft.ownerOf(_tokenId) == msg.sender, "You must own the NFT");
        
        // 将 NFT 转移到合约（需要先授权）
        // 注意：在代理模式下，address(this) 指向的是代理合约地址，不是实现合约地址
        // 用户需要先调用 NFT 合约的 approve(proxyAddress, tokenId) 授权给代理合约
        // 代理合约地址是用户交互的地址，所有状态（包括 NFT）都存储在代理合约中
        nft.transferFrom(msg.sender, address(this), _tokenId);
        
        auctions.push(Auction({
            nftAddress: _nftAddress,
            tokenId: _tokenId,
            seller: msg.sender,
            highestBidder: address(0),
            highestBidToken: address(0),
            highestBid: 0,
            highestBidValue: 0,
            startPrice: _startPrice,
            startTime: _startTime,
            endTime: _endTime,
            ended: false
        }));
    }

    /**
     * @dev 对拍卖进行出价（支持 ETH 和 ERC20 代币，统一价值比较）
     * @param _auctionId 拍卖索引
     * @param _amount 出价金额（代币原始数量）
     * @param _token 支付代币地址：address(0) 表示 ETH，非零地址表示 ERC20 代币
     */
    function bid(uint256 _auctionId, uint256 _amount, address _token) public payable {
        require(_auctionId < auctions.length, "Auction does not exist");
        
        Auction storage auction = auctions[_auctionId];
        require(!auction.ended, "Auction has ended");
        require(block.timestamp >= auction.startTime, "Auction has not started");
        require(block.timestamp <= auction.endTime, "Auction has ended");
        require(_amount > 0, "Bid amount must be greater than 0");
        require(priceFeeds[_token] != address(0), "Price feed not set for token");
        
        // 将出价换算成美元价值（统一价值单位，8位小数）
        uint256 bidValue = convertToUSDValue(_token, _amount);
        
        // 检查出价是否满足最低要求（使用统一价值比较）
        uint256 minBidValue = auction.highestBidValue == 0 ? auction.startPrice : auction.highestBidValue;
        require(bidValue > minBidValue, "Bid value must be greater than the minimum required value");
        
        // 根据支付代币类型处理
        if (_token == address(0)) {
            // ETH 出价
            require(msg.value == _amount, "ETH amount must match bid amount");
        } else { 
            // ERC20 代币出价
            require(msg.value == 0, "Cannot send ETH for ERC20 bid");
            IERC20 token = IERC20(_token);
            require(token.allowance(msg.sender, address(this)) >= _amount, "Insufficient token allowance");
            require(token.balanceOf(msg.sender) >= _amount, "Insufficient token balance");
            
            // 转移代币到合约
            token.safeTransferFrom(msg.sender, address(this), _amount);
        }
        
        // 如果之前有出价者，退还之前的出价（使用原始代币类型和数量）
        if (auction.highestBidder != address(0)) {
            if (auction.highestBidToken == address(0)) {
                // 退还 ETH
                (bool success, ) = payable(auction.highestBidder).call{value: auction.highestBid}("");
                require(success, "Failed to refund previous bidder");
            } else {
                // 退还 ERC20 代币
                IERC20 token = IERC20(auction.highestBidToken);
                token.safeTransfer(auction.highestBidder, auction.highestBid);
            }
        }
        
        // 更新最高出价和出价者
        auction.highestBidder = msg.sender;
        auction.highestBidToken = _token;
        auction.highestBid = _amount;
        auction.highestBidValue = bidValue;
        
        emit BidPlaced(_auctionId, msg.sender, _amount, _token);
    }

    /**
     * @dev 结束拍卖并领取NFT
     * @param _auctionId 拍卖索引
     */
    function endAuctionAndClaimNFT(uint256 _auctionId) public onlyOwner {
        require(_auctionId < auctions.length, "Auction does not exist");
        
        Auction storage auction = auctions[_auctionId];
        require(!auction.ended, "Auction has already ended");
        require(block.timestamp >= auction.endTime || msg.sender == auction.seller, "Auction has not ended yet or you are not the seller");
        
        auction.ended = true;
        
        IERC721 nft = IERC721(auction.nftAddress);
        
        if (auction.highestBidder != address(0)) {
            // 有出价者：将 NFT 转移给最高出价者，将资金转移给卖家
            nft.transferFrom(address(this), auction.highestBidder, auction.tokenId);
            
            // 根据支付代币类型转移资金（使用最高出价者实际使用的代币）
            if (auction.highestBidToken == address(0)) {
                // 转移 ETH 给卖家
                (bool success, ) = payable(auction.seller).call{value: auction.highestBid}("");
                require(success, "Failed to transfer funds to seller");
            } else {
                // 转移 ERC20 代币给卖家
                IERC20 token = IERC20(auction.highestBidToken);
                token.safeTransfer(auction.seller, auction.highestBid);
            }
            
            emit AuctionEnded(_auctionId, auction.highestBidder, auction.highestBid, auction.seller, auction.highestBidToken);
        } else {
            // 没有出价者：将 NFT 归还给卖家
            nft.transferFrom(address(this), auction.seller, auction.tokenId);
            
            emit AuctionEnded(_auctionId, address(0), 0, auction.seller, address(0));
        }
    }

    // 获取单个拍卖
    function getAuction(uint256 _auctionId) public view returns (Auction memory) {
        return auctions[_auctionId];
    }
    // 获取所有的拍卖
    function getAuctions() public view returns (Auction[] memory) {
        return auctions;
    }
    // 获取总共的拍卖数
    function getAuctionCount() public view returns (uint256) {
        return auctions.length;
    }
}