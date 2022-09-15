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
        myToken2,
        tester,
        wethToken,
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

      describe("swapTokens", function () {
        it("should revert on tokenAddress equal weth token", async () => {
          await expect(
            DEX.swap(myToken.address, wethToken.address, 10)
          ).to.be.revertedWith("DEX_WrongFunctionCall()");
        });
        it("should revert on token address equal", async () => {
          await expect(DEX.swap(myToken.address, myToken.address, 10)).to.be
            .reverted;
        });
        it("should revert on address zero", async () => {
          await expect(DEX.swap(addressZero, myToken2.address, 10)).to.be
            .reverted;
        });
        it("should revert on amount less than equal to zero", async () => {
          await expect(DEX.swap(myToken.address, myToken2.address, 0)).to.be
            .reverted;
        });
        it("should revert on token other than supported", async () => {
          const fakeToken = "0xdD2FD4581271e230360230F9337D5c0430Bf44C0";
          await expect(DEX.swap(fakeToken, myToken2.address, 10)).to.be
            .reverted;
        });
        it("balance of the user should be greater than amount", async () => {
          const amount = "10000000000000000000000000"; //10 million tokens
          await expect(
            DEX.swap(myToken.address, myToken2.address, amount)
          ).to.be.revertedWith(
            'DEX_insufficientBalance("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "0x5FbDB2315678afecb367f032d93F642f64180aa3")'
          );
        });

        it("should revert if DEX have swap token balance less than amount", async () => {
          const amount = "100000000000000000000";

          const tokensToRecieve = await DEX.calculateExchangeToken(
            myToken.address,
            myToken2.address,
            "100000000000000000000"
          );

          const fee = BigNumber.from(tokensToRecieve.toString())
            .mul("3")
            .div("1000");

          //balances before transactions
          const userBalanceOfTokenBeforeTx = await myToken.balanceOf(
            deployer.address
          );
          const dexBalanceOfTokenBeforeTx = await myToken.balanceOf(
            DEX.address
          );
          const userBalanceOfToken2BeforeTx = await myToken2.balanceOf(
            deployer.address
          );
          const dexBalanceOfToken2BeforeTx = await myToken2.balanceOf(
            DEX.address
          );

          // console.log("user token1: ", userBalanceOfTokenBeforeTx.toString());
          // console.log("user token2: ", userBalanceOfToken2BeforeTx.toString());
          // console.log("dex token: ", dexBalanceOfTokenBeforeTx.toString());
          // console.log("dex token2: ", dexBalanceOfToken2BeforeTx.toString());

          const amountToSend = tokensToRecieve.toString();
          await myToken.approve(DEX.address, amount);
          await myToken2.approve(DEX.address, amountToSend);
          const tx = await DEX.provideLiquidity(myToken2.address, amountToSend);

          const tx1 = await DEX.swap(
            myToken.address,
            myToken2.address,
            "100000000000000000000"
          );
          const tx1Response = await tx1.wait(1);
          const tokenSwapped = tx1Response.events[3].args.tokenSwapped;
          const tokenReceived = tx1Response.events[3].args.tokenReceived;
          const transactionFee = tx1Response.events[3].args.transactionFee;
          const user = tx1Response.events[3].args.user;

          // balances After transactions
          const userNewBalanceOfToken = await myToken.balanceOf(
            deployer.address
          );
          const dexNewBalanceOfToken = await myToken.balanceOf(DEX.address);
          const userNewBalanceOfToken2 = await myToken2.balanceOf(
            deployer.address
          );
          const dexNewBalanceOfToken2 = await myToken2.balanceOf(DEX.address);
          // console.log("new Balances: \n");
          // console.log("user token1: ", userNewBalanceOfToken.toString());
          // console.log("user token2: ", userNewBalanceOfToken2.toString());
          // console.log("dex token: ", dexNewBalanceOfToken.toString());
          // console.log("dex token2: ", dexNewBalanceOfToken2.toString());

          assert.equal(
            userNewBalanceOfToken.toString(),
            BigNumber.from(userBalanceOfTokenBeforeTx.toString())
              .sub(amount)
              .toString()
          );
          assert.equal(dexNewBalanceOfToken.toString(), amount);
          assert.equal(
            userNewBalanceOfToken2.toString(),
            BigNumber.from(userBalanceOfToken2BeforeTx.toString())
              .sub(transactionFee.toString())
              .toString()
          );
          assert.equal(
            dexNewBalanceOfToken2.toString(),
            transactionFee.toString()
          );

          assert.equal(
            tokenReceived.toString(),
            BigNumber.from(amountToSend).sub(transactionFee.toString())
          );

          assert.equal(tokenSwapped.toString(), amount);
          assert.equal(
            transactionFee.toString().slice(0, 6),
            fee.toString().slice(0, 6)
          );
        });
      });
    });
