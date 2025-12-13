// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    uint256 public maxSupply;
    string public baseTokenURI;

    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);

    constructor(
        string memory name,
        string memory symbol,
        uint256 _maxSupply,
        address initialOwner
    ) ERC721(name, symbol) Ownable(initialOwner) {
        maxSupply = _maxSupply;
        _nextTokenId = 1; // 从 tokenId 1 开始
    }

    /**
     * @dev 设置基础 URI
     */
    function setBaseURI(string memory _baseTokenURI) public onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    /**
     * @dev 铸造 NFT
     * @param to 接收 NFT 的地址
     * @param uri token 的元数据 URI
     */
    function mint(address to, string memory uri) public onlyOwner {
        require(_nextTokenId <= maxSupply, "Max supply reached");
        
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit NFTMinted(to, tokenId, uri);
    }

    /**
     * @dev 批量铸造 NFT
     * @param to 接收 NFT 的地址
     * @param tokenURIs token 的元数据 URI 数组
     */
    function mintBatch(address to, string[] memory tokenURIs) public onlyOwner {
        require(_nextTokenId + tokenURIs.length - 1 <= maxSupply, "Exceeds max supply");
        
        for (uint256 i = 0; i < tokenURIs.length; i++) {
            uint256 tokenId = _nextTokenId;
            _nextTokenId++;
            
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, tokenURIs[i]);
            
            emit NFTMinted(to, tokenId, tokenURIs[i]);
        }
    }

    /**
     * @dev 获取当前已铸造的 token 数量
     */
    function totalSupply() public view returns (uint256) {
        return _nextTokenId - 1;
    }

    /**
     * @dev 重写 _baseURI 函数
     */
    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    /**
     * @dev 重写 tokenURI 函数以支持 ERC721URIStorage
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /**
     * @dev 重写 supportsInterface 函数
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

