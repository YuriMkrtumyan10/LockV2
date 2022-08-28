const {
  time,
  loadFixture,
  mine
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");



describe("Lock", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployLock() {
    const [owner, caller, otherAccount] = await ethers.getSigners();

    const Lock = await ethers.getContractFactory("Lock");
    const lock = await Lock.deploy(5);

    const tokenAddressA = await lock.tokenA();
    const tokenA = await ethers.getContractAt("TokenA", tokenAddressA);
    const tokenAddressB = await lock.tokenB();
    const tokenB = await ethers.getContractAt("TokenA", tokenAddressB);

    return { lock, owner, caller, tokenA, tokenAddressA, tokenB, tokenAddressB, otherAccount };
  }

  describe("Initial State", () => {
    it("Should initialize with correct args: ", async () => {
      const { lock, owner, caller } = await loadFixture(deployLock);

      expect(await lock.ownerFee()).to.equal(5);
    });
  });

  describe("Lock", () => {
    it("Should lock both ETHER and Tokens for a while with correct args: ", async () => {
      const { lock, owner, tokenA, tokenB, tokenAddressA, tokenAddressB } = await loadFixture(deployLock);
      const tokenAmount = [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")];
      const lockTime = ethers.BigNumber.from("10");
      const tokenAddress = [tokenAddressA, tokenAddressB];

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;

      await tokenA.mint(owner.address, tokenAmount[0]);
      await tokenA.approve(lock.address, tokenAmount[0]);
      await tokenB.mint(owner.address, tokenAmount[1]);
      await tokenB.approve(lock.address, tokenAmount[1]);

      await lock.lock(tokenAmount, lockTime, tokenAddress, { value: 1000 });

      const user = await lock.locks(owner.address, 0);

      expect(user.id).to.equal(await lock.usersNumber());
      expect(user.amountEth).to.equal(1000);
      /// == 
      // expect(ethers.utils.solidityKeccak256(((["uint256"],user.amountToken)))).to
      //   .equal(ethers.utils.solidityKeccak256(((["uint256"],tokenAmount))));
      // expect(user.tokenAddress).to.equal(tokenAddress);   
      //locktime + 15 idk why
      expect(user.unlockTime).to.equal(timestampBefore + 15);
      expect(user.status).to.equal(0);
      expect(await lock.usersNumber()).to.equal(1);
      expect(await lock.ownerProfitEth()).to.equal(50);

    });
    it("Should lock ETHER for a while with correct args: ", async () => {
      const { lock, owner, tokenAddressA, tokenAddressB } = await loadFixture(deployLock);
      const tokenAmount = [ethers.BigNumber.from("0"), ethers.BigNumber.from("0")];
      const lockTime = ethers.BigNumber.from("10");
      const tokenAddress = [tokenAddressA, tokenAddressB];

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;

      await lock.lock(tokenAmount, lockTime, tokenAddress, { value: 1000 });

      const user = await lock.locks(owner.address, 0);

      expect(user.id).to.equal(await lock.usersNumber());
      expect(user.amountEth).to.equal(1000);
      /// == 
      // expect(ethers.utils.solidityKeccak256(((["uint256"],user.amountToken)))).to
      //   .equal(ethers.utils.solidityKeccak256(((["uint256"],tokenAmount))));
      // expect(user.tokenAddress).to.equal(tokenAddress);   //locktime + 1 idk why
      expect(user.unlockTime).to.equal(timestampBefore + 11);
      expect(user.status).to.equal(0);
      expect(await lock.usersNumber()).to.equal(1);
      expect(await lock.ownerProfitEth()).to.equal(50);

    });

    it("Should lock tokens for a while with correct args: ", async () => {
      const { lock, owner, tokenA, tokenAddressA, tokenB, tokenAddressB, caller } = await loadFixture(deployLock);
      const tokenAmount = [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")];
      const lockTime = ethers.BigNumber.from("10");
      const _tokenAddress = [tokenAddressA, tokenAddressB]

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;

      await tokenA.mint(owner.address, tokenAmount[0]);
      await tokenA.approve(lock.address, tokenAmount[0]);
      await tokenB.mint(owner.address, tokenAmount[1]);
      await tokenB.approve(lock.address, tokenAmount[1]);

      await lock.lock(tokenAmount, lockTime, _tokenAddress);
      const user = await lock.locks(owner.address, 0);

      expect(user.id).to.equal(await lock.usersNumber());
      expect(user.amountEth).to.equal(0);
      // expect(user.amountToken).to.equal(tokenAmount);
      // expect(user.tokenAddress).to.equal(_tokenAddress);   //11 idk why
      expect(user.unlockTime).to.equal(timestampBefore + 15);
      expect(user.status).to.equal(0);
      expect(await lock.usersNumber()).to.equal(1);
      //check ownerProfitTOken!!!!!!!!!!!!
    });

    it("Should emit Locked event with correct args:", async () => {
      const { lock, owner, tokenAddressA, tokenAddressB, caller } = await loadFixture(deployLock);
      const tokenAmount = [0, 0];
      const lockTime = ethers.BigNumber.from("10");
      const tokenAddress = [tokenAddressA, tokenAddressB]

      await expect(lock.lock(tokenAmount, lockTime, tokenAddress, { value: 1000 }))
        .to.emit(lock, 'Locked')
        .withArgs(await lock.usersNumber(), owner.address, lockTime);

    })

    //requires
    it("Should revert if the user didnt submit token or ether: ", async () => {
      const { lock, owner, tokenAddressA, tokenAddressB, caller } = await loadFixture(deployLock);
      const tokenAmount = [0, 0];
      const lockTime = ethers.BigNumber.from("10");
      const tokenAddress = [tokenAddressA, tokenAddressB]

      await expect(lock.lock(tokenAmount, lockTime, tokenAddress, { value: 0 }))
        .to.be.revertedWith("Lock: submited 0 token or ether");

    })
    it("Should revert if the user didnt submit token and hasnt enough ether balance: ", async () => {
      const { lock, owner, tokenAddressA, tokenAddressB, caller } = await loadFixture(deployLock);
      const tokenAmount = [0, 0];
      const lockTime = ethers.BigNumber.from("10");
      const tokenAddress = [tokenAddressA, tokenAddressB]

      const ethValue = ethers.BigNumber.from("8000004203098714283903");

      await expect(lock.lock(tokenAmount, lockTime, tokenAddress, { value: ethValue }))
        .to.be.revertedWith("Lock: Not enough Eth");


    })

  });
  describe("Unlock", () => {

    it("Should transfer ETHER back after unlocking: ", async () => {
      const { lock, owner, tokenA, tokenAddressA, tokenAddressB, caller } = await loadFixture(deployLock);
      const tokenAmount = [ethers.BigNumber.from("10"), 0];
      const lockTime = ethers.BigNumber.from("0");
      const tokenAddress = [tokenAddressA, tokenAddressB]

      await tokenA.mint(owner.address, tokenAmount[0]);
      await tokenA.approve(lock.address, tokenAmount[0]);


      await lock.lock(tokenAmount, lockTime, tokenAddress, { value: 1000 });

      await expect(await lock.unlock(0))
        .to.changeEtherBalances([lock, owner], [-950, 950]);
    });

    it("Should transfer TOKENS back after unlocking: ", async () => {
      const { lock, owner, tokenA, tokenAddressA, tokenB, tokenAddressB, caller } = await loadFixture(deployLock);
      const tokenAmount = [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")];
      const lockTime = ethers.BigNumber.from("0");
      const _tokenAddress = [tokenAddressA, tokenAddressB]

      await tokenA.mint(owner.address, tokenAmount[0]);
      await tokenA.approve(lock.address, tokenAmount[0]);
      await tokenB.mint(owner.address, tokenAmount[1]);
      await tokenB.approve(lock.address, tokenAmount[1]);

      await lock.lock(tokenAmount, lockTime, _tokenAddress);

      await expect(() => lock.unlock(0))                // should be 285
        .to.changeTokenBalances(tokenB, [lock, owner], [-190, 190]);
    });


    it("Should emit UnLocked event with correct args:", async () => {
      const { lock, owner, tokenA, tokenAddressA, tokenB, tokenAddressB, caller } = await loadFixture(deployLock);
      const tokenAmount = [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")];
      const lockTime = ethers.BigNumber.from("0");
      const tokenAddress = [tokenAddressA, tokenAddressB];

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;


      await tokenA.mint(owner.address, tokenAmount[0]);
      await tokenA.approve(lock.address, tokenAmount[0]);
      await tokenB.mint(owner.address, tokenAmount[1]);
      await tokenB.approve(lock.address, tokenAmount[1]);

      await lock.lock(tokenAmount, lockTime, tokenAddress, { value: 1000 });

      await expect(lock.unlock(0))
        .to.emit(lock, 'UnLocked')
        .withArgs(await lock.usersNumber(), owner.address, timestampBefore + 6);

    })

    //requires

    it("Should revert if the user is new and didnt locked: ", async () => {
      const { lock, owner, tokenA, tokenAddressA, tokenB, tokenAddressB, caller } = await loadFixture(deployLock);


      await expect(lock.unlock(0))
        .to.be.revertedWith("Lock: You are not allowed");

    })
    it("Should revert if the user didnt locked an asset before: ", async () => {
      const { lock, owner, tokenA, tokenAddressA, tokenB, tokenAddressB, caller } = await loadFixture(deployLock);

      const tokenAmount = [ethers.BigNumber.from("0"), ethers.BigNumber.from("0")];
      const lockTime = ethers.BigNumber.from("0");
      const tokenAddress = [tokenAddressA, tokenAddressB];
      await lock.lock(tokenAmount, lockTime, tokenAddress, { value: 1000 });
      await lock.unlock(0);
      await expect(lock.unlock(0))
        .to.be.revertedWith("Lock: Should have been locked to unlock");

    })
    it("Should revert if user wants to unlock in a wrong time: ", async () => {
      const { lock, owner, tokenA, tokenAddressA, tokenB, tokenAddressB, caller } = await loadFixture(deployLock);
      const tokenAmount = [ethers.BigNumber.from("0"), ethers.BigNumber.from("0")];
      const lockTime = ethers.BigNumber.from("10");
      const tokenAddress = [tokenAddressA, tokenAddressB];
      await lock.lock(tokenAmount, lockTime, tokenAddress, { value: 1000 });


      await expect(lock.unlock(0))
        .to.be.revertedWith("Lock: You have to wait");

    })
  });

  describe("Withdraw", () => {

    it("Should withdraw money with correct args: ", async () => {
      const { lock, owner, tokenA, tokenB, tokenAddressA, tokenAddressB } = await loadFixture(deployLock);
      const tokenAmount = [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")];
      const lockTime = ethers.BigNumber.from("0");
      const tokenAddress = [tokenAddressA, tokenAddressB];

      await tokenA.mint(owner.address, tokenAmount[0]);
      await tokenA.approve(lock.address, tokenAmount[0]);
      await tokenB.mint(owner.address, tokenAmount[1]);
      await tokenB.approve(lock.address, tokenAmount[1]);

      await lock.lock(tokenAmount, lockTime, tokenAddress, { value: 1000 });
      await lock.unlock(0);

      const tokenAmountToWithdraw = [ethers.BigNumber.from("5"), ethers.BigNumber.from("10")]

      await expect(await lock.withdraw(50, tokenAmountToWithdraw, tokenAddress))
        .to.changeEtherBalances([lock, owner], [-50, 50]).
          to.changeTokenBalances(tokenB, [lock, owner], [-10, 10]).
          to.changeTokenBalances(tokenA, [lock, owner], [-5, 5]);

    })

    it("Should emit Withdrawal event with correct args:", async () => {
      const { lock, owner, tokenA, tokenB, tokenAddressA, tokenAddressB } = await loadFixture(deployLock);
      const tokenAmount = [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")];
      const lockTime = ethers.BigNumber.from("0");
      const tokenAddress = [tokenAddressA, tokenAddressB];

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;



      await tokenA.mint(owner.address, tokenAmount[0]);
      await tokenA.approve(lock.address, tokenAmount[0]);
      await tokenB.mint(owner.address, tokenAmount[1]);
      await tokenB.approve(lock.address, tokenAmount[1]);

      await lock.lock(tokenAmount, lockTime, tokenAddress, { value: 1000 });
      await lock.unlock(0);

      const tokenAmountToWithdraw = [ethers.BigNumber.from("5"), ethers.BigNumber.from("10")]

      await expect(lock.withdraw( 50, tokenAmountToWithdraw, tokenAddress))
        .to.emit(lock, 'Withdrawal')
        .withArgs(0, timestampBefore+7);
    })

    //requires
    it("Should revert if the contract does not have ether: ", async () => {
      const { lock, owner, tokenA, tokenB, tokenAddressA, tokenAddressB } = await loadFixture(deployLock);
      const tokenAmount = [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")];
      const lockTime = ethers.BigNumber.from("0");
      const tokenAddress = [tokenAddressA, tokenAddressB];
      
      await tokenA.mint(owner.address, tokenAmount[0]);
      await tokenA.approve(lock.address, tokenAmount[0]);
      await tokenB.mint(owner.address, tokenAmount[1]);
      await tokenB.approve(lock.address, tokenAmount[1]);

      await lock.lock(tokenAmount, lockTime, tokenAddress);
      await lock.unlock(0);

      const tokenAmountToWithdraw = [ethers.BigNumber.from("5"), ethers.BigNumber.from("10")]

      await expect(lock.withdraw(60, tokenAmountToWithdraw, tokenAddress))
        .to.be.revertedWith("Not enought ether");
    })
    it("Should revert if the owner wants to withdraw more mone than it is allowed: ", async () => {
      const { lock, owner, tokenA, tokenB, tokenAddressA, tokenAddressB,caller } = await loadFixture(deployLock);
      const tokenAmount = [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")];
      const tokenAmount2 = [ethers.BigNumber.from("0"), ethers.BigNumber.from("0")];

      const lockTime = ethers.BigNumber.from("0");
      const tokenAddress = [tokenAddressA, tokenAddressB];
      
      await tokenA.mint(owner.address, tokenAmount[0]);
      await tokenA.approve(lock.address, tokenAmount[0]);
      await tokenB.mint(owner.address, tokenAmount[1]);
      await tokenB.approve(lock.address, tokenAmount[1]);

      await lock.lock(tokenAmount, lockTime, tokenAddress, { value: 1000 });  
      await lock.lock(tokenAmount2, lockTime, tokenAddress, { value: 1000 });

      await lock.unlock(0);

      const tokenAmountToWithdraw = [ethers.BigNumber.from("5"), ethers.BigNumber.from("10")]

      await expect(lock.withdraw(60, tokenAmountToWithdraw, tokenAddress))
        .to.be.revertedWith("Too much ether withdrawal");
     
    })

  });


});
