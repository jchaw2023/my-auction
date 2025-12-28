// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title MyXAuctionV2
 * @dev 拍卖合约（代理合约第一个版本），支持 ETH 和 ERC20 代币出价，使用 Chainlink 价格预言机统一价值比较
 *
 * 主要功能：
 * - 支持 ETH 和 ERC20 代币出价（通过 Chainlink 价格预言机统一价值比较）
 * - 拍卖手续费功能（可配置的手续费比例，支持动态手续费）
 * - 紧急暂停功能
 * - 批量获取拍卖信息的功能
 * - 拍卖统计信息和 TVL 追踪
 *
 * 注意：这是代理合约的第一个版本，使用 OpenZeppelin 可升级合约模式
 */
contract MyXAuctionV2 is Initializable, OwnableUpgradeable,ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // 存储布局（重要：代理合约升级时不能改变现有变量的顺序和类型）
    mapping(address => address) public priceFeeds;

    struct Auction {
        address nftAddress;
        uint256 tokenId;
        address seller;
        address highestBidder;
        address highestBidToken;
        uint256 highestBid; //
        uint256 highestBidValue;
        uint256 startPrice; //美元价值x8因为chainlink价格是8位小数
        uint256 startTime;
        uint256 endTime;
        bool ended;
        bool cancelled;
        uint256 bidCount;
    }

    Auction[] public auctions;

    // 新增的存储变量（只能添加在现有变量之后）
    uint256 public platformFee; // 平台手续费（基点，100 = 1%），用于向后兼容
    bool public paused; // 紧急暂停标志
    uint256 public totalAuctionsCreated; // 总创建的拍卖数
    uint256 public totalBidsPlaced; // 总出价次数
    mapping(uint256 => uint256) public auctionBidCount; // 每个拍卖的出价次数
    uint256 public totalValueLocked; // 总锁定价值（TVL，USD 价值，8位小数）

    // 动态手续费配置（基于 USD 价值）
    struct FeeTier {
        uint256 threshold; // 阈值（USD 价值，8位小数）
        uint256 feeRate; // 手续费率（基点，100 = 1%）
    }
    FeeTier[] public feeTiers; // 手续费档次数组，按阈值从低到高排序
    bool public useDynamicFee; // 是否使用动态手续费
    uint256 public baseFeeRate; // 基础费率（用于低于最低阈值的金额）
    mapping(address => uint256[]) public userCreatedAuctionIds; // 用户创建的拍卖ID列表
    uint256 private constant TIME_BUFFER = 60;
    // ============ 事件声明 ============
    //出价事件成功后触发
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder, //当前出价者地址
        uint256 amount, //支付代币最小单位数量
        address indexed paymentToken, //支付代币地址
        uint256 bidCount, //出价次数
        uint256 timestamp, //出价时间戳
        uint256 bidValue, //出价金额(美元价值x8)
        address minBidder, //上一个高出价者
        uint256 minBidValue //上一个高出价者的平台出价值(美元价值x8)
    );
    //出价金额低于最低出价金额事件
    event BidValueTooLow(
        uint256 indexed auctionId,
        address indexed bidder, //当前出价者地址
        uint256 amount, //支付代币最小单位数量
        address indexed paymentToken, //支付代币地址
        uint256 bidCount, //出价次数
        uint256 timestamp, //出价时间戳
        uint256 bidValue, //当前出价金额(美元价值x8)
        address minBidder, //上一个高出价者地址
        uint256 minBidValue //上一个高出价者的平台出价值(美元价值x8)
    );
    event AuctionEnded(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 finalBid,
        address seller,
        address paymentToken,
        uint256 bidValue,
        uint256 minBidValue
    );
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeTierUpdated(
        uint256 indexed tierIndex,
        uint256 threshold,
        uint256 feeRate
    ); // 动态手续费档次更新事件
    event DynamicFeeEnabled(bool enabled); // 动态手续费启用/禁用事件
    event Paused(address account);
    event Unpaused(address account);
    event AuctionForceEnded(uint256 indexed auctionId, address indexed endedBy); // 强制结束事件
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed creator,
        address indexed nftAddress,
        uint256 tokenId
    ); // 拍卖创建事件
    event TotalValueLockedUpdated(
        uint256 newTVL,
        uint256 totalBidsPlaced,
        uint256 change,
        bool isIncrease
    ); // TVL更新事件
    event AuctionCancelled(
        uint256 indexed auctionId,
        address indexed cancelledBy,
        address bidder,
        address indexed paymentToken,
        uint256 refundAmount,
        uint256 refundAmountValue
    ); // 拍卖取消事件
    event NFTApproved(
        address indexed owner,
        address indexed nftAddress,
        uint256 tokenId
    ); // NFT批准事件
    event NFTApprovalCancelled(
        address indexed owner,
        address indexed nftAddress,
        uint256 tokenId
    ); // NFT取消批准事件
    // ============ 构造函数和初始化函数 ============
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 初始化函数（代理合约的第一个版本）
     * 注意：这个函数不会重新初始化，只是设置 V2 的新变量
     */
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        platformFee = 0; // 默认无手续费
        paused = false;
        totalAuctionsCreated = 0;
        totalBidsPlaced = 0;
        totalValueLocked = 0; // 初始化 TVL
        useDynamicFee = false; // 默认使用固定手续费
        baseFeeRate = 0; // 默认基础费率为 0
    }
    /**
     * @dev V2 初始化函数（用于升级时调用）
     * 注意：这个函数不会重新初始化，只是设置 V2 的新变量
     * @custom:oz-upgrades-validate-as-initializer
     */
    function initializeV2() public reinitializer(2) {
        __Ownable_init(owner());
        __ReentrancyGuard_init();
    }

    /**
     * @dev 设置平台手续费（基点，100 = 1%）
     * @param _fee 手续费基点（最大 1000 = 10%）
     * 注意：如果启用了动态手续费，此函数设置的固定手续费将被忽略
     */
    function setPlatformFee(uint256 _fee) public onlyOwner {
        require(_fee <= 1000, "Fee cannot exceed 10%");
        uint256 oldFee = platformFee;
        platformFee = _fee;
        emit PlatformFeeUpdated(oldFee, _fee);
    }

    /**
     * @dev 设置动态手续费档次
     * @param _thresholds 阈值数组（USD 价值，8位小数，按从低到高排序）
     * @param _feeRates 手续费率数组（基点，100 = 1%，对应每个阈值）
     * 示例：thresholds = [1000e8, 10000e8, 100000e8] (对应 $1000, $10000, $100000)
     *       feeRates = [500, 300, 100] (对应 5%, 3%, 1%)
     * 表示：$0-$1000: 5%, $1000-$10000: 3%, $10000-$100000: 1%, $100000+: 1%
     */
    function setFeeTiers(
        uint256[] memory _thresholds,
        uint256[] memory _feeRates
    ) public onlyOwner {
        require(
            _feeRates.length == _thresholds.length + 1,
            "Fee rates array must have one more element than thresholds"
        );
        require(_thresholds.length > 0, "At least one tier required");
        require(_thresholds.length <= 10, "Too many tiers (max 10)");

        // 清空现有档次
        delete feeTiers;

        // 存储基础费率（用于低于最低阈值的金额）
        require(_feeRates[0] <= 1000, "Fee rate cannot exceed 10%");
        baseFeeRate = _feeRates[0];

        // 验证并添加档次
        uint256 lastThreshold = 0;
        for (uint256 i = 0; i < _thresholds.length; i++) {
            require(
                _thresholds[i] > lastThreshold,
                "Thresholds must be in ascending order"
            );
            require(_feeRates[i + 1] <= 1000, "Fee rate cannot exceed 10%");

            feeTiers.push(
                FeeTier({
                    threshold: _thresholds[i],
                    feeRate: _feeRates[i + 1] // 使用 i+1 索引，因为 feeRates[0] 已存储在 baseFeeRate
                })
            );

            emit FeeTierUpdated(i, _thresholds[i], _feeRates[i + 1]);
            lastThreshold = _thresholds[i];
        }

        // 启用动态手续费
        useDynamicFee = true;
        emit DynamicFeeEnabled(true);
    }

    /**
     * @dev 启用或禁用动态手续费
     * @param _enabled true 启用动态手续费，false 使用固定手续费
     */
    function setDynamicFeeEnabled(bool _enabled) public onlyOwner {
        require(
            _enabled == false || feeTiers.length > 0,
            "Must set fee tiers before enabling"
        );
        useDynamicFee = _enabled;
        emit DynamicFeeEnabled(_enabled);
    }

    /**
     * @dev 根据 USD 价值计算动态手续费
     * @param _usdValue 拍卖金额的 USD 价值（8位小数）
     * @return feeRate 手续费率（基点）
     *
     * 逻辑说明：
     * - 每个阈值对应一个费率，该费率用于该阈值及以上但小于下一个阈值的金额
     * - 最后一个费率用于最高阈值及以上的所有金额
     * - 如果金额低于最低阈值，使用第一个费率
     */
    function calculateDynamicFeeRate(
        uint256 _usdValue
    ) public view returns (uint256 feeRate) {
        if (!useDynamicFee || feeTiers.length == 0) {
            return platformFee; // 如果未启用动态手续费，返回固定手续费
        }

        // 从最高档次开始查找（因为数组是按阈值从低到高排序的）
        // 找到第一个金额 >= 阈值的档次
        for (uint256 i = feeTiers.length; i > 0; i--) {
            if (_usdValue >= feeTiers[i - 1].threshold) {
                // 返回该阈值对应的费率
                // 注意：这个费率用于该阈值及以上但小于下一个阈值的金额
                return feeTiers[i - 1].feeRate;
            }
        }

        // 如果金额低于最低阈值，使用基础费率
        return baseFeeRate;
    }

    /**
     * @dev 获取手续费档次数量
     */
    function getFeeTierCount() public view returns (uint256) {
        return feeTiers.length;
    }

    /**
     * @dev 获取所有手续费档次
     */
    function getAllFeeTiers() public view returns (FeeTier[] memory) {
        return feeTiers;
    }

    /**
     * @dev 紧急暂停所有操作
     */
    function pause() public onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @dev 取消暂停
     */
    function unpause() public onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @dev 修改器：检查是否暂停
     */
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    // ============ 核心功能函数 ============

    function setPriceFeed(address _token, address _priceFeed) public onlyOwner {
        require(_priceFeed != address(0), "Invalid price feed address");
        priceFeeds[_token] = _priceFeed;
    }

    function setPriceFeeds(
        address[] memory _tokens,
        address[] memory _priceFeeds
    ) public onlyOwner {
        require(_tokens.length == _priceFeeds.length, "Arrays length mismatch");
        for (uint256 i = 0; i < _tokens.length; i++) {
            require(_priceFeeds[i] != address(0), "Invalid price feed address");
            priceFeeds[_tokens[i]] = _priceFeeds[i];
        }
    }

    function getTokenPrice(
        address _token
    ) public view returns (uint256 price, uint8 decimals) {
        address priceFeed = priceFeeds[_token];
        require(priceFeed != address(0), "Price feed not set for this token");

        AggregatorV3Interface oracle = AggregatorV3Interface(priceFeed);
        (, int256 priceInt, , , ) = oracle.latestRoundData();
        require(priceInt > 0, "Invalid price from oracle");

        decimals = oracle.decimals();
        price = uint256(priceInt);
    }

    function convertToUSDValue(
        address _token,
        uint256 _amount
    ) public view returns (uint256) {
        (uint256 price, ) = getTokenPrice(_token);

        // 获取代币精度
        uint8 tokenDecimals;
        if (_token == address(0)) {
            // ETH 是 18 位小数
            tokenDecimals = 18;
        } else {
            // ERC20 代币，尝试获取 decimals（如果失败则假设 18）
            try IERC20Metadata(_token).decimals() returns (uint8 dec) {
                tokenDecimals = dec; //ERC20代币精度
            } catch {
                tokenDecimals = 18; // 默认ETH是18位小数
            }
        }

        // 计算美元价值
        // Chainlink 价格是 8 位小数
        // 公式：usdValue = (amount * price) / (10^tokenDecimals)
        // 结果已经是 8 位小数（因为 price 是 8 位小数）

        return (_amount * price) / (10 ** uint256(tokenDecimals));
    }

    function approveNFT(
        address _nftAddress,
        uint256 _tokenId
    ) public whenNotPaused {
        // 批准NFT给合约
        // IERC721 nft = IERC721(_nftAddress);
        // require(nft.ownerOf(_tokenId) == msg.sender, "You must own the NFT");
        // nft.approve(address(this), _tokenId);
        // emit NFTApproved(msg.sender, _nftAddress, _tokenId);
    }

    function cancelNFTApproval(
        address _nftAddress,
        uint256 _tokenId
    ) public whenNotPaused {
        // 取消NFT的批准
        // IERC721 nft = IERC721(_nftAddress);
        // require(nft.ownerOf(_tokenId) == msg.sender, "You must own the NFT");
        // nft.approve(address(0), _tokenId);
        // emit NFTApprovalCancelled(msg.sender, _nftAddress, _tokenId);
    }

    function createAuction(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _startPrice, //设成美元的chainlink价格x8
        uint256 _startTime,
        uint256 _endTime
    ) public whenNotPaused returns (uint256) {
        //NFT is owned by the user
        require(_startTime < _endTime, "Start time must be before end time");
        require(_startPrice > 0, "Start price must be greater than 0");

        IERC721 nft = IERC721(_nftAddress);
        require(nft.ownerOf(_tokenId) == msg.sender, "You must own the NFT");
        nft.transferFrom(msg.sender, address(this), _tokenId);
        auctions.push(
            Auction({
                nftAddress: _nftAddress,
                tokenId: _tokenId,
                seller: msg.sender,
                highestBidder: address(0),
                highestBidToken: address(0),
                highestBid: 0,
                highestBidValue: 0,
                startPrice: _startPrice, //美元价值x8因为chainlink价格是8位小数
                startTime: _startTime,
                endTime: _endTime,
                ended: false,
                cancelled: false,
                bidCount: 0
            })
        );
        uint256 auctionId = auctions.length - 1;
        totalAuctionsCreated++;

        // 注意：创建拍卖时不将起拍价加入TVL，只有实际出价后才计入

        uint256[] storage userAuctionIds = userCreatedAuctionIds[msg.sender];
        userAuctionIds.push(auctionId);
        emit AuctionCreated(auctionId, msg.sender, _nftAddress, _tokenId);
        return auctionId;
    }

    function getUserCreatedAuctions(
        address _user
    ) public view returns (Auction[] memory) {
        uint256[] storage userAuctionIds = userCreatedAuctionIds[_user];
        uint256 length = userAuctionIds.length;
        Auction[] memory result = new Auction[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = auctions[userAuctionIds[i]];
        }
        return result;
    }

    function bid(
        uint256 _auctionId,
        uint256 _amount, // ETH/USDC *10^decimals 是精度值 合约里面代币都是最小单位表示
        address _token
    ) public payable whenNotPaused nonReentrant {
        require(_amount > 0, "Bid amount must be greater than 0");
        if (_token == address(0)) {
            //ETH转账必须与bid amount一致
            require(msg.value == _amount, "ETH amount must match bid amount");
        }
        require(_auctionId < auctions.length, "Auction does not exist");
        Auction storage auction = auctions[_auctionId];
        require(
            !auction.ended && !auction.cancelled,
            "Auction has ended or cancelled"
        );
        require(
            block.timestamp >= auction.startTime &&
                block.timestamp <= auction.endTime,
            "Auction has not started or ended "
        );
        require(
            priceFeeds[_token] != address(0),
            "Price feed not set for this token"
        );

        uint256 bidValue = convertToUSDValue(_token, _amount);

        uint256 minBidValue = auction.highestBidValue == 0
            ? auction.startPrice //这个是美元价格x8因为chainlink价格是8位小数
            : auction.highestBidValue;

        uint256 bidCount = auctionBidCount[_auctionId]; //获取当前拍卖的出价次数
        bidCount++;
        auctionBidCount[_auctionId] = bidCount;
        auction.bidCount = bidCount;

        // 记录出价次数
        totalBidsPlaced++;

        if (bidValue < minBidValue) {
            emit BidValueTooLow(
                _auctionId,
                msg.sender,
                _amount,
                _token,
                bidCount,
                block.timestamp,
                bidValue,
                auction.highestBidder,
                auction.highestBidValue
            );
            revert("Bid value must be greater than the minimum required value");
        }

        if (_token != address(0)) {
            //ERC20
            require(msg.value == 0, "Cannot send ETH for ERC20 bid");
            IERC20 token = IERC20(_token);
            require(
                token.allowance(msg.sender, address(this)) >= _amount,
                "Insufficient token allowance"
            );
            require(
                token.balanceOf(msg.sender) >= _amount,
                "Insufficient token balance"
            );

            token.safeTransferFrom(msg.sender, address(this), _amount);
        }

        // 保存旧出价者信息（在更新状态前）
        address previousBidder = auction.highestBidder;
        address previousBidToken = auction.highestBidToken;
        uint256 previousBid = auction.highestBid;
        uint256 previousBidValue = auction.highestBidValue;

        // 更新拍卖状态（在退还前，确保状态一致性）
        auction.highestBidder = msg.sender;
        auction.highestBidToken = _token;
        auction.highestBid = _amount;
        auction.highestBidValue = bidValue;

        // 退还前一个出价者（使用保存的旧值）
        if (previousBidder != address(0)) {
            if (previousBidToken == address(0)) {
                (bool success, ) = payable(previousBidder).call{
                    value: previousBid
                }("");
                require(success, "Failed to refund previous bidder");
            } else {
                IERC20 token = IERC20(previousBidToken);
                token.safeTransfer(previousBidder, previousBid);
            }
        }

        // 更新 TVL：只有实际出价后才计入TVL（使用保存的旧值）
        uint256 oldTVL = totalValueLocked;
        if (previousBidValue > 0) {
            // 已有出价：更新TVL（从旧出价更新为新出价）
            totalValueLocked = totalValueLocked - previousBidValue + bidValue;
        } else {
            // 第一次出价：将出价价值加入TVL
            totalValueLocked += bidValue;
        }

        emit BidPlaced(
            _auctionId,
            msg.sender,
            _amount,
            _token,
            bidCount,
            block.timestamp,
            bidValue,
            previousBidder,
            previousBidValue
        );
        // 发出TVL更新事件
        uint256 change = totalValueLocked > oldTVL
            ? totalValueLocked - oldTVL
            : oldTVL - totalValueLocked;
        emit TotalValueLockedUpdated(
            totalValueLocked,
            totalBidsPlaced,
            change,
            totalValueLocked > oldTVL
        );
    }

    /**
     * @dev 内部函数：执行拍卖结束的通用逻辑（转移 NFT 和资金）
     * @param _auctionId 拍卖 ID
     * @param auction 拍卖存储引用
     */
    function _endAuctionInternal(
        uint256 _auctionId,
        Auction storage auction
    ) internal {
        IERC721 nft = IERC721(auction.nftAddress);

        // 更新 TVL：移除该拍卖的锁定价值（只有实际出价后才需要移除）
        if (auction.highestBidValue > 0) {
            totalValueLocked -= auction.highestBidValue;
            // 发出TVL更新事件
            emit TotalValueLockedUpdated(
                totalValueLocked,
                totalBidsPlaced,
                auction.highestBidValue,
                false
            );
        }

        if (auction.highestBidder != address(0)) {
            nft.transferFrom(
                address(this),
                auction.highestBidder,
                auction.tokenId
            );

            // 计算并扣除手续费（支持动态手续费）
            uint256 feeAmount = 0;
            uint256 sellerAmount = auction.highestBid;

            // 根据是否启用动态手续费选择计算方式
            uint256 effectiveFeeRate;
            if (useDynamicFee && feeTiers.length > 0) {
                // 使用动态手续费：根据 USD 价值计算手续费率
                effectiveFeeRate = calculateDynamicFeeRate(
                    auction.highestBidValue
                );
            } else {
                // 使用固定手续费
                effectiveFeeRate = platformFee;
            }

            if (effectiveFeeRate > 0) {
                feeAmount = (auction.highestBid * effectiveFeeRate) / 10000;
                sellerAmount = auction.highestBid - feeAmount;
            }

            if (auction.highestBidToken == address(0)) {
                // 转移 ETH 给卖家（扣除手续费）
                (bool success1, ) = payable(auction.seller).call{
                    value: sellerAmount
                }("");
                require(success1, "Failed to transfer funds to seller");

                // 如果有手续费，转移给合约所有者
                if (feeAmount > 0) {
                    (bool success2, ) = payable(owner()).call{value: feeAmount}(
                        ""
                    );
                    require(success2, "Failed to transfer fee to owner");
                }
            } else {
                IERC20 token = IERC20(auction.highestBidToken);
                // 转移代币给卖家（扣除手续费）
                token.safeTransfer(auction.seller, sellerAmount);

                // 如果有手续费，转移给合约所有者
                if (feeAmount > 0) {
                    token.safeTransfer(owner(), feeAmount);
                }
            }

            emit AuctionEnded(
                _auctionId,
                auction.highestBidder,
                auction.highestBid,
                auction.seller,
                auction.highestBidToken,
                auction.highestBidValue,
                auction.startPrice
            );
        } else {
            nft.transferFrom(address(this), auction.seller, auction.tokenId);
            emit AuctionEnded(
                _auctionId,
                address(0),
                0,
                auction.seller,
                address(0),
                0,
                0
            );
        }
    }

    /**
     * @dev 结束拍卖并领取 NFT
     * @param _auctionId 拍卖 ID
     */
    function endAuctionAndClaimNFT(
        uint256 _auctionId
    ) public onlyOwner whenNotPaused {
        require(_auctionId < auctions.length, "Auction does not exist");
        Auction storage auction = auctions[_auctionId];
        require(
            !auction.ended && !auction.cancelled,
            "Auction has already ended or cancelled"
        );
        require(
            //60秒的缓冲时间
            block.timestamp >= auction.endTime - TIME_BUFFER,
            "Auction has not ended yet"
        );

        auction.ended = true;
        _endAuctionInternal(_auctionId, auction);
    }

    /**
     * @dev 强制结束拍卖并领取 NFT
     * @param _auctionId 拍卖 ID
     * 强制结束会：
     * 1. 修改拍卖结束时间为当前时间
     * 2. 将拍卖状态标记为已结束
     * 3. 执行正常的结束流程（转移 NFT 和资金）
     */
    function forceEndAuctionAndClaimNFT(
        uint256 _auctionId
    ) public onlyOwner whenNotPaused {
        require(_auctionId < auctions.length, "Auction does not exist");

        Auction storage auction = auctions[_auctionId];
        require(
            !auction.ended && !auction.cancelled,
            "Auction has already ended or cancelled"
        );

        // 强制结束：修改结束时间为当前时间并标记为已结束
        auction.endTime = block.timestamp;
        auction.ended = true;
        _endAuctionInternal(_auctionId, auction);
        emit AuctionForceEnded(_auctionId, msg.sender);
    }

    /**
     * @dev 关闭拍卖并退还NFT和拍卖金额
     * @param _auctionId 拍卖 ID
     * 功能：
     * - 只能由卖家或合约所有者调用
     * - 将NFT退还给卖家
     * - 如果有出价，将出价金额全额退还给最高出价者（不扣除手续费）
     * - 更新TVL（如果有出价，从TVL中移除）
     * - 发出取消事件
     */
    function cancelAuction(uint256 _auctionId) public onlyOwner whenNotPaused nonReentrant {
        require(_auctionId < auctions.length, "Auction does not exist");

        Auction storage auction = auctions[_auctionId];
        require(
            !auction.ended && !auction.cancelled,
            "Auction has already ended or cancelled"
        );
        require(
            msg.sender == auction.seller || msg.sender == owner(),
            "Only seller or owner can cancel auction"
        );

        // 标记拍卖为已结束
        auction.ended = true;
        // 标记拍卖为已取消
        auction.cancelled = true;

        IERC721 nft = IERC721(auction.nftAddress);

        // 更新 TVL：移除该拍卖的锁定价值（只有实际出价后才需要移除）
        if (auction.highestBidValue > 0) {
            totalValueLocked -= auction.highestBidValue;
            // 发出TVL更新事件
            emit TotalValueLockedUpdated(
                totalValueLocked,
                totalBidsPlaced,
                auction.highestBidValue,
                false
            );
        }

        // 将NFT退还给卖家
        nft.transferFrom(address(this), auction.seller, auction.tokenId);

        // 如果有出价，将出价金额全额退还给最高出价者
        if (auction.highestBidder != address(0)) {
            if (auction.highestBidToken == address(0)) {
                // 退还 ETH
                (bool success, ) = payable(auction.highestBidder).call{
                    value: auction.highestBid
                }("");
                require(success, "Failed to refund bidder");
            } else {
                // 退还 ERC20 代币
                IERC20 token = IERC20(auction.highestBidToken);
                token.safeTransfer(auction.highestBidder, auction.highestBid);
            }
        }

        // 发出取消事件
        emit AuctionCancelled(
            _auctionId,
            msg.sender,
            auction.highestBidder,
            auction.highestBidToken,
            auction.highestBid,
            auction.highestBidValue
        );
    }
    
    /**
    * @dev 取消用户拍卖
    * @param _auctionId 拍卖 ID
    * 功能：
    * - 只能由卖家调用
    * - 拍卖必须没有出价，否则无法取消
    * - 拍卖必须没有结束，否则无法取消
    * - 拍卖必须没有取消，否则无法取消
    * - 拍卖必须没有结束，否则无法取消
    */
    function cancelUserAuction(uint256  _auctionId) public whenNotPaused nonReentrant returns (bool) {
        require(_auctionId < auctions.length, "Auction does not exist");
        Auction storage auction = auctions[_auctionId];
        require(
            msg.sender == auction.seller,
            "Only seller can cancel auction"); //只能卖家取消
        require(
            !auction.ended && !auction.cancelled,
            "Auction has already ended or cancelled"
        );//必须没有结束或取消，否则无法取消
        require(auction.highestBidder==address(0), "Auction has bids, cannot cancel");//必须没有出价，否则无法取消
        require(auction.highestBidToken == address(0), "Auction has token bids, cannot cancel");//必须没有代币出价，否则无法取消
        auction.cancelled = true;
        auction.ended = true;
        IERC721 nft = IERC721(auction.nftAddress);
        nft.transferFrom(address(this), auction.seller, auction.tokenId);
        emit AuctionCancelled(_auctionId, msg.sender, address(0), address(0), 0, 0);
        return true;
    }
    function getAuction(
        uint256 _auctionId
    ) public view returns (Auction memory) {
        return auctions[_auctionId];
    }

    function getAuctionCount() public view returns (uint256) {
        return auctions.length;
    }

    // ============ 扩展功能 ============

    /**
     * @dev 批量获取拍卖信息
     * @param _startIndex 起始索引
     * @param _count 获取数量
     */
    function getAuctionsBatch(
        uint256 _startIndex,
        uint256 _count
    ) public view returns (Auction[] memory) {
        require(_startIndex < auctions.length, "Start index out of bounds");

        uint256 endIndex = _startIndex + _count;
        if (endIndex > auctions.length) {
            endIndex = auctions.length;
        }

        uint256 resultCount = endIndex - _startIndex;
        Auction[] memory result = new Auction[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = auctions[_startIndex + i];
        }

        return result;
    }
    function getAuctionSimpleStats()
        external
        view
        returns (
            uint256 ,
            uint256 ,
            uint256 ,
            uint256 
        )
    {
        return (totalAuctionsCreated, totalBidsPlaced, platformFee, totalValueLocked);
    }
    /**
     * @dev 获取拍卖统计信息
     */
    function getAuctionStats()
        public
        view
        returns (
            uint256 totalAuctions,
            uint256 totalBids,
            uint256 currentPlatformFee,
            bool isPaused,
            uint256 activeAuctions
        )
    {
        totalAuctions = totalAuctionsCreated;
        totalBids = totalBidsPlaced;
        currentPlatformFee = platformFee;
        isPaused = paused;

        // 计算活跃拍卖数
        uint256 active = 0;
        uint256 currentTime = block.timestamp;
        for (uint256 i = 0; i < auctions.length; i++) {
            if (
                !auctions[i].ended &&
                currentTime >= auctions[i].startTime &&
                currentTime <= auctions[i].endTime
            ) {
                active++;
            }
        }
        activeAuctions = active;
    }

    /**
     * @dev 获取用户创建的拍卖数量
     * @param _user 用户地址
     * @return 用户创建的拍卖数量
     */
    function getUserCreatedAuctionCount(
        address _user
    ) public view returns (uint256) {
        uint256[] storage userAuctionIds = userCreatedAuctionIds[_user];
        return userAuctionIds.length;
    }

    /**
     * @dev 获取总锁定价值（TVL - Total Value Locked）
     * @return tvl 总锁定价值（USD 价值，8位小数）
     *
     * TVL 通过状态变量实时维护，gas 消耗极低（仅读取一个存储变量）
     * - 创建拍卖时不计入TVL（起拍价不是实际锁定资金）
     * - 第一次出价时将出价价值加入TVL
     * - 后续出价时更新TVL（从旧出价更新为新出价）
     * - 结束拍卖时移除锁定价值（只有有出价的拍卖才需要移除）
     */
    function getTotalValueLocked() public view returns (uint256) {
        return totalValueLocked;
    }

    function version() public pure returns (string memory) {
        return "2.0.0";
    }
}
