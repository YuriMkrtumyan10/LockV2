// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

// Import this file to use console.log
import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./TokenA.sol";
import "./TokenB.sol";

// 1. Custom types struct/enum
// 2. state variables
// 3. data structures
// 4. events
// 5. constructor
// 6. modifiers
// 7. view/pure~
// 8. external
// 9. public
// 10. internal
// 11. private

contract Lock is Ownable {
    enum Status {
        LOCK,
        UNLOCK
    }

    struct User {
        uint256 id;
        uint256 amountEth;
        uint256[] amountToken;
        address[] tokenAddress;
        uint256 unlockTime;
        Status status;
    }
    uint256 public ownerFee;
    uint256 public usersNumber;
    TokenA public tokenA;
    TokenB public tokenB;
    uint256 public ownerProfitEth;
    uint256[] public ownerProfitToken;
    uint256 public id;

    mapping(address => mapping(uint256 => User)) public locks;

    event Locked(uint256 _id, address indexed _user, uint256 _lockTime);
    event UnLocked(uint256 _id, address indexed _user, uint256 _unlockTime);
    event Withdrawal(uint _amount, uint _when);

    constructor(uint256 _ownerFee) payable {
        ownerFee = _ownerFee;
        tokenA = new TokenA();
        tokenB = new TokenB();
    }

    function checkTokensWithTokenAMount(
        uint256[] memory _tokenAmount,
        address[] memory _tokenAddress
    ) public view returns (bool) {
        bool res = false;
        require(
            _tokenAddress.length == _tokenAmount.length,
            "Lock: Invalid input for token"
        );

        if (_tokenAddress.length == 0) {
            return false;
        } else {
            for (uint256 i = 0; i < _tokenAddress.length; i++) {
                if (_tokenAmount[i] != 0) {
                    res = true;
                }
                require(
                    address(IERC20(_tokenAddress[i])) != address(0x0),
                    "Lock: You have 0x0 address"
                );
                require(
                    IERC20(_tokenAddress[i]).allowance(
                        msg.sender,
                        address(this)
                    ) >= _tokenAmount[i],
                    "Lock: Not enough allowance"
                );
                require(
                    IERC20(_tokenAddress[i]).balanceOf(msg.sender) >=
                        _tokenAmount[i],
                    "Lock: Not enough funds for this token: "
                );
            }
        }
        return res;
    }

    function lock(
        uint256[] memory _tokenAmount,
        uint256 _lockTime,
        address[] memory _tokenAddress
    ) external payable {
        require(
            msg.value > 0 ||
                checkTokensWithTokenAMount(_tokenAmount, _tokenAddress),
            "Lock: submited 0 token or ether"
        );
        if (checkTokensWithTokenAMount(_tokenAmount, _tokenAddress)) {
            for (uint i = 0; i < _tokenAddress.length; i++) {
                if (msg.value > 0 && _tokenAmount[i] >= 0) {
                    IERC20(_tokenAddress[i]).transferFrom(
                        msg.sender,
                        address(this),
                        _tokenAmount[i]
                    );
                    //ownerProfitToken[i] = (_tokenAmount[i] * ownerFee) / 100;
                    ownerProfitEth = (msg.value * ownerFee) / 100;
                } else {
                    //  ownerProfitToken[i] = (_tokenAmount[i] * ownerFee) / 100;

                    IERC20(_tokenAddress[i]).transferFrom(
                        msg.sender,
                        address(this),
                        _tokenAmount[i]
                    );
                }
            }
        } else {
            require(msg.sender.balance >= msg.value, "Lock: Not enough Eth");
            ownerProfitEth = (msg.value * ownerFee) / 100;
        }

        usersNumber++;

        locks[msg.sender][id] = User(
            usersNumber,
            msg.value,
            _tokenAmount,
            _tokenAddress,
            block.timestamp + _lockTime,
            Status.LOCK
        );
        id++;
        emit Locked(usersNumber, msg.sender, _lockTime);
    }

    function unlock(uint256 _id) external payable {
        require(locks[msg.sender][_id].id > 0, "Lock: You are not allowed");
        require(
            locks[msg.sender][_id].status == Status.LOCK,
            "Lock: Should have been locked to unlock"
        );
        require(
            block.timestamp >= locks[msg.sender][_id].unlockTime,
            "Lock: You have to wait"
        );

        if (locks[msg.sender][_id].amountEth > 0) {
            uint256 transferEthAmount = locks[msg.sender][_id].amountEth;
            locks[msg.sender][_id].amountEth = 0;
            locks[msg.sender][_id].status = Status.UNLOCK;
            payable(msg.sender).transfer(transferEthAmount - ownerProfitEth);
        }
        for (uint i = 0; i < locks[msg.sender][_id].tokenAddress.length; i++) {
            if (locks[msg.sender][_id].amountToken[i] >= 0) {
                uint256 transferTokenAmount = locks[msg.sender][_id]
                    .amountToken[i];
                locks[msg.sender][_id].amountToken[i] = 0;
                locks[msg.sender][_id].status = Status.UNLOCK;

                // ask who is the FROM field below
                IERC20(locks[msg.sender][_id].tokenAddress[i]).transfer(
                    msg.sender,
                    transferTokenAmount - (transferTokenAmount * ownerFee) / 100
                );
                locks[msg.sender][_id].tokenAddress[i] = address(0);
            }
        }

        emit UnLocked(usersNumber, msg.sender, block.timestamp);
    }

    function withdraw(
        uint256 _amountEth,
        uint256[] memory _amountToken,
        address[] memory _tokenAddress
    ) public payable onlyOwner {
        require(address(this).balance >= _amountEth, "Not enought ether");
        require(_amountEth <= ownerProfitEth, "Too much ether withdrawal");

        for (uint i = 0; i < _amountToken.length; i++) {
            require(
                IERC20(_tokenAddress[i]).balanceOf(address(this)) >=
                    _amountToken[i],
                "Lock: Not enough funds for this token: "
            );
            // require(
            //     _amountToken[i] <= ownerProfitToken[i],
            //     "Too much token withdrawal"
            // );
           // ownerProfitToken[i] -= _amountToken[i];
            IERC20(_tokenAddress[i]).transfer(msg.sender, _amountToken[i]);
        }
        if (_amountEth > 0) {
            ownerProfitEth -= _amountEth;
            payable(msg.sender).transfer(_amountEth);
        }

        emit Withdrawal(address(this).balance, block.timestamp);
    }

    receive() external payable {}
}
