import Decimal from 'decimal.js';

const MAX_WEIGHT = new Decimal(1000000);
const DEC = new Decimal(1).mul(10 ** 18)
const MAX_DECIMAL_PLACES = 14;

export const formatDecimal = (value, decimalPlaces = MAX_DECIMAL_PLACES) => {
    return new Decimal(value).toFixed(decimalPlaces);
}

const calculateSlope = (poolBalanceFinalDecimal, supplyFinalDecimal, reserveRatioDecimal) => {
    const supplyRaiseToInversedReserveRatio = supplyFinalDecimal.pow(new Decimal(1).div(reserveRatioDecimal));
    const slope = poolBalanceFinalDecimal.div(reserveRatioDecimal.mul(supplyRaiseToInversedReserveRatio));
    return slope
}

const calculatePurchaseReturn = (supply, connectorBalance, connectorWeight, depositAmount) => {
    try {
        const supplyDec = new Decimal(supply).mul(DEC);
        const connectorBalanceDec = new Decimal(connectorBalance).mul(DEC);
        const connectorWeightDec = new Decimal(connectorWeight);
        const depositAmountDec = new Decimal(depositAmount).mul(DEC);

        // if(supplyDec == 0){
        //     slope = calculateSlope()
        // }

        if (connectorBalanceDec.lte(0) || connectorWeightDec.lte(0) || connectorWeightDec.gt(MAX_WEIGHT) || depositAmountDec.eq(0)) {
            return '0';
        }

        if (connectorWeightDec.eq(MAX_WEIGHT)) {
            return supplyDec.mul(depositAmountDec).div(connectorBalanceDec).floor().div(DEC).toString();
        }

        const base = depositAmountDec.plus(connectorBalanceDec).div(connectorBalanceDec);
        const exp = connectorWeightDec.div(MAX_WEIGHT);
        const result = base.pow(exp);
        const purchaseReturn = supplyDec.mul(result).sub(supplyDec).floor().sub(1000);
        // return purchaseReturn.div(DEC).toString()
        return formatDecimal(purchaseReturn.div(DEC).toString(), 0)
    } catch (error) {
        return '0'
    }
}


const calculatePurchaseReturnInitial = (poolBalanceFinal, supplyFinal, connectorWeight, depositAmount) => {
    try {

        const poolBalanceFinalDec = new Decimal(poolBalanceFinal).mul(DEC);
        const supplyFinalDec = new Decimal(supplyFinal).mul(DEC);
        const reserveRatioDec = new Decimal(connectorWeight).div(MAX_WEIGHT);
        const depositAmountDec = new Decimal(depositAmount).mul(DEC);

        const slopeDec = calculateSlope(poolBalanceFinalDec, supplyFinalDec, reserveRatioDec);
        const temp1 = reserveRatioDec.mul(slopeDec);
        const temp2 = depositAmountDec.div(temp1);
        const resultDec = temp2.pow(reserveRatioDec);

        // return formatDecimal(resultDec.div(DEC).mul(DEC).div(DEC).toString())
        return formatDecimal(resultDec.div(DEC).toString(), 0)
    } catch (error) {
        return '0'
    }
}

const calculateSaleReturn = (supply, connectorBalance, connectorWeight, sellAmount) => {
    try {
        const supplyDec = new Decimal(supply).mul(DEC);
        const connectorBalanceDec = new Decimal(connectorBalance).mul(DEC);
        const connectorWeightDec = new Decimal(connectorWeight);
        const sellAmountDec = new Decimal(sellAmount).mul(DEC);

        if (supplyDec.lte(0) || connectorBalanceDec.lte(0) || connectorWeightDec.lte(0) || connectorWeightDec.gt(MAX_WEIGHT) || sellAmountDec.eq(0) || sellAmountDec.gt(supplyDec)) {
            return '0';
        }

        if (sellAmountDec.eq(supplyDec)) {
            return connectorBalanceDec.toString();
        }

        if (connectorWeightDec.eq(MAX_WEIGHT)) {
            return connectorBalanceDec.mul(sellAmountDec).div(supplyDec).floor().div(DEC).toString();
        }

        const base = supplyDec.div(supplyDec.sub(sellAmountDec));
        const exp = MAX_WEIGHT.div(connectorWeightDec);
        const result = base.pow(exp);

        const saleReturn = ((connectorBalanceDec.mul(result)).sub(connectorBalanceDec)).div(result).floor();
        // return saleReturn.div(DEC).toString()
        return formatDecimal(saleReturn.div(DEC).toString(), 0)
    } catch (error) {
        return '0'
    }
}

const estimateEthInForExactTokensOut = (supply, connectorBalance, connectorWeight, tokenAmountOut) => {
    try {
        const supplyDec = new Decimal(supply).mul(DEC);
        const connectorBalanceDec = new Decimal(connectorBalance).mul(DEC);
        const connectorWeightDec = new Decimal(connectorWeight);
        const tokenAmountOutDec = new Decimal(tokenAmountOut).mul(DEC);

        if (connectorBalanceDec.lte(0) || connectorWeightDec.lte(0) || connectorWeightDec.gt(MAX_WEIGHT) || tokenAmountOutDec.eq(0)) {
            return '0';
        }

        if (connectorWeightDec.eq(MAX_WEIGHT)) {
            return tokenAmountOutDec.mul(connectorBalanceDec).div(supplyDec).floor().div(DEC).toString();
        }

        const base = tokenAmountOutDec.plus(supplyDec).div(supplyDec);
        const exp = MAX_WEIGHT.div(connectorWeightDec);
        const result = base.pow(exp);
        const estimatedEthIn = connectorBalanceDec.mul(result).sub(connectorBalanceDec).floor().plus(1000);
        // return estimatedEthIn.div(DEC).toString()
        return formatDecimal(estimatedEthIn.div(DEC).toString(), 0)
    } catch (error) {
        return '0'
    }
}

const estimateEthInForExactTokensOutInitial = (poolBalanceFinal, supplyFinal, connectorWeight, tokenAmountOut) => {
    try {

        const poolBalanceFinalDec = new Decimal(poolBalanceFinal).mul(DEC);
        const supplyFinalDec = new Decimal(supplyFinal).mul(DEC);
        const reserveRatioDec = new Decimal(connectorWeight).div(MAX_WEIGHT);
        const tokenAmountOutDec = new Decimal(tokenAmountOut).mul(DEC);

        const slopeDec = calculateSlope(poolBalanceFinalDec, supplyFinalDec, reserveRatioDec);

        const temp1 = reserveRatioDec.mul(slopeDec);
        const temp2 = tokenAmountOutDec.pow(new Decimal(1).div(reserveRatioDec));
        const resultDec = temp1.mul(temp2);

        return formatDecimal(resultDec.div(DEC).toString(), 0);
    } catch (error) {
        return '0'
    }
}

const estimateTokenInForExactEthOut = (supply, connectorBalance, connectorWeight, ethOut) => {
    try {
        const supplyDec = new Decimal(supply).mul(DEC);
        const connectorBalanceDec = new Decimal(connectorBalance).mul(DEC);
        const connectorWeightDec = new Decimal(connectorWeight);
        const ethOutDec = new Decimal(ethOut).mul(DEC);

        if (supplyDec.lte(0) || connectorBalanceDec.lte(0) || connectorWeightDec.lte(0) || connectorWeightDec.gt(MAX_WEIGHT) || ethOutDec.eq(0)) {
            return '0';
        }

        const effectiveEthOut = ethOutDec.plus(1000);

        if (connectorWeightDec.eq(MAX_WEIGHT)) {
            return supplyDec.mul(effectiveEthOut).div(connectorBalanceDec).floor().div(DEC).toString();
        }

        const base = connectorBalanceDec.div(connectorBalanceDec.sub(effectiveEthOut));
        const exp = connectorWeightDec.div(MAX_WEIGHT);
        const result = base.pow(exp);
        const estimateTokenIn = supplyDec.mul(result).sub(supplyDec).div(result).floor();
        // return estimateTokenIn.div(DEC).toString()
        return formatDecimal(estimateTokenIn.div(DEC).toString(), 0)
    } catch (error) {
        return '0'
    }
}

const initialConstants = {
    "circulatingSupply": "1000",
    "poolBalance": "0.000000000008571428",
    "reserveRatio": "500000"
}


export const apeFormula = {
    calculatePurchaseReturn,
    calculatePurchaseReturnInitial,
    calculateSaleReturn,
    estimateEthInForExactTokensOut,
    estimateEthInForExactTokensOutInitial,
    estimateTokenInForExactEthOut,
    MAX_WEIGHT,
    initialConstants
}
