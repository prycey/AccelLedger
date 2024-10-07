const Big = require('big.js');

class BookingMethod {
    constructor(method = 'FIFO') {
        this.method = method;
        this.inventory = [];
    }

    applyMethod(transaction) {
        switch (this.method) {
            case 'FIFO':
                return this.applyFIFO(transaction);
            case 'LIFO':
                return this.applyLIFO(transaction);
            case 'AVERAGE':
                return this.applyAverage(transaction);
            default:
                throw new Error(`Unknown booking method: ${this.method}`);
        }
    }

    applyFIFO(transaction) {
        // Implement FIFO logic
        let remaining = new Big(transaction.amount);
        const booked = [];

        while (remaining.gt(0) && this.inventory.length > 0) {
            const oldest = this.inventory[0];
            if (oldest.amount.gte(remaining)) {
                oldest.amount = oldest.amount.minus(remaining);
                booked.push({ ...oldest, amount: remaining });
                remaining = new Big(0);
            } else {
                booked.push(oldest);
                remaining = remaining.minus(oldest.amount);
                this.inventory.shift();
            }
        }

        if (remaining.gt(0)) {
            this.inventory.push({ ...transaction, amount: remaining });
        }

        return booked;
    }

    applyLIFO(transaction) {
        let remaining = new Big(transaction.amount);
        const booked = [];

        while (remaining.gt(0) && this.inventory.length > 0) {
            const newest = this.inventory[this.inventory.length - 1];
            if (newest.amount.gte(remaining)) {
                newest.amount = newest.amount.minus(remaining);
                booked.push({ ...newest, amount: remaining });
                remaining = new Big(0);
            } else {
                booked.push(newest);
                remaining = remaining.minus(newest.amount);
                this.inventory.pop();
            }
        }

        if (remaining.gt(0)) {
            this.inventory.push({ ...transaction, amount: remaining });
        }

        return booked;
    }

    applyAverage(transaction) {
        const totalAmount = this.inventory.reduce((sum, item) => sum.plus(item.amount), new Big(0));
        const totalCost = this.inventory.reduce((sum, item) => sum.plus(item.amount.times(item.price)), new Big(0));
        
        let averageCost;
        if (totalAmount.eq(0)) {
            averageCost = new Big(transaction.price);
        } else {
            averageCost = totalCost.div(totalAmount);
        }

        const newAmount = totalAmount.plus(transaction.amount);
        const newCost = totalCost.plus(new Big(transaction.amount).times(transaction.price));
        const newAverageCost = newCost.div(newAmount);

        this.inventory = [{
            amount: newAmount,
            price: newAverageCost
        }];

        return [{
            amount: new Big(transaction.amount),
            price: averageCost
        }];
    }
}

module.exports = BookingMethod;