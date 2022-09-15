const { assert, expect } = require("chai");
const { BigNumber } = require("ethers");
const { network, ethers, getNamedAccounts, deployments } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config.js");

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
        mockV3Aggregator;
      const addressZero = "0x0000000000000000000000000000000000000000";

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
      });

      describe("Provide Liquidity", function () {
        it("should be reverted with address zero", async () => {
          const error = `DEX_notValidToken("0x0000000000000000000000000000000000000000")`;
          await expect(
            DEX.provideLiquidity(addressZero, 10)
          ).to.be.revertedWith(error);
        });

        it("should be reverted on amount less than zero", async () => {
          await expect(
            DEX.provideLiquidity(deployer.address, 0)
          ).to.be.revertedWith(
            `DEX_notEnoughTokenProvided("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 0)`
          );
        });

        it("should be reverted if owner has less balance", async () => {
          const dex = await DEX.connect(tester);
          await expect(
            dex.provideLiquidity(myToken.address, "10000000000000000000")
          ).to.be.revertedWith(
            'DEX_insufficientBalance("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0x5FbDB2315678afecb367f032d93F642f64180aa3")'
          );
        });

        it("It should be reverted on invalid Token", async () => {
          const fakeToken = "0xdD2FD4581271e230360230F9337D5c0430Bf44C0";
          await expect(
            DEX.provideLiquidity(fakeToken, "10000000000000000000")
          ).to.be.revertedWith(
            'DEX_tokenNotSupported("0xdD2FD4581271e230360230F9337D5c0430Bf44C0")'
          );
        });

        it("should be able to provide liquidity to pool", async () => {
          const amount = "10000000000000000000";
          const oldBalance = await myToken.balanceOf(deployer.address);
          await myToken.approve(DEX.address, amount);
          const tx = await DEX.provideLiquidity(myToken.address, amount);
          const txResponse = await tx.wait(1);
          const poolId = txResponse.events[2].args.poolId;
          const owner = txResponse.events[2].args.owner;

          // providing liquidity second time to check pool id is correct
          await myToken.approve(DEX.address, amount);
          const tx2 = await DEX.provideLiquidity(myToken.address, amount);
          const txResponse2 = await tx2.wait(1);
          const poolId2 = txResponse2.events[2].args.poolId;
          const newOwnerBalance = await myToken.balanceOf(deployer.address);
          const contributions = await DEX.checkContributionIds(
            deployer.address
          );

          const dexBalance = await DEX.checkPoolBalanceForToken(
            myToken.address
          );

          assert.equal(poolId.toString(), "0");
          assert.equal(poolId2.toString(), "1");
          assert.equal(owner.toString(), deployer.address);
          assert.equal(
            (Number(oldBalance) - Number(amount) * 2).toString(),
            Number(newOwnerBalance)
          );
          assert.equal(dexBalance.toString(), (amount * 2).toString());
          assert.equal(contributions[0].toString(), "0");
          assert.equal(contributions[1].toString(), "1");
        });

        it("Should be able to provide liquidity to Pool in ETH", async () => {
          const amount = "10000000000000000000";
          const tx = await DEX.provideLiquidityInEth({
            value: amount,
          });
          const txResponse = await tx.wait(1);
          const poolId = await txResponse.events[2].args.poolId;

          const pool = await DEX.checkPoolWithId(poolId.toString());

          const DEXWethBalance = await wethToken.balanceOf(DEX.address);

          const wethContractBalance = await wethToken.ethBalance();

          assert.equal(DEXWethBalance.toString(), amount);
          assert.equal(
            DEXWethBalance.toString(),
            wethContractBalance.toString()
          );
          assert.equal(pool["token"].toString(), wethToken.address);
          assert.equal(pool["amount"].toString(), amount);
          assert.equal(pool["owner"].toString(), deployer.address);
          expect(Number(pool["timeStamp"]) < Number(new Date()));
        });
      });

      describe("checkPoolWithId", function () {
        it("should revert the transaction on invaid id", async () => {
          const id = 0;
          // since no transaction has been done. the current id will be 0 and the tx will revert
          await expect(DEX.checkPoolWithId(id)).to.be.revertedWith(
            `DEX_invalidId()`
          );
        });

        it("should be able to check for pool if id is valid", async () => {
          const amount = "10000000000000000000";
          const secondsInWeek = 604800;
          await myToken.approve(DEX.address, amount);
          const tx = await DEX.provideLiquidity(myToken.address, amount);
          const txResponse = await tx.wait(1);
          const poolId = txResponse.events[2].args.poolId;

          const pool = await DEX.checkPoolWithId(poolId);

          assert.equal(pool[0].toString(), myToken.address);
          assert.equal(pool[1].toString(), amount);
          assert(Number(new Date()) > Number(pool[2]));
          assert.equal(Number(pool[2]) + secondsInWeek, Number(pool[3]));
          assert.equal(pool[4].toString(), deployer.address);
          assert.equal(pool[5].toString(), "true");
        });
      });

      describe("calculateExchangeTokenAfterFee", function () {
        it("should be able to calculate tokens After deducting Fee", async () => {
          const tokenBeforeFee = await DEX.calculateExchangeToken(
            myToken.address,
            myToken2.address,
            100
          );
          const fee = BigNumber.from(tokenBeforeFee.toString())
            .mul(3)
            .div(1000)
            .toString();
          const tokenAfterFeeByUs = BigNumber.from(tokenBeforeFee.toString())
            .sub(fee)
            .mul("10000000000")
            .toString();
          const tokenAfterFee = await DEX.calculateExchangeTokenAfterFee(
            myToken.address,
            myToken2.address,
            100
          );
          assert.equal(tokenAfterFeeByUs, tokenAfterFee.toString());
        });
      });
    });
