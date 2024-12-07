import { defineChain } from "viem";

// export const rpcUrl = 'https://virtual.base.rpc.tenderly.co/910edb69-358e-4833-a39f-23b99d34b10b'
export const rpcUrl = 'https://virtual.base.rpc.tenderly.co/b24b9e70-286b-446d-9bd5-a728627d463c'

export const tenderlyChain = defineChain({
    id: 8454,
    name: 'basefork',
    network: 'basefork',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: {
            http: [rpcUrl],
        },
    },
    blockExplorers: {
        default: {
            name: 'Tenderly Explorer',
            url: rpcUrl,
        },
    },
    testnet: true,
});