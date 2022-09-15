const { assert, expect } = require("chai");
const { BigNumber } = require("ethers");
const { network, ethers, getNamedAccounts, deployments } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config.js");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Unit tests for DEX", function () {
      let DEX, accounts, deployer, myToken, tester, wethToken, mockV3Aggregator;
      const addressZero = "0x0000000000000000000000000000000000000000";

      beforeEach(async () => {
        await deployments.fixture(["all"]);
        DEX = await ethers.getContract("DEX");
        myToken = await ethers.getContract("AKTestToken");
        wethToken = await ethers.getContract("WETH");
        mockV3Aggregator = await ethers.getContract("MockV3Aggregator");
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        tester = accounts[1];
      });

      describe("swapEth", () => {
        it("should be able to swap weth/eth to token", async () => {
          const swapAmount = await DEX.calculateExchangeToken(
            wethToken.address,
            myToken.address,
            "10000000000000000000"
          );

          console.log(swapAmount.toString(), "is amount");
          const ownerBalanceBeforeTransaction = await myToken.balanceOf(
            deployer.address
          );
          const fee = (swapAmount.toString() * 0.3) / 100;

          const amount = "10000000000000000000";
          const amountForLiquidity = swapAmount.toString();

          await myToken.approve(DEX.address, amountForLiquidity);

          const tx = await DEX.provideLiquidity(
            myToken.address,
            amountForLiquidity
          );

          const tx2 = await DEX.swapWETHToToken(
            wethToken.address,
            myToken.address,
            {
              value: amount.toString(),
            }
          );

          const tx2Response = await tx2.wait(1);
          const ethSwapped = tx2Response.events[3].args.ethSwapped;
          const tokenReceived = tx2Response.events[3].args.tokenReceived;
          const transactionFee = tx2Response.events[3].args.transactionFee;

          const ownerNewTokenBalance = await myToken.balanceOf(
            deployer.address
          );

          const wethBalance = await wethToken.ethBalance();
          const DEXWethBalance = await wethToken.balanceOf(DEX.address);

          assert.equal(wethBalance.toString(), amount);
          assert.equal(ethSwapped.toString(), amount);
          assert.equal(DEXWethBalance.toString(), amount);
          console.log("we have reached here");
          assert.equal(
            transactionFee.toString().slice(0, 6),
            BigNumber.from(fee.toFixed(0).toString().slice(0, 6))
          );
          assert.equal(
            ownerBalanceBeforeTransaction.toString(),
            BigNumber.from(ownerNewTokenBalance.toString())
              .add(transactionFee.toString())
              .toString()
          );
          assert.equal(
            tokenReceived.toString(),
            BigNumber.from(swapAmount.toString())
              .sub(transactionFee.toString())
              .toString()
          );
        });

        it("should be able to swap token to weth/eth", async () => {
          const swapAmount = await DEX.calculateExchangeToken(
            myToken.address,
            wethToken.address,
            "300000000000000000000"
          );
          const ownerTokenBalanceBeforeTx = await myToken.balanceOf(
            deployer.address
          );

          const ownerEthBalance = await ethers.provider.getBalance(
            deployer.address
          );

          const actualAmount = swapAmount.toString();
          const tx = await DEX.provideLiquidityInEth({ value: actualAmount });

          const fee = BigNumber.from(actualAmount).mul("3").div("1000");
          const ownerEthBalanceAftertx1 = await ethers.provider.getBalance(
            deployer.address
          );
          const wethContractBalace = await wethToken.ethBalance();
          const DEXWethBalace = await wethToken.balanceOf(DEX.address);

          const ownerBalanceForToken = await myToken.balanceOf(
            deployer.address
          );
          await myToken.approve(DEX.address, "300000000000000000000");
          const tx2 = await DEX.swapTokenToWETH(
            myToken.address,
            wethToken.address,
            "300000000000000000000"
          );
          const tx2Response = await tx2.wait(1);
          const tokenSwapped = tx2Response.events[4].args.tokenSwapped;
          const tokenReceived = tx2Response.events[4].args.tokenReceived;
          const transactionFee = tx2Response.events[4].args.transactionFee;

          const newOwnerBalanceForToken = await myToken.balanceOf(
            deployer.address
          );

          const ownerEthBalanceAftertx2 = await ethers.provider.getBalance(
            deployer.address
          );
          const newWethContractBalance = await wethToken.ethBalance();

          //after token balances of DEX
          const DEXNewEthBalance = await wethToken.balanceOf(DEX.address);
          const DEXNewTokenBalance = await myToken.balanceOf(DEX.address);

          //checkers
          assert.equal(wethContractBalace.toString(), DEXWethBalace.toString());

          assert.equal(
            ownerEthBalance.toString().slice(0, 6),
            ownerEthBalanceAftertx2.toString().slice(0, 6)
          );
          assert.equal(
            ownerEthBalance.toString().slice(0, 6),
            BigNumber.from(ownerEthBalanceAftertx1.toString())
              .add(tokenReceived.toString())
              .toString()
              .slice(0, 6)
          );

          assert.equal(
            transactionFee.toString().slice(0, 6),
            fee.toString().slice(0, 6)
          );

          assert.equal(tokenSwapped.toString(), "300000000000000000000");
          assert.equal(
            newOwnerBalanceForToken.toString(),
            BigNumber.from(ownerBalanceForToken.toString())
              .sub(tokenSwapped.toString())
              .toString()
          );

          assert.equal(
            swapAmount.toString(),
            BigNumber.from(DEXNewEthBalance.toString())
              .add(tokenReceived.toString())
              .toString()
          );

          assert.equal("300000000000000000000", DEXNewTokenBalance.toString());
          assert.equal(
            newWethContractBalance.toString(),
            DEXNewEthBalance.toString()
          );
        });
      });
    });
