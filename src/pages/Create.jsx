import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaArrowDown, FaCircleArrowLeft } from 'react-icons/fa6';
import { Collapse } from 'react-collapse';
import * as Yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import Modal from 'react-responsive-modal';
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { useSnackbar } from 'notistack';
import { createIpfsUrlFromContentHash, formatNumber } from '../utils/formats';
import BigNumber from 'bignumber.js';
import Decimal from 'decimal.js';
import ipfsClient from '../ipfs/client';
import { getAddress, parseEther, parseEventLogs } from 'viem';
import LoadingSteps from '../components/LoadingSteps';
import { uniswapFormula } from '../utils/uniswapHelper';
import { getFactoryContractAddress } from '../config/contracts';
import { nativeCurrencyDetails } from '../utils/native';
import { CONTRACT, CURVE_TYPE } from '../constants';
import { getContractAbi } from '../config/abis';
import { getChainLogo } from '../config/chains';
import { apeFormula } from '../utils/apeFormula';


const Create = ({ targetedPoolBalance, targetedTokenSupply, reserveRatio }) => {

    const [open1, setOpen1] = useState(false);
    const [open, setOpen] = useState(false);
    const [progress, setProgress] = useState(0);

    const onCloseModal = () => setOpen(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { isConnected } = useAccount()

    const [ethTrade, setEthTrade] = useState(true);
    const { enqueueSnackbar } = useSnackbar();
    const chainId = useChainId()
    const nativeCurrency = nativeCurrencyDetails(chainId);

    useEffect(() => {
        if (ethTrade) {
            setValue('buyAmountEth', estimateEthIn)
        } else {
            setValue('buyAmountToken', purchaseReturn)
        }
    }, [ethTrade])

    const handleSwitchCurrency = () => {
        setEthTrade(!ethTrade);
    };

    const onOpenBuyModal = () => {
        if (!isConnected) {
            enqueueSnackbar('Please connect your wallet', { variant: 'warning' });
            return
        }
        setOpen(true);
    }

    const CreateCoinSchema = Yup.object().shape({
        name: Yup.string().required('Name is required'),
        symbol: Yup.string().required('Ticker is required'),
        // image: Yup.mixed().required('Logo is required'),
        image: Yup.mixed()
            .test('required', 'Logo is required', (value) => value && value.length > 0)
            .test('fileType', 'Invalid file type. Only JPG, JPEG, PNG, and GIF files are allowed.', (value) => {
                if (!value || !value.length) return true; // Allow empty value
                return ['image/jpg', 'image/jpeg', 'image/png', 'image/gif', 'image/svg'].includes(value[0].type);
            })
            .test('fileSize', 'File size must be less than 2MB.', (value) => {
                if (!value || !value.length) return true; // Allow empty value
                return value[0].size <= 2 * 1024 * 1024;
            })
            .required('Logo is required'),
        description: Yup.string().required('Description is required'),
        twitter: Yup.lazy((value) =>
            value === null || value === undefined || value === ''
                ? Yup.string().nullable()
                : Yup.string().matches(
                    /^https:\/\/twitter\.com\/([a-zA-Z0-9_]{1,15})\/?$/,
                    'Must be a valid Twitter URL'
                )
        ),
        telegram: Yup.lazy((value) =>
            value === null || value === undefined || value === ''
                ? Yup.string().nullable()
                : Yup.string().matches(
                    /^https:\/\/t\.me\/([a-zA-Z0-9_]+)\/?$/,
                    'Must be a valid Telegram URL'
                )
        ),
        website: Yup.string().url().nullable(true),
        buyAmountEth: Yup.string().matches(/^\d*\.?\d*$/, 'Must be a valid number').test('positive', 'Must be greater than or equal to 0', value => parseFloat(value) >= 0),
        buyAmountToken: Yup.string().matches(/^\d*\.?\d*$/, 'Must be a valid number').test('positive', 'Must be greater than or equal to 0', value => parseFloat(value) >= 0),
        // curveType: Yup.string().oneOf(['UNISWAP', 'APE'], 'Must be either UNISWAP or APE').required('Curve type is required'),
    });

    const { register, handleSubmit, watch, getValues, formState: { errors }, setValue } = useForm({
        resolver: yupResolver(CreateCoinSchema),
        defaultValues: {
            buyAmountEth: '0',
            buyAmountToken: '0',
            curveType: CURVE_TYPE.APE
        },
    });

    const curveType = watch('curveType');
    const buyAmountEth = watch('buyAmountEth');
    const buyAmountToken = watch('buyAmountToken');
    const tokenSymbol = watch('symbol');

    const purchaseReturn = useMemo(() => {
        if (curveType == CURVE_TYPE.UNISWAP) {
            return uniswapFormula.calculatePurchaseReturn(
                buyAmountEth || '0',
                uniswapFormula.initialConstants.virtualEthReserve,
                uniswapFormula.initialConstants.virtualTokenReserve
            );
        } else if (curveType == CURVE_TYPE.APE) {
            // return new BigNumber(
            //     apeFormula.calculatePurchaseReturn(
            //         apeFormula.initialConstants.circulatingSupply,
            //         apeFormula.initialConstants.poolBalance,
            //         apeFormula.initialConstants.reserveRatio,
            //         buyAmountEth || '0')
            // ).toString();
            return new BigNumber(
                apeFormula.calculatePurchaseReturnInitial(
                    targetedPoolBalance,
                    targetedTokenSupply,
                    // ((new Decimal(reserveRatio)).mul(new Decimal(apeFormula.MAX_WEIGHT))).toString(),
                    (reserveRatio * apeFormula.MAX_WEIGHT).toString(),
                    buyAmountEth || '0')
            ).toString();
        } else {
            return 0;
        }
    }, [buyAmountEth]);

    // console.log("reserveRatio * apeFormula.MAX_WEIGHT", (reserveRatio * apeFormula.MAX_WEIGHT).toString())
    // console.log("shhhshhshshsh",
    //     (((new Decimal(reserveRatio)).mul(new Decimal(apeFormula.MAX_WEIGHT))).toString()));

    const estimateEthIn = useMemo(() => {
        if (curveType == CURVE_TYPE.UNISWAP) {
            return uniswapFormula.estimateEthInForExactTokensOut(
                buyAmountToken || '0',
                uniswapFormula.initialConstants.virtualEthReserve,
                uniswapFormula.initialConstants.virtualTokenReserve
            );
        } else if (curveType == CURVE_TYPE.APE) {
            // return new BigNumber(
            //     apeFormula.estimateEthInForExactTokensOut(
            //         apeFormula.initialConstants.circulatingSupply,
            //         apeFormula.initialConstants.poolBalance,
            //         apeFormula.initialConstants.reserveRatio,
            //         buyAmountToken || '0')
            // ).toString();
            return new BigNumber(
                apeFormula.estimateEthInForExactTokensOutInitial(
                    targetedPoolBalance,
                    targetedTokenSupply,
                    (reserveRatio * apeFormula.MAX_WEIGHT).toString(),
                    buyAmountToken || '0')
            ).toString();

        } else {
            return 0;
        }
    }, [buyAmountToken]);

    const {
        data: hash,
        error,
        isPending,
        writeContract,
        writeContractAsync
    } = useWriteContract()

    const { data: receiptData, isLoading: isConfirming, isSuccess: isConfirmed } =
        useWaitForTransactionReceipt({
            hash: hash,
        })

    useEffect(() => {
        if (isConfirmed) {
            enqueueSnackbar('Transaction successful of Token creation', { variant: 'success' });
            const eventLogs = parseEventLogs({
                abi: getContractAbi(CONTRACT.FACTORY, curveType),
                eventName: 'TokenCreated',
                logs: receiptData?.logs,
            })
            if (eventLogs?.length > 0) {
                let tokenAddress = eventLogs[0]?.args?.token
                setProgress(3);

                setTimeout(() => {
                    setProgress(4);
                    navigate(`/token/${chainId}/${tokenAddress.toLowerCase()}`);
                }, 5000);
            }

        } else if (error) {
            console.log('errorrrr', error)
            enqueueSnackbar('Error executing token creation transaction: ' + error.details, { variant: 'error' });
        }
    }, [isConfirmed, error, enqueueSnackbar]);

    const executeTokenCreation = async () => {
        try {
            if (!isConnected) {
                enqueueSnackbar('Please connect your wallet', { variant: 'warning' });
                return
            }

            let values = getValues();
            // const factoryContractAddress = getFactoryContractAddress(chainId, values.curveType)
            const factoryContractAddress = getFactoryContractAddress(chainId, CURVE_TYPE.APE)
            if (!factoryContractAddress) {
                enqueueSnackbar('Chain is not supported yet', { variant: 'warning' });
                return
            }

            onCloseModal();
            values = getValues()
            setIsLoading(true)

            // Upload image to IPFS
            const imageFile = values.image[0];
            const imageAdded = await ipfsClient.add(imageFile);
            const imageURI = imageAdded.path;

            console.log('imageFile', imageFile)

            console.log('imageAdded', imageAdded)
            console.log('imageURI', imageURI)
            // return

            await ipfsClient.pin.add(imageAdded.path);
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Create metadata with the image URI
            const metadata = {
                name: values.name,
                description: values.description,
                symbol: values.symbol,
                image: imageURI,
                twitter: values.twitter,
                telegram: values.telegram,
                website: values.website,
            };

            console.log('imageURI', createIpfsUrlFromContentHash(imageURI))

            // Upload metadata to IPFS
            const metadataAdded = await ipfsClient.add(JSON.stringify(metadata));
            const tokenURI = `${metadataAdded.path}`;

            console.log('tokenURI', createIpfsUrlFromContentHash(tokenURI))
            // Pin the metadata
            await ipfsClient.pin.add(metadataAdded.path);

            setProgress(1)

            // const args = [values.name, values.symbol, tokenURI]
            const reserveRatioParam = (reserveRatio * apeFormula.MAX_WEIGHT).toString();
            const ethAmountForLiquidity = parseEther(targetedPoolBalance.toString()) * 90n / 100n;
            const ethAmountForLiquidityFee = parseEther(targetedPoolBalance.toString()) * 5n / 100n;
            const ethAmountForDevReward = parseEther(targetedPoolBalance.toString()) * 5n / 100n;
            const tokenSupplyToSell = parseEther(targetedTokenSupply.toString());

            const args = [
                values.name,
                values.symbol,
                tokenURI,
                reserveRatioParam,
                ethAmountForLiquidity.toString(),
                ethAmountForLiquidityFee.toString(),
                ethAmountForDevReward.toString(),
                tokenSupplyToSell.toString()
            ]

            let value = 0;
            if (ethTrade) {
                value = values?.buyAmountEth;
            } else {
                let estimateEthIn;
                if (curveType == CURVE_TYPE.UNISWAP) {
                    estimateEthIn = new BigNumber(
                        uniswapFormula.estimateEthInForExactTokensOut(
                            values?.buyAmountToken || '0',
                            uniswapFormula.initialConstants.virtualEthReserve,
                            uniswapFormula.initialConstants.virtualTokenReserve
                        )
                    ).toString();
                } else if (curveType == CURVE_TYPE.APE) {
                    // estimateEthIn = new BigNumber(
                    //     apeFormula.estimateEthInForExactTokensOut(
                    //         apeFormula.initialConstants.circulatingSupply,
                    //         apeFormula.initialConstants.poolBalance,
                    //         apeFormula.initialConstants.reserveRatio,
                    //         values?.buyAmountToken || '0')
                    // ).toString();
                    estimateEthIn = new BigNumber(
                        apeFormula.estimateEthInForExactTokensOutInitial(
                            targetedPoolBalance,
                            targetedTokenSupply,
                            (reserveRatio * apeFormula.MAX_WEIGHT).toString(),
                            buyAmountToken || '0')
                    ).toString();
                } else {
                    estimateEthIn = new BigNumber(0);
                }
                value = estimateEthIn;
            }

            const inputAmount = new Decimal(value).mul(new Decimal(10).pow(18));
            const adjustedInputAmount = inputAmount.mul(1.01);

            setProgress(2);

            await writeContractAsync({
                // abi: getContractAbi(CONTRACT.FACTORY, curveType),
                abi: getContractAbi(CONTRACT.FACTORY, CURVE_TYPE.APE),
                address: getAddress(factoryContractAddress),
                functionName: 'createToken',
                args: args,
                value: adjustedInputAmount.toFixed(),
            });

            setProgress(3);

            return
        } catch (error) {
            console.error('Error executing transaction:', error);
        }
    };

    if (isConfirming || isLoading) {
        return (
            <div className='container-fluid create-coin min-h-screen bg-fixed bg-center bg-no-repeat bg-cover pt-[70px]'>
                <div className="bs-container relative">
                    <LoadingSteps progress={progress} />
                </div>
            </div>
        );
    }

    return (
        <div className='container-fluid create-coin min-h-screen bg-fixed bg-center bg-no-repeat bg-cover pt-[70px]'>
            <div className="bs-container relative">
                <div className='absolute z-[11]  sm:pt-10 left-2 sm:left-0 top-0'>
                    <button onClick={() => navigate('/')} className='pl-2 max-sm:gap-x-2 flex items-center bg-transparent'>
                        <FaCircleArrowLeft className='text-white text-2xl' />
                        <span className='text-white sm:hidden pfont-500'>Go back</span>
                    </button>
                </div>
                <div className="row py-10 justify-center">
                    <div className="col-xxl-4 col-lg-5 col-md-7 col-sm-9 col-11 bg-black border-[2px] border-[#27272a]  rounded-md p-7">
                        <div>
                            <form onSubmit={handleSubmit((values) => onOpenBuyModal())}>
                                <div className='flex flex-col gap-y-4'>
                                    <div>
                                        <label className='roboto-400 tracking-[0.5px] text-white'>Name :</label>
                                        <input
                                            className='w-full focus:border-[2px] focus:border-[#6b7280] border-[1px] border-[#4b4b50]  bg-[#27272a] mt-1.5 rounded text-white roboto-400 text-base py-2 px-4 outline-none focus:outline-none'
                                            type="text"
                                            {...register('name')}
                                        />
                                        {errors.name && <span className='text-red-500'>{errors.name.message}</span>}
                                    </div>
                                    <div>
                                        <label className='roboto-400 tracking-[0.5px] text-white'>Ticker :</label>
                                        <input
                                            className='w-full focus:border-[2px] focus:border-[#6b7280] border-[1px] border-[#4b4b50]  bg-[#27272a] mt-1.5 rounded text-white roboto-400 text-base py-2 px-4 outline-none focus:outline-none'
                                            type="text"
                                            {...register('symbol')}
                                        />
                                        {errors.symbol && <span className='text-red-500'>{errors.symbol.message}</span>}
                                    </div>
                                    <div>
                                        <label className='roboto-400 tracking-[0.5px] text-white'>Logo :</label>
                                        <div className='w-full focus:border-[2px] focus:border-[#6b7280] border-[1px] border-[#4b4b50]  bg-[#27272a] mt-1.5 rounded text-white roboto-400 text-base py-3 px-3 outline-none focus:outline-none'>
                                            <input type="file" {...register('image')} />
                                        </div>
                                        {errors.image && <span className='text-red-500'>{errors.image.message}</span>}
                                    </div>
                                    <div>
                                        <label className='roboto-400 tracking-[0.5px] text-white'>Description :</label>
                                        <textarea
                                            rows={4}
                                            className='w-full focus:border-[2px] focus:border-[#6b7280] border-[1px] border-[#4b4b50]  bg-[#27272a] mt-1.5 rounded text-white roboto-400 text-base py-2 px-4 outline-none focus:outline-none'
                                            type="text"
                                            {...register('description')}
                                        />
                                        {errors.description && <span className='text-red-500'>{errors.description.message}</span>}
                                    </div>
                                    {/* <div>
                                        <label className='roboto-400 tracking-[0.5px] text-white'>Curve Type :</label>
                                        <select
                                            className='w-full focus:border-[2px] focus:border-[#6b7280] border-[1px] border-[#4b4b50]  bg-[#27272a] mt-1.5 rounded text-white roboto-400 text-base py-2 px-4 outline-none focus:outline-none'
                                            {...register('curveType')}
                                        >
                                            <option value="UNISWAP">UNISWAP</option>
                                            <option value="APE">APE</option>
                                        </select>
                                        {errors.curveType && <span className='text-red-500'>{errors.curveType.message}</span>}
                                    </div> */}
                                    <div>
                                        <div onClick={() => setOpen1(!open1)} className='flex gap-x-1.5 items-center  cursor-pointer'>
                                            <span className='roboto-400 tracking-[0.5px] text-white'>Show more options</span>
                                            <FaArrowDown className={`text-white ${open1 ? 'rotate-180' : 'rotate-0'}`} />
                                        </div>
                                        <Collapse isOpened={open1}>
                                            <div className='flex gap-y-3 flex-col pt-3 pb-2'>
                                                <div>
                                                    <label className='roboto-400 tracking-[0.5px] text-white'>Twitter :</label>
                                                    <input
                                                        className='w-full focus:border-[2px] focus:border-[#6b7280] border-[1px] border-[#4b4b50]  bg-[#27272a] mt-1.5 rounded text-white roboto-400 text-base py-2 px-4 outline-none focus:outline-none'
                                                        type="text"
                                                        placeholder='https://twitter.com/apecity'
                                                        {...register('twitter')}
                                                    />
                                                    {errors.twitter && <span className='text-red-500'>{errors.twitter.message}</span>}
                                                </div>
                                                <div>
                                                    <label className='roboto-400 tracking-[0.5px] text-white'>Telegram :</label>
                                                    <input
                                                        className='w-full focus:border-[2px] focus:border-[#6b7280] border-[1px] border-[#4b4b50] bg-[#27272a] mt-1.5 rounded text-white roboto-400 text-base py-2 px-4 outline-none focus:outline-none'
                                                        type="text"
                                                        placeholder='https://t.me/apecity'
                                                        {...register('telegram')}
                                                    />
                                                    {errors.telegram && <span className='text-red-500'>{errors.telegram.message}</span>}
                                                </div>
                                                <div>
                                                    <label className='roboto-400 tracking-[0.5px] text-white'>Website :</label>
                                                    <input
                                                        className='w-full focus:border-[2px] focus:border-[#6b7280] border-[1px] border-[#4b4b50]  bg-[#27272a] mt-1.5 rounded text-white roboto-400 text-base py-2 px-4 outline-none focus:outline-none'
                                                        type="text"
                                                        placeholder='https://apecity.fun'
                                                        {...register('website')}
                                                    />
                                                    {errors.website && <span className='text-red-500'>{errors.website.message}</span>}
                                                </div>
                                            </div>
                                        </Collapse>
                                    </div>

                                    <div>
                                        <button
                                            type='submit'
                                            className="bg-gradient-to-br from-zinc-900 to-zinc-900   dark:bg-zinc-800  transition-all duration-300  hover:scale-105 text-center border-none w-full text-white flex justify-center items-center tracking-[1px] roboto-500 gap-x-2 px-4 py-2.5 rounded-md"
                                        >
                                            Create
                                        </button>
                                        <p className='text-white mt-3.5 roboto-400'>Cost to deploy: ~0.0002 {nativeCurrency.symbol}</p>
                                    </div>
                                </div>
                            </form>

                            <Modal
                                styles={{ padding: 0 }}
                                open={open}
                                showCloseIcon={false}
                                blockScroll={false}
                                onClose={onCloseModal}
                                center
                            >
                                <div className='sm:w-[470px] border px-5 py-5 sm:py-6 sm:px-6 border-white rounded-xl flex gap-y-3 flex-col bg-[#1b1d28]'>
                                    <div className='w-full   flex justify-center items-center'>
                                        <div className="text-center">
                                            <h3 className="text-center tracking-[0.5px] roboto-400 text-white text-[17px]">Choose how many {tokenSymbol} you want to buy </h3>
                                            <p className='text-center tracking-[0.5px] mt-1 roboto-400 text-white text-[17px]'>(optional)</p>
                                            <p className='text-center tracking-[0.5px] mt-3.5 mb-3 pfont-400 text-white text-sm'>Pro tip: Buying a small amount helps protect your token from snipers</p>
                                        </div>
                                    </div>
                                    <div className="flex mb-2 justify-end w-full gap-2">
                                        <button
                                            className="text-xs py-1 pfont-400 px-2  rounded bg-gray-800 text-gray-300"
                                            type="button"
                                            onClick={handleSwitchCurrency}
                                        >
                                            Switch to {ethTrade ? tokenSymbol : nativeCurrency.symbol}
                                        </button>
                                    </div>
                                    <div>
                                        {ethTrade ?
                                            (
                                                <>
                                                    <div className="flex items-center rounded-md relative">
                                                        <input
                                                            className="flex h-11 rounded-md border pfont-400 border-slate-200 px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none   disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300 bg-transparent text-white outline-none w-full pl-3"
                                                            type="number"
                                                            placeholder="0.0"
                                                            step="0.00000000000001"
                                                            {...register('buyAmountEth')}
                                                        />
                                                        <div className="flex items-center ml-2 absolute right-2">
                                                            <span className="text-white pfont-400 mr-2">{nativeCurrency.symbol}</span>
                                                            <img
                                                                className="w-7 h-7 rounded-full"
                                                                src={getChainLogo(chainId)}
                                                                alt={nativeCurrency.symbol}
                                                            />
                                                        </div>
                                                    </div>
                                                    <p className='text-center tracking-[0.5px] mt-3.5 mb-3 pfont-400 text-white text-sm'>
                                                        {
                                                            errors?.buyAmountToken ?
                                                                (
                                                                    <div className='mt-1'>
                                                                        {`${errors?.buyAmountToken?.message}`}
                                                                    </div>
                                                                ) :
                                                                (
                                                                    <div className='mt-1'>
                                                                        {`You will receive ${purchaseReturn} (~${formatNumber(purchaseReturn)}) ${tokenSymbol}`}
                                                                    </div>
                                                                )}
                                                    </p>
                                                </>
                                            )
                                            :
                                            (
                                                <>
                                                    <div className="flex items-center rounded-md relative">
                                                        <input
                                                            className="flex h-11 rounded-md border pfont-400 border-slate-200 px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none   disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300 bg-transparent text-white outline-none w-full pl-3"
                                                            type="number"
                                                            placeholder="0.0"
                                                            step="0.00000000000001"
                                                            {...register('buyAmountToken')}
                                                        />
                                                        <div className="flex items-center ml-2 absolute right-2">
                                                            <span className="text-white pfont-400 mr-2">{tokenSymbol}</span>
                                                        </div>
                                                    </div>
                                                    {
                                                        <p className='text-center tracking-[0.5px] mt-3.5 mb-3 pfont-400 text-white text-sm'>
                                                            {
                                                                errors?.buyAmountEth ?
                                                                    (
                                                                        <div className='mt-1'>
                                                                            {`${errors?.buyAmountToken?.message}`}
                                                                        </div>
                                                                    ) :
                                                                    (
                                                                        <div className='mt-1'>
                                                                            {`It will cost ${estimateEthIn} (~${formatNumber(estimateEthIn)}) ${nativeCurrency.symbol}`}
                                                                        </div>
                                                                    )}
                                                        </p>
                                                    }
                                                </>
                                            )
                                        }

                                    </div>
                                    <div className="flex mt-2 justify-center">
                                        <button
                                            onClick={executeTokenCreation}
                                            // type="submit"
                                            className="bg-[#475dc0] transition-all duration-300 hover:bg-blue-500 hover:scale-105 border-none text-white flex items-center tracking-[1px] roboto-500 gap-x-2 w-full text-center justify-center py-2.5 rounded-md"
                                        >
                                            Create Coin
                                        </button>
                                    </div>
                                    <p className='text-white mt-2 text-center pfont-400'>Cost to deploy: ~$1</p>
                                </div>
                                {/* </form> */}

                            </Modal>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Create;