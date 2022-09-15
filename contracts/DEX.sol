//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./DEXValidTokens.sol";
import "./DEXTokenPrice.sol";
import "./WETH.sol";

error DEX_notEnoughTokenProvided(address provider, uint256 amount);
error DEX_notEnoughAmountProvided(address provider, uint256 amount);
error DEX_notValidToken(address token);
error DEX_insufficientBalance(address owner, address token);
error DEX_tokenNotSupported(address token);
error DEX_invalidId();
error DEX_swapForTokensNotSupported(address from, address to);
error DEX_sameTokensProvidedForSwap(address from, address to);
error DEX_insufficientLiquidityInPool(int256 amount);
error DEX_anErrorOccured();
error DEX_WrongFunctionCall();
error DEX_poolNotActive();
error DEX_notPoolOwner(address owner);
error DEX_poolInTimeLock(uint256 minLockPeriod);

/// @title A Decenteralized exchange for swapping tokens
/// @author Aamir usmani. github username: Aamirusmani1552
/// @notice This contract is just a for learning purpose. Please don't use it to deploy on mainnet. it might lead to loss of funds.
/// @dev since solidity doesn't support fractional value, the contract formula's has been modified accordingly.

contract DEX is Ownable, DEXValidTokens, DEXTokenPrice, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeMath for int128;
  using Counters for Counters.Counter;
  Counters.Counter private s_counter;

  uint256 private constant RATE_0F_INTEREST_PER_ANNUM = 10;

  struct pool {
    address token;
    uint256 amount;
    uint256 timestamp;
    uint256 minLockPeriod;
    address owner;
    bool active;
  }

  mapping(uint256 => pool) private s_liquidityPool;
  mapping(address => uint256[]) private s_poolContributions;

  event poolCreated(
    uint256 indexed poolId,
    address indexed token,
    uint256 amount,
    address owner,
    uint256 indexed timeStamp,
    uint256 minLockPeriod,
    bool active
  );

  event EthToTokenSwapSuccessfull(
    uint256 ethSwapped,
    int256 tokenReceived,
    int256 transactionFee,
    address user
  );

  event TokenToEthSwapSuccessfull(
    uint256 tokenSwapped,
    int256 tokenReceived,
    int256 transactionFee,
    address user
  );

  event tokenSwappedSuccessfully(
    uint256 tokenSwapped,
    int256 tokenReceived,
    int256 transactionFee,
    address user
  );

  event LiquidityWithdrawSuccessfull(
    uint256 poolId,
    uint256 tokenToRecieve,
    uint256 tokenToReceiveWithInterest,
    uint256 totalInterestEarned,
    address user,
    address token
  );

  constructor(
    address[] memory tokenAddresses,
    address[] memory chainlinkAggregatorV3Addr,
    address wethContract
  )
    DEXValidTokens(tokenAddresses, wethContract)
    DEXTokenPrice(tokenAddresses, chainlinkAggregatorV3Addr)
  {}

  function provideLiquidityInEth() public payable nonReentrant {
    if (msg.value <= 0) {
      revert DEX_notEnoughTokenProvided(msg.sender, msg.value);
    }

    pool memory newPool = pool(
      i_wethContractAddress,
      msg.value,
      block.timestamp,
      block.timestamp + uint256(1 weeks),
      msg.sender,
      true
    );
    s_liquidityPool[s_counter.current()] = newPool;
    uint256 poolId = s_counter.current();
    s_poolContributions[msg.sender].push(poolId);
    s_counter.increment();

    WETH wethContract = WETH(payable(i_wethContractAddress));
    wethContract.deposit{ value: msg.value }();

    emit poolCreated(
      poolId,
      i_wethContractAddress,
      msg.value,
      msg.sender,
      block.timestamp,
      (block.timestamp + uint256(1 weeks)),
      true
    );
  }

  function provideLiquidity(address token, uint256 amount) public nonReentrant {
    if (token == address(0)) {
      revert DEX_notValidToken(token);
    }
    if (amount <= 0) {
      revert DEX_notEnoughTokenProvided(msg.sender, amount);
    }
    if (!_tokenPresent(token)) {
      revert DEX_tokenNotSupported(token);
    }

    if (IERC20(token).balanceOf(msg.sender) < amount) {
      revert DEX_insufficientBalance(msg.sender, token);
    }

    pool memory newPool = pool(
      token,
      amount,
      block.timestamp,
      block.timestamp + uint256(1 weeks),
      msg.sender,
      true
    );
    s_liquidityPool[s_counter.current()] = newPool;
    uint256 poolId = s_counter.current();
    s_poolContributions[msg.sender].push(poolId);
    s_counter.increment();

    IERC20(token).transferFrom(msg.sender, address(this), amount);

    emit poolCreated(
      poolId,
      token,
      amount,
      msg.sender,
      block.timestamp,
      (block.timestamp + uint256(1 weeks)),
      true
    );
  }

  function swap(
    address from,
    address to,
    uint256 amount
  ) public nonReentrant {
    if (from == i_wethContractAddress || to == i_wethContractAddress) {
      revert DEX_WrongFunctionCall();
    }
    if (from == to) {
      revert DEX_sameTokensProvidedForSwap(from, to);
    }

    if (from == address(0) || to == address(0)) {
      revert DEX_notValidToken(address(0));
    }
    if (amount <= 0) {
      revert DEX_notEnoughAmountProvided(msg.sender, amount);
    }
    if (!_tokenPresent(from) || !_tokenPresent(to)) {
      revert DEX_swapForTokensNotSupported(from, to);
    }

    if (IERC20(from).balanceOf(msg.sender) < amount) {
      revert DEX_insufficientBalance(msg.sender, from);
    }

    int256 totalToToken = calculateExchangeToken(from, to, amount);
    if (IERC20(to).balanceOf(address(this)) < uint256(totalToToken)) {
      revert DEX_insufficientLiquidityInPool(totalToToken);
    }

    int256 fee = _calculateExchangeFee(totalToToken);
    uint256 amountToSend = (uint256(totalToToken).sub(uint256(fee)));

    IERC20(from).transferFrom(msg.sender, address(this), amount);
    IERC20(to).transfer(msg.sender, amountToSend);

    emit tokenSwappedSuccessfully(
      (amount),
      int256(amountToSend),
      fee,
      msg.sender
    );
  }

  function swapWETHToToken(address from, address to)
    public
    payable
    nonReentrant
  {
    if (from == address(0) || to == address(0)) {
      revert DEX_notValidToken(address(0));
    }

    if (msg.value <= 0) {
      revert DEX_notEnoughAmountProvided(msg.sender, msg.value);
    }

    if (!_tokenPresent(to)) {
      revert DEX_tokenNotSupported(to);
    }

    if (from != i_wethContractAddress) {
      revert DEX_WrongFunctionCall();
    }

    int256 totalToToken = calculateExchangeToken(
      i_wethContractAddress,
      to,
      msg.value
    );

    if (IERC20(to).balanceOf(address(this)) < uint256(totalToToken)) {
      revert DEX_insufficientLiquidityInPool(int256(uint256(totalToToken)));
    }

    WETH wethContract = WETH(payable(i_wethContractAddress));
    wethContract.deposit{ value: msg.value }();
    int256 fee = _calculateExchangeFee(totalToToken);
    IERC20(to).transfer(msg.sender, (uint256(totalToToken).sub(uint256(fee))));

    emit EthToTokenSwapSuccessfull(
      msg.value,
      int256((uint256(totalToToken).sub(uint256(fee)))),
      int256(uint256(fee)),
      msg.sender
    );
  }

  function swapTokenToWETH(
    address from,
    address to,
    uint256 amount
  ) public nonReentrant {
    if (from == address(0) || to == address(0)) {
      revert DEX_notValidToken(address(0));
    } else if (amount <= 0) {
      revert DEX_notEnoughAmountProvided(msg.sender, amount);
    } else if (_tokenPresent(from) && to == i_wethContractAddress) {
      int256 totalToToken = calculateExchangeToken(
        from,
        i_wethContractAddress,
        amount
      );

      if (
        IERC20(i_wethContractAddress).balanceOf(address(this)) <
        uint256(totalToToken)
      ) {
        revert DEX_insufficientLiquidityInPool(int256(uint256(totalToToken)));
      }

      WETH wethContract = WETH(payable(i_wethContractAddress));
      int256 fee = _calculateExchangeFee(totalToToken);
      uint256 amountToSend = (uint256(totalToToken).sub(uint256(fee)));

      IERC20(from).transferFrom(msg.sender, address(this), amount);

      wethContract.withdraw(amountToSend);

      (bool success, ) = payable(msg.sender).call{ value: amountToSend }("");

      if (!success) {
        revert DEX_anErrorOccured();
      }

      emit TokenToEthSwapSuccessfull(
        amount,
        int256(amountToSend),
        int256(fee),
        msg.sender
      );
    }
  }

  function calculateExchangeToken(
    address from,
    address to,
    uint256 amount
  ) public view returns (int256) {
    if (from == address(0) || to == address(0)) {
      revert DEX_notValidToken(address(0));
    }
    if (amount <= 0) {
      revert DEX_notEnoughAmountProvided(msg.sender, amount);
    }
    if (!_tokenPresent(from) || !_tokenPresent(to)) {
      revert DEX_swapForTokensNotSupported(from, to);
    }
    AggregatorV3Interface fromChainlinkContract = AggregatorV3Interface(
      s_tokenUsdPricesV3contracts[from]
    );
    AggregatorV3Interface toChainlinkContract = AggregatorV3Interface(
      s_tokenUsdPricesV3contracts[to]
    );

    int256 fromPrice = _getPrice(fromChainlinkContract);
    int256 toTokenPrice = _getPrice(toChainlinkContract);
    int256 totalToToken = int256(
      (uint256(fromPrice).mul(uint256(amount))).div(uint256(toTokenPrice))
    );

    return totalToToken;
  }

  function _calculateExchangeFee(int256 totalToToken)
    internal
    pure
    returns (int256)
  {
    int256 fee = int256((uint256(totalToToken).mul(30)).div(10000));
    return fee;
  }

  function calculateExchangeTokenAfterFee(
    address from,
    address to,
    uint256 amount
  ) public view returns (int256) {
    if (from == address(0) || to == address(0)) {
      revert DEX_notValidToken(address(0));
    }
    if (amount <= 0) {
      revert DEX_notEnoughAmountProvided(msg.sender, amount);
    }
    if (!_tokenPresent(from) || !_tokenPresent(to)) {
      revert DEX_swapForTokensNotSupported(from, to);
    }
    int256 totalToToken = calculateExchangeToken(from, to, amount);
    int256 fee = _calculateExchangeFee(totalToToken);
    return int256(uint256(totalToToken).sub(uint256(fee)));
  }

  function _tokenPresent(address token) internal view returns (bool) {
    address[] memory tokenAddresses = s_validTokenAddresses;
    for (uint8 i = 0; i < tokenAddresses.length; i++) {
      if (token == tokenAddresses[i]) {
        return true;
      }
    }
    return false;
  }

  function removeLiquidity(uint256 poolId, address token)
    external
    nonReentrant
  {
    if (!_tokenPresent(token)) {
      revert DEX_tokenNotSupported(token);
    }

    if (poolId >= s_counter.current()) {
      revert DEX_invalidId();
    }

    pool storage _pool = s_liquidityPool[poolId];

    if (_pool.active == false) {
      revert DEX_poolNotActive();
    }

    if (_pool.owner != msg.sender) {
      revert DEX_notPoolOwner(msg.sender);
    }

    if (_pool.minLockPeriod > block.timestamp) {
      revert DEX_poolInTimeLock(_pool.minLockPeriod);
    }

    uint256 amount = _pool.amount;

    int256 tokenToRecieve = calculateExchangeToken(_pool.token, token, amount);

    if (IERC20(token).balanceOf(address(this)) < uint256(tokenToRecieve)) {
      revert DEX_insufficientLiquidityInPool(int256(tokenToRecieve));
    }

    uint256 totalInterestEarned = _calculateInterest(
      tokenToRecieve,
      _pool.timestamp
    );

    uint256 tokenToReceiveWithInterest = uint256(tokenToRecieve).add(
      totalInterestEarned
    );

    _pool.active = false;

    if (token == i_wethContractAddress) {
      WETH wethContract = WETH(payable(i_wethContractAddress));
      wethContract.withdraw(tokenToReceiveWithInterest);
      (bool success, ) = payable(msg.sender).call{
        value: tokenToReceiveWithInterest
      }("");
      if (!success) {
        revert DEX_anErrorOccured();
      }
    } else {
      IERC20(token).transfer(msg.sender, tokenToReceiveWithInterest);
    }

    emit LiquidityWithdrawSuccessfull(
      poolId,
      uint256(tokenToRecieve),
      tokenToReceiveWithInterest,
      totalInterestEarned,
      msg.sender,
      token
    );
  }

  function _calculateInterest(int256 tokens, uint256 initialTimeStamp)
    internal
    view
    returns (uint256)
  {
    uint256 secondsInYear = 31536000;
    uint256 investPeriod = block.timestamp.sub(initialTimeStamp);
    uint256 interestInOneYear = uint256(tokens).mul(RATE_0F_INTEREST_PER_ANNUM);
    uint256 totalInterestEarned = investPeriod
      .mul(interestInOneYear)
      .div(secondsInYear)
      .div(100);
    return totalInterestEarned;
  }

  //getter functions
  function checkPoolBalanceForToken(address token)
    public
    view
    returns (uint256)
  {
    if (token == address(0)) {
      revert DEX_notValidToken(token);
    }
    if (!_tokenPresent(token)) {
      revert DEX_tokenNotSupported(token);
    }
    return IERC20(token).balanceOf(address(this));
  }

  function supportedTokens() public view returns (address[] memory) {
    return s_validTokenAddresses;
  }

  function checkPoolWithId(uint256 id) public view returns (pool memory) {
    if (id >= s_counter.current()) {
      revert DEX_invalidId();
    }

    return s_liquidityPool[id];
  }

  function checkContributionIds(address contributer)
    public
    view
    returns (uint256[] memory)
  {
    return s_poolContributions[contributer];
  }

  // fallback and recieve functions
  fallback() external payable {}

  receive() external payable {}
}
