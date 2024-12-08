import { mainnet, sepolia, polygon, optimism, base, moonbeam } from 'wagmi/chains'
import { tenderlyChain } from './tenderlyChain'

export const supportedChains = [tenderlyChain, base, moonbeam]

export const chainLogos = {
    [tenderlyChain.id]: '/images/chains_logos/tenderly_logo.svg',
    [base.id]: '/images/chains_logos/ethereum_logo.svg',
    // [moonbeam.id]: '/images/chains_logos/ethereum_logo.svg',
}

export const getChainLogo = (chainId) => {
    return chainLogos[chainId];
}

export function getChainNameFromId(chainId) {
    const chain = supportedChains.find(chain => chain.id === chainId);
    return chain ? chain.name : null;
}




