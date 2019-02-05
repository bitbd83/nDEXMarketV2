/* eslint-env browser */

module.exports = {
  homeURL: 'https://dex.karachainfoundation.org',
  contractDEx: 'smart_contract/dEx.sol',
  contractToken: 'smart_contract/token.sol',
  contractReserveToken: 'smart_contract/reservetoken.sol',
  contractDExAddrs: [
        { addr: '0x51ba4d11f6ed41748f8ebcb1890efb6d3e369f59', info: 'Deployed 04/16/2018' },
        { addr: '0x0000000000000000000000000000000000000000', info: 'Zero contract' },
  ],
  ethTestnet: 'ropsten',
  ethProvider: 'https://testgeth.karachainfoundation.org',
  ethGasPrice: 20000000000,
  ethAddr: '0x0000000000000000000000000000000000000000',
  ethAddrPrivateKey: '',
  gasApprove: 250000,
  gasDeposit: 250000,
  gasWithdraw: 250000,
  gasTrade: 250000,
  gasOrder: 250000,
  ordersOnchain: false,
  apiServer: 'https://dex-api.karachainfoundation.org',
  userCookie: 'DEx',
  eventsCacheCookie: 'DEx_eventsCache',
  deadOrdersCacheCookie: 'DEx_deadOrdersCache',
  ordersCacheCookie: 'DEx_ordersCache',
  etherscanAPIKey: 'T1GSYD4D3NEAH44VQ34VHNDR9P316J9E7D',
  tokens: [
        { addr: '0x0000000000000000000000000000000000000000', name: 'ETH', decimals: 18 },
        { addr: '0x54477a3abc9355711bce1c7f150e9129090dcdce', name: 'VAIB', decimals: 18 },
        { addr: '0xa431133d469a128da33a978afcc4e4b75ccb3bb4', name: 'SPC', decimals: 18 },
  ],
  defaultPair: { token: 'VAIB', base: 'ETH' },
  pairs: [
        { token: 'VAIB', base: 'ETH' },
        { token: 'SPC', base: 'ETH' },
  ],
};
