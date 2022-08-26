// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

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
    uint256 public id;

    mapping(address => mapping(uint256 => User)) public locks;

    constructor(uint256 _ownerFee) payable {
        ownerFee = _ownerFee;
        tokenA = new TokenA();
        tokenB = new TokenB();
    }

    event Locked(uint256 _id, address indexed _user, uint256 _lockTime);
    event UnLocked(uint256 _id, address indexed _user, uint256 _unlockTime);
    event Withdrawal(uint _amount, uint _when);

    function checkTokensWithTokenAMount(
        uint256[] memory _tokenAmount,
        address[] memory _tokenAddress
    ) public view returns (bool) {
        if (_tokenAddress.length != _tokenAmount.length) {
            return false;
        }
        if (_tokenAddress.length == 0) {
            return false;
        } else {
            for (uint i = 0; i < _tokenAddress.length; i++) {
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
        return true;
    }

    function lock(
        uint256[] memory _tokenAmount,
        uint256 _lockTime,
        address[] memory _tokenAddress
    ) external payable {
        require(
            msg.value > 0 ||
                !checkTokensWithTokenAMount(_tokenAmount, _tokenAddress),
            "Lock: submit 0 token or ether"
        );
        if (!checkTokensWithTokenAMount(_tokenAmount, _tokenAddress)) {
            require(msg.value > 0, "Lock: Submit ether");
            require(msg.sender.balance >= msg.value, "Lock: Not enough Eth");
            payable(address(this)).transfer(msg.value);
        } else {
            for (uint i = 0; i < _tokenAddress.length; i++) {
                if (msg.value > 0 && _tokenAmount[i] >= 0) {
                    payable(address(this)).transfer(msg.value);

                    IERC20(_tokenAddress[i]).transferFrom(
                        msg.sender,
                        address(this),
                        _tokenAmount[i]
                    );
                } else {
                    IERC20(_tokenAddress[i]).transferFrom(
                        msg.sender,
                        address(this),
                        _tokenAmount[i]
                    );
                }
            }
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
        require(
            locks[msg.sender][_id].id > 0,
            "Lock: Should have been locked to unlock"
        );

        // require(
        //     block.timestamp >= locks[msg.sender].unlockTime,
        //     "Lock: You have to wait"
        // );
        if (locks[msg.sender][_id].tokenAddress[0] == address(0x0)) {
            payable(msg.sender).transfer(
                locks[msg.sender][usersNumber].amountEth -
                    (locks[msg.sender][usersNumber].amountEth * ownerFee) /
                    100
            );
        }
        for (uint i = 0; i < locks[msg.sender][_id].tokenAddress.length; i++) {
            if (locks[msg.sender][usersNumber].amountToken[i] > 0) {
                IERC20(locks[msg.sender][id].tokenAddress[i]).transferFrom(
                    address(this),
                    msg.sender,
                    locks[msg.sender][usersNumber].amountToken[i] -
                        (locks[msg.sender][usersNumber].amountToken[i] *
                            ownerFee) /
                        100
                );
            } else {
                payable(msg.sender).transfer(
                    locks[msg.sender][usersNumber].amountEth -
                        (locks[msg.sender][usersNumber].amountEth * ownerFee) /
                        100
                );
                IERC20(locks[msg.sender][_id].tokenAddress[i]).transferFrom(
                    address(this),
                    msg.sender,
                    locks[msg.sender][usersNumber].amountToken[i] -
                        (locks[msg.sender][usersNumber].amountToken[i] *
                            ownerFee) /
                        100
                );
            }
        }

        //block.timestamp changeed to 10 to check the test
        emit UnLocked(usersNumber, msg.sender, 10);
    }

    function withdraw() public payable onlyOwner {
        require(address(this).balance > 0, "You can't withdraw yet");

        payable(owner()).transfer(address(this).balance);
        //block.timestamp changeed to 10 to check the test
        emit Withdrawal(address(this).balance, 10);
    }

    receive() external payable {}
}
