const { assert, expect } = require("chai");
const { BigNumber } = require("ethers");
const { network, ethers, getNamedAccounts, deployments } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config.js");
const moveBlocks = require("../../utils/moveBlocks.js");
const moveTime = require("../../utils/moveTime.js");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Unit tests for DEX", function () {
      let DEX,
        accounts,
        deployer,
        myToken,
        tester,
        wethToken,
        myToken2,
        mockV3Aggregator,
        amount;
      const addressZero = ethers.constants.AddressZero;

      beforeEach(async () => {
        await deployments.fixture(["all"]);
        DEX = await ethers.getContract("DEX");
        myToken = await ethers.getContract("AKTestToken");
        myToken2 = await ethers.getContract("AKTestToken2");
        wethToken = await ethers.getContract("WETH");
        mockV3Aggregator = await ethers.getContract("MockV3Aggregator");
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        tester = accounts[1];
        amount = "100000000000000000000";
      });

      describe("removeLiquidity", function () {
        it("should revert on invalid token provided", async () => {
          await expect(DEX.removeLiquidity("0", addressZero)).to.be.reverted;
        });

        it("should revert on invalid poolId", async () => {
          await expect(
            DEX.removeLiquidity("0", myToken.address)
          ).to.be.revertedWith("DEX_invalidId()");
        });

        it("should revert on wrong owner calling function", async () => {
          await myToken.approve(DEX.address, amount);

          const tx = await DEX.provideLiquidity(myToken.address, amount);
          const txResponse = await tx.wait(1);
          const poolId = txResponse.events[2].args.poolId;

          const dex = await DEX.connect(tester.address);
          await expect(dex.removeLiquidity(poolId.toString(), myToken.address))
            .to.be.reverted;
        });

        it("should revert on calling function before lock time period", async () => {
          await myToken.approve(DEX.address, amount);

          const tx = await DEX.provideLiquidity(myToken.address, amount);
          const txResponse = await tx.wait(1);
          const poolId = txResponse.events[2].args.poolId;
          const amountProvided = txResponse.events[2].args.amount;
          const minLockPeriod = txResponse.events[2].args.minLockPeriod;

          await expect(
            DEX.removeLiquidity(poolId.toString(), myToken.address)
          ).to.be.revertedWith(`DEX_poolInTimeLock(${Number(minLockPeriod)})`);
        });

        it("should be able to remove liquidity in other token", async () => {
          await myToken.approve(DEX.address, amount + "0");

          //balances before transactions
          const userBalanceOfTokenBeforeTx = await myToken.balanceOf(
            deployer.address
          );
          const dexBalanceOfTokenBeforeTx = await myToken.balanceOf(
            DEX.address
          );
          // console.log("old Balances: ");
          // console.log("user token1: ", userBalanceOfTokenBeforeTx.toString());
          // console.log("dex token: ", dexBalanceOfTokenBeforeTx.toString());

          //providing liquidity in token 1
          const tx = await DEX.provideLiquidity(myToken.address, amount);
          const txResponse = await tx.wait(1);
          const poolId = txResponse.events[2].args.poolId;
          const locktime = txResponse.events[2].args.minLockPeriod;
          const timeStamp = txResponse.events[2].args.timeStamp;
          const tx2 = await DEX.provideLiquidity(myToken.address, amount);
          console.log(poolId.toString());

          // total time from creation of pool to lock period
          const actualLockTime = Number(locktime) - Number(timeStamp);

          //moving time to 2 weeks later
          await moveTime(actualLockTime);
          await moveBlocks(1);

          // removing liquidity
          const tx3 = await DEX.removeLiquidity(
            poolId.toString(),
            myToken.address
          );

          const tx3Response = await tx3.wait(1);
          const tokenToReceiveWithInterest =
            tx3Response.events[1].args.tokenToReceiveWithInterest;

          const returnedPoolId = tx3Response.events[1].args.poolId;
          const amountBeforeInterest =
            tx3Response.events[1].args.tokenToRecieve;
          const totalInterestEarnedFromDex =
            tx3Response.events[1].args.totalInterestEarned;
          // balances after all transactions
          const userNewBalanceOfToken = await myToken.balanceOf(
            deployer.address
          );
          const dexNewBalanceOfToken = await myToken.balanceOf(DEX.address);
          const interestEarned = BigNumber.from(amountBeforeInterest.toString())
            .mul("10")
            .mul("604800")
            .div("100")
            .div("31536000");

          // console.log("\nnew Balances: ");
          // console.log("user token1: ", userNewBalanceOfToken.toString());
          // console.log("dex token: ", dexNewBalanceOfToken.toString());

          // events
          // console.log("\n\n", tx3Response.events[1].args.toString());

          //checkers
          assert.equal(
            dexNewBalanceOfToken.toString(),
            BigNumber.from(amount)
              .mul("2")
              .sub(tokenToReceiveWithInterest.toString())
              .toString()
          );

          assert.equal(
            userNewBalanceOfToken.toString(),
            BigNumber.from(userBalanceOfTokenBeforeTx.toString()).sub(
              dexNewBalanceOfToken.toString()
            )
          );

          assert.equal(poolId.toString(), returnedPoolId.toString());
          assert.equal(
            interestEarned.toString().slice(0, 5),
            totalInterestEarnedFromDex.toString().slice(0, 5)
          );
        });

        it("should be able to remove liquidity in eth", async () => {
          await myToken.approve(DEX.address, amount + "0");

          //balances before transactions
          const userBalanceOfTokenBeforeTx = await myToken.balanceOf(
            deployer.address
          );
          const dexBalanceOfTokenBeforeTx = await myToken.balanceOf(
            DEX.address
          );

          const userBalanceOfEthBeforeTx = await ethers.provider.getBalance(
            deployer.address
          );
          const DEXBalanceOfEthBeforeTx = await wethToken.balanceOf(
            DEX.address
          );

          // console.log("old Balances: ");
          // console.log("user token1: ", userBalanceOfTokenBeforeTx.toString());
          // console.log("dex token: ", dexBalanceOfTokenBeforeTx.toString());
          // console.log("user eth: ", userBalanceOfEthBeforeTx.toString());
          // console.log("dex eth: ", DEXBalanceOfEthBeforeTx.toString());

          //providing liquidity in token 1
          const tx = await DEX.provideLiquidity(myToken.address, amount);
          const tx2 = await DEX.provideLiquidityInEth({
            value: "1000000000000000000",
          });

          // collecting info from events;
          const txResponse = await tx.wait(1);
          const poolId = txResponse.events[2].args.poolId;
          const locktime = txResponse.events[2].args.minLockPeriod;
          const timeStamp = txResponse.events[2].args.timeStamp;
          // console.log(poolId.toString());

          // total time from creation of pool to lock period
          const actualLockTime = Number(locktime) - Number(timeStamp);

          //moving time to 2 weeks later
          await moveTime(actualLockTime);
          await moveBlocks(1);

          // removing liquidity
          const tx3 = await DEX.removeLiquidity(
            poolId.toString(),
            wethToken.address
          );

          const tx3Response = await tx3.wait(1);
          const tokenToReceiveWithInterest =
            tx3Response.events[2].args.tokenToReceiveWithInterest;
          console.log(
            tokenToReceiveWithInterest.toString(),
            "is actual amount"
          );
          const returnedPoolId = tx3Response.events[2].args.poolId;
          const amountBeforeInterest =
            tx3Response.events[2].args.tokenToRecieve;
          console.log(amountBeforeInterest.toString(), "is before interest");
          const interestRecievedFromDex =
            tx3Response.events[2].args.totalInterestEarned;
          console.log(interestRecievedFromDex.toString(), "is interest earned");

          const interestEarned = BigNumber.from(amountBeforeInterest.toString())
            .mul("10")
            .mul("604800")
            .div("100")
            .div("31536000");

          // console.log(interestEarned.toString());

          // balances after all transactions
          const userNewBalanceOfToken = await myToken.balanceOf(
            deployer.address
          );
          const dexNewBalanceOfToken = await myToken.balanceOf(DEX.address);
          const userNewBalanceOfEth = await ethers.provider.getBalance(
            deployer.address
          );
          const DEXNewBalanceOfEth = await wethToken.balanceOf(DEX.address);
          const activeValueOfRemovedPool = await DEX.checkPoolWithId(
            poolId.toString()
          );
          // console.log(activeValueOfRemovedPool.active);
          // console.log("\nnew Balances: ");
          // console.log("user token1: ", userNewBalanceOfToken.toString());
          // console.log("dex token: ", dexNewBalanceOfToken.toString());
          // console.log("user token1: ", userNewBalanceOfEth.toString());
          // console.log("dex token: ", DEXNewBalanceOfEth.toString());

          // events
          // console.log("\n\n", tx3Response.events[2].args.toString());

          //checkers
          assert.equal(
            dexNewBalanceOfToken.toString(),
            BigNumber.from(amount).toString()
          );

          assert.equal(
            userNewBalanceOfToken.toString(),
            BigNumber.from(userBalanceOfTokenBeforeTx.toString()).sub(
              dexNewBalanceOfToken.toString()
            )
          );

          assert.equal(
            DEXNewBalanceOfEth.toString(),
            BigNumber.from("1000000000000000000").sub(
              tokenToReceiveWithInterest.toString()
            )
          );

          assert.equal(
            interestEarned.toString().slice(0, 4),
            interestRecievedFromDex.toString().slice(0, 4)
          );

          // since some amount has been paid as a gas it will not be exactly equal
          assert.equal(
            userNewBalanceOfEth.toString().slice(0, 5),
            BigNumber.from(userBalanceOfEthBeforeTx.toString())
              .sub("1000000000000000000")
              .add(tokenToReceiveWithInterest.toString())
              .toString()
              .slice(0, 5)
          );
          assert.equal(poolId.toString(), returnedPoolId.toString());
          assert.equal(activeValueOfRemovedPool.active.toString(), "false");
        });
      });
    });
