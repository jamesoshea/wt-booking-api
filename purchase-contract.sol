pragma solidity ^0.4.15;

contract Purchase {
    address buyer;
    address hotelId;
    uint purchaseAmount;
    uint paidAmount;

    event paymentFulfilled();
    event overPayment();

    function updateValue(uint _amount) public returns (uint) {
        if (msg.sender != address(buyer)) {
           return 1;
        }

        if (paidAmount + _amount > purchaseAmount) {
            emit overPayment();
            return 1;
        }

        paidAmount += _amount;
        if (paidAmount == purchaseAmount) {
            emit paymentFulfilled();
            return 0;
        }
    }
}

